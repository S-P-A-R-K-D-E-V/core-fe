'use client';

import { useId, useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';

import { getStorageUrl } from 'src/utils/storage';
import { fCurrency } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Lightbox from 'src/components/lightbox';

import {
  getPurchaseImport,
  uploadInvoiceImages,
  retryPurchaseImport,
  assistPurchaseImport,
  cancelPurchaseImport,
  commitPurchaseImport,
  updatePurchaseImportLine,
  getPurchaseImportConversation,
} from 'src/api/purchase-imports';

import type {
  IPurchaseImport,
  IPurchaseImportMessage,
  IPurchaseImportDuplicate,
  IUpdatePurchaseImportLineRequest,
} from 'src/types/purchase-import';

import PurchaseImportConversation from './purchase-import-conversation';
import PurchaseImportDrawerLine, { DRAWER_POPPER_Z } from './purchase-import-drawer-line';
import {
  PURCHASE_IMPORT_CHANGED_EVENT,
  announcePurchaseImportChange,
  type PurchaseImportChangedDetail,
} from './purchase-import-events';
import {
  lineCounts,
  IMPORT_STATUS,
  commitBlockers,
  totalMismatch,
  importErrorMessage,
  isDuplicateInvoice,
} from './purchase-import-utils';

// ----------------------------------------------------------------------
// Drawer duyệt nhanh một lần nhập từ ảnh (mở từ thẻ hoá đơn trong chat / cột "Phiên nhập"): xem dòng + ảnh hoá đơn +
// ảnh sản phẩm, sửa trực tiếp, và nhắn trợ lý bằng câu tự do (kèm ảnh sản phẩm) để trợ lý sửa lần nhập — không rời
// khung chat. Trang duyệt đầy đủ vẫn mở được từ nút ở đầu drawer.
// ----------------------------------------------------------------------

const DRAWER_Z = 1450;
const POLL_MS = 3000;
const HIGHLIGHT_MS = 5000;
const MAX_PHOTOS_PER_MESSAGE = 5;

type DrawerTab = 'lines' | 'images' | 'chat';

type Photo = { file: File; preview: string };

type Props = {
  importId: string | null;
  onClose: () => void;
  /** Mở trang trong dashboard (drawer đóng theo). */
  onNavigate: (href: string) => void;
};

export default function PurchaseImportDrawer({ importId, onClose, onNavigate }: Props) {
  const instanceId = useId();
  const [item, setItem] = useState<IPurchaseImport | null>(null);
  const [messages, setMessages] = useState<IPurchaseImportMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [tab, setTab] = useState<DrawerTab>('lines');

  const [busyLine, setBusyLine] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [duplicateCommit, setDuplicateCommit] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<{ text: string; images: string[] } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<IPurchaseImportDuplicate[]>([]);
  const [highlight, setHighlight] = useState<number[]>([]);
  const [zoom, setZoom] = useState<{ slides: { src: string }[]; index: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Đổi lần nhập → làm mới mọi thứ.
  useEffect(() => {
    setItem(null);
    setMessages([]);
    setLoadError(null);
    setTab('lines');
    setDraft('');
    clearPhotos(() => false);
    setPending(null);
    setSendError(null);
    setDuplicates([]);
    setHighlight([]);
    setConfirming(false);
    setDuplicateCommit(null);
    setActionError(null);
  }, [importId]);

  // Tải lần nhập + trao đổi; còn đang đọc ảnh thì hỏi lại.
  useEffect(() => {
    if (!importId) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async (first: boolean) => {
      try {
        const [data, conversation] = await Promise.all([
          getPurchaseImport(importId),
          first ? getPurchaseImportConversation(importId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setItem(data);
        if (conversation) setMessages(conversation);
        setLoadError(null);
        if (data.status === 'Extracting') timer = setTimeout(() => tick(false), POLL_MS);
      } catch (error) {
        if (!cancelled)
          setLoadError(
            importErrorMessage(error, 'Không xem được lần nhập này (cần quyền nhập hàng).')
          );
      }
    };
    tick(true);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [importId, pollKey]);

  // Thẻ trong chat / nơi khác sửa cùng lần nhập → tải lại.
  useEffect(() => {
    const onChanged = (event: Event) => {
      const { detail } = event as CustomEvent<PurchaseImportChangedDetail>;
      if (detail?.importId === importId && detail.source !== instanceId) setPollKey((k) => k + 1);
    };
    window.addEventListener(PURCHASE_IMPORT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PURCHASE_IMPORT_CHANGED_EVENT, onChanged);
  }, [importId, instanceId]);

  useEffect(() => {
    if (highlight.length === 0) return undefined;
    const timer = setTimeout(() => setHighlight([]), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlight]);

  // Ảnh xem trước (blob:) thu hồi khi bỏ ảnh, gửi xong hoặc đóng drawer.
  const photosRef = useRef<Photo[]>([]);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);
  const clearPhotos = (keep: (photo: Photo, index: number) => boolean) =>
    setPhotos((current) => {
      current.filter((p, i) => !keep(p, i)).forEach((p) => URL.revokeObjectURL(p.preview));
      return current.filter(keep);
    });

  const changed = useCallback(
    (next: IPurchaseImport) => {
      setItem(next);
      announcePurchaseImportChange(next.id, instanceId);
    },
    [instanceId]
  );

  const saveLine = useCallback(
    async (lineNo: number, patch: IUpdatePurchaseImportLineRequest) => {
      if (!importId) return;
      setBusyLine(lineNo);
      setActionError(null);
      try {
        changed(await updatePurchaseImportLine(importId, lineNo, patch));
      } catch (error) {
        setActionError(importErrorMessage(error, 'Không lưu được dòng.'));
      } finally {
        setBusyLine(null);
      }
    },
    [importId, changed]
  );

  const run = async (action: () => Promise<void>, fallback: string) => {
    setWorking(true);
    setActionError(null);
    try {
      await action();
      if (importId) announcePurchaseImportChange(importId, instanceId);
      setPollKey((k) => k + 1);
    } catch (error) {
      setActionError(importErrorMessage(error, fallback));
    } finally {
      setWorking(false);
    }
  };

  const commit = (allowDuplicate: boolean) =>
    run(async () => {
      try {
        await commitPurchaseImport(importId!, allowDuplicate);
        setConfirming(false);
        setDuplicateCommit(null);
      } catch (error) {
        if (!allowDuplicate && isDuplicateInvoice(error)) {
          setConfirming(false);
          setDuplicateCommit(importErrorMessage(error, 'Hoá đơn này đã được nhập.'));
          return;
        }
        throw error;
      }
    }, 'Không tạo được phiếu nhập.');

  const addPhotos = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setPhotos((current) =>
      [...current, ...images.map((file) => ({ file, preview: URL.createObjectURL(file) }))].slice(
        0,
        MAX_PHOTOS_PER_MESSAGE
      )
    );
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!importId || sending || (!message && photos.length === 0)) return;
    const sentPhotos = photos;
    setSending(true);
    setSendError(null);
    setTab('chat');
    setPending({ text: message, images: sentPhotos.map((p) => p.preview) });
    setDraft('');
    try {
      const objectKeys =
        sentPhotos.length > 0 ? await uploadInvoiceImages(sentPhotos.map((p) => p.file)) : [];
      const reply = await assistPurchaseImport(importId, { message, objectKeys });
      setMessages(reply.conversation);
      setDuplicates(reply.duplicates);
      setHighlight(reply.changedLines);
      changed(reply.import);
      clearPhotos(() => false);
      if (reply.rereading) setPollKey((k) => k + 1);
    } catch (error) {
      setDraft(message);
      setSendError(importErrorMessage(error, 'Chưa gửi được cho trợ lý — thử lại.'));
    } finally {
      setPending(null);
      setSending(false);
    }
  };

  const familyNames = useMemo(() => {
    const names = new Map<number, string | null>();
    let family: string | null = null;
    item?.lines.forEach((line) => {
      names.set(line.lineNo, family);
      if (!line.sameAsAbove && line.name) family = line.name;
    });
    return names;
  }, [item]);

  const zoomImages = (urls: string[], index: number) =>
    setZoom({ slides: urls.map((src) => ({ src })), index });

  // ---------------------------------------------------------------------- hiển thị

  const status = item ? IMPORT_STATUS[item.status] : null;
  const reviewing = item?.status === 'NeedsReview';
  const counts = item ? lineCounts(item) : null;
  const blockers = item ? commitBlockers(item) : [];
  const mismatch = item ? totalMismatch(item) : null;
  const productImages = item?.productImages ?? [];
  const invoiceUrls = (item?.images ?? []).map(getStorageUrl);
  const productUrls = productImages.map((p) => getStorageUrl(p.url));

  const renderHeader = () => (
    <Box
      sx={{ px: 2, pt: 1.5, pb: 1, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Iconify
          icon="solar:bill-list-bold-duotone"
          width={24}
          sx={{ color: 'primary.main', flexShrink: 0 }}
        />
        <Typography variant="h6" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {item ? item.supplierName || item.supplierText || 'Chưa rõ nhà cung cấp' : 'Hoá đơn nhập'}
        </Typography>
        {status && (
          <Label color={status.color} sx={{ flexShrink: 0 }}>
            {status.label}
          </Label>
        )}
        {importId && (
          <Tooltip title="Mở trang duyệt đầy đủ">
            <IconButton
              size="small"
              onClick={() => onNavigate(paths.dashboard.pos.purchaseOrder.importDetails(importId))}
            >
              <Iconify icon="solar:square-top-down-linear" width={20} />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Đóng">
          <IconButton size="small" onClick={onClose}>
            <Iconify icon="mingcute:close-line" width={20} />
          </IconButton>
        </Tooltip>
      </Stack>

      {item && counts && item.lines.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {item.lines.length} dòng · {counts.matched} có mã
          {counts.skipped > 0 ? ` · ${counts.skipped} bỏ` : ''} · tổng{' '}
          <strong>{fCurrency(item.linesTotal)}</strong>
          {item.invoiceTotal ? ` / HĐ ${fCurrency(item.invoiceTotal)}` : ''}
          {item.invoiceNumber ? ` · số ${item.invoiceNumber}` : ''}
        </Typography>
      )}

      {item && renderActions()}
    </Box>
  );

  const renderActions = () => {
    if (!item) return null;
    if (item.status === 'Failed')
      return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="body2" color="error.main" sx={{ flex: 1 }}>
            {item.error || 'Không đọc được hoá đơn.'}
          </Typography>
          <LoadingButton
            size="small"
            variant="contained"
            loading={working}
            onClick={() => run(() => retryPurchaseImport(item.id), 'Không đọc lại được.')}
          >
            Đọc lại
          </LoadingButton>
        </Stack>
      );
    if (item.status === 'Committed' && item.purchaseOrderId)
      return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            Đã tạo phiếu nhập {item.purchaseOrderNumber ?? ''} (nháp).
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              onNavigate(paths.dashboard.pos.purchaseOrder.details(item.purchaseOrderId!))
            }
          >
            Xem phiếu
          </Button>
        </Stack>
      );
    if (!reviewing) return null;

    if (duplicateCommit)
      return (
        <Alert
          severity="warning"
          sx={{ mt: 1 }}
          action={
            <Stack direction="row" spacing={0.5}>
              <LoadingButton
                size="small"
                color="warning"
                variant="contained"
                loading={working}
                onClick={() => commit(true)}
              >
                Vẫn tạo
              </LoadingButton>
              <Button size="small" color="inherit" onClick={() => setDuplicateCommit(null)}>
                Thôi
              </Button>
            </Stack>
          }
        >
          {duplicateCommit}
        </Alert>
      );
    if (confirming)
      return (
        <Alert
          severity="info"
          sx={{ mt: 1 }}
          action={
            <Stack direction="row" spacing={0.5}>
              <LoadingButton
                size="small"
                variant="contained"
                loading={working}
                onClick={() => commit(false)}
              >
                Tạo phiếu
              </LoadingButton>
              <Button
                size="small"
                color="inherit"
                disabled={working}
                onClick={() => setConfirming(false)}
              >
                Thôi
              </Button>
            </Stack>
          }
        >
          Tạo phiếu nhập nháp từ hoá đơn này?
        </Alert>
      );

    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
          {blockers.join(' ')}
          {mismatch != null && blockers.length === 0
            ? `Tổng các dòng lệch hoá đơn ${fCurrency(Math.abs(mismatch))}.`
            : ''}
        </Typography>
        <Button
          size="small"
          color="inherit"
          disabled={working}
          onClick={() => run(() => cancelPurchaseImport(item.id), 'Không huỷ được.')}
        >
          Huỷ lần nhập
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={blockers.length > 0 || working}
          onClick={() => setConfirming(true)}
        >
          Tạo phiếu nhập
        </Button>
      </Stack>
    );
  };

  const renderLines = () => {
    if (!item) return null;
    if (item.status === 'Extracting')
      return (
        <Box sx={{ py: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Đang đọc hoá đơn…
          </Typography>
          <LinearProgress sx={{ mt: 1 }} />
        </Box>
      );
    if (item.lines.length === 0)
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
          Chưa có dòng nào.
        </Typography>
      );
    return (
      <Stack spacing={1} sx={{ py: 1.5 }}>
        {item.lines.map((line) => (
          <PurchaseImportDrawerLine
            key={line.lineNo}
            line={line}
            familyName={familyNames.get(line.lineNo)}
            productImages={productImages}
            editable={reviewing}
            busy={busyLine === line.lineNo}
            highlighted={highlight.includes(line.lineNo)}
            onSave={(patch) => saveLine(line.lineNo, patch)}
            onZoomImage={(url) => zoomImages([url], 0)}
          />
        ))}
      </Stack>
    );
  };

  const renderImages = () => {
    if (!item) return null;
    const lineOf = (imageId: string) => item.lines.find((l) => l.imageId === imageId)?.lineNo;
    return (
      <Stack spacing={2} sx={{ py: 1.5 }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            Tờ hoá đơn ({invoiceUrls.length})
          </Typography>
          <Box
            sx={{
              mt: 0.75,
              display: 'grid',
              gap: 1,
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            }}
          >
            {invoiceUrls.map((src, index) => (
              <Thumb
                key={src}
                src={src}
                caption={`H${index + 1}`}
                onClick={() => zoomImages(invoiceUrls, index)}
              />
            ))}
          </Box>
        </Box>
        <Box>
          <Stack direction="row" alignItems="center">
            <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
              Ảnh sản phẩm ({productImages.length})
            </Typography>
            {reviewing && (
              <Button
                size="small"
                startIcon={<Iconify icon="solar:gallery-add-linear" width={16} />}
                onClick={() => fileRef.current?.click()}
              >
                Thêm ảnh
              </Button>
            )}
          </Stack>
          {productImages.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Chưa có ảnh sản phẩm. Gửi ảnh chụp món hàng kèm lời nhắn (vd «ảnh này là dòng 3») để
              trợ lý gắn vào dòng và nhận ra mã.
            </Typography>
          ) : (
            <Box
              sx={{
                mt: 0.75,
                display: 'grid',
                gap: 1,
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              }}
            >
              {productImages.map((image, index) => {
                const lineNo = lineOf(image.id);
                return (
                  <Thumb
                    key={image.id}
                    src={productUrls[index]}
                    caption={`S${index + 1} · ${lineNo ? `dòng ${lineNo}` : 'chưa gắn'}`}
                    onClick={() => zoomImages(productUrls, index)}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      </Stack>
    );
  };

  const renderComposer = () => (
    <Box
      sx={{ px: 2, py: 1.25, borderTop: (theme) => `1px solid ${theme.palette.divider}` }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        addPhotos(Array.from(event.dataTransfer.files));
      }}
    >
      {sendError && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setSendError(null)}>
          {sendError}
        </Alert>
      )}
      {photos.length > 0 && (
        <Stack direction="row" spacing={0.75} sx={{ mb: 1 }}>
          {photos.map((photo, index) => (
            <Box key={photo.preview} sx={{ position: 'relative' }}>
              <Box
                component="img"
                src={photo.preview}
                alt=""
                sx={{ width: 52, height: 52, borderRadius: 1, objectFit: 'cover' }}
              />
              <IconButton
                size="small"
                aria-label="Bỏ ảnh"
                onClick={() => clearPhotos((_, i) => i !== index)}
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  p: 0.25,
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                }}
              >
                <Iconify icon="mingcute:close-line" width={12} />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <Tooltip title={`Gửi ảnh sản phẩm (tối đa ${MAX_PHOTOS_PER_MESSAGE})`}>
          <span>
            <IconButton
              disabled={sending || photos.length >= MAX_PHOTOS_PER_MESSAGE}
              onClick={() => fileRef.current?.click()}
            >
              <Badge badgeContent={photos.length} color="primary">
                <Iconify icon="solar:camera-add-linear" width={22} />
              </Badge>
            </IconButton>
          </span>
        </Tooltip>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          value={draft}
          disabled={!item || item.status === 'Extracting'}
          placeholder="Nhắn trợ lý về hoá đơn này: «dòng 3 là máy sấy cute», «đơn này nhập rồi, đối chiếu lại»…"
          onChange={(event) => setDraft(event.target.value)}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (files.some((f) => f.type.startsWith('image/'))) {
              event.preventDefault();
              addPhotos(files);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send(draft);
            }
          }}
        />
        <LoadingButton
          variant="contained"
          loading={sending}
          disabled={!draft.trim() && photos.length === 0}
          onClick={() => send(draft)}
          sx={{ minWidth: 0, px: 1.5 }}
          aria-label="Gửi"
        >
          <Iconify icon="iconamoon:send-fill" width={20} />
        </LoadingButton>
      </Stack>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          addPhotos(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </Box>
  );

  return (
    <Drawer
      anchor="right"
      open={!!importId}
      onClose={onClose}
      sx={{ zIndex: DRAWER_Z }}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 560 }, display: 'flex', flexDirection: 'column' },
      }}
    >
      {renderHeader()}

      {loadError && !item && (
        <Alert severity="error" sx={{ m: 2 }}>
          {loadError}
        </Alert>
      )}
      {!item && !loadError && <LinearProgress sx={{ mx: 2, my: 3 }} />}

      {item && (
        <>
          {item.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mx: 2, mt: 1 }}>
              {item.warnings.slice(0, 3).map((w) => (
                <Typography key={w} variant="body2">
                  {w}
                </Typography>
              ))}
            </Alert>
          )}
          {actionError && (
            <Alert severity="error" sx={{ mx: 2, mt: 1 }} onClose={() => setActionError(null)}>
              {actionError}
            </Alert>
          )}

          <Tabs
            value={tab}
            onChange={(_, value: DrawerTab) => setTab(value)}
            sx={{ px: 2, flexShrink: 0 }}
          >
            <Tab value="lines" label={`Dòng hàng (${item.lines.length})`} />
            <Tab value="images" label={`Ảnh (${item.images.length + productImages.length})`} />
            <Tab value="chat" label={`Trao đổi${messages.length ? ` (${messages.length})` : ''}`} />
          </Tabs>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2 }}>
            {tab === 'lines' && renderLines()}
            {tab === 'images' && renderImages()}
            {tab === 'chat' && (
              <PurchaseImportConversation
                messages={messages}
                pending={pending}
                duplicates={duplicates}
                onExample={(text) => setDraft(text)}
                onZoomImage={(url) => zoomImages([url], 0)}
                onNavigate={onNavigate}
              />
            )}
          </Box>

          {renderComposer()}
        </>
      )}

      <Lightbox
        open={!!zoom}
        index={zoom?.index ?? 0}
        slides={zoom?.slides ?? []}
        close={() => setZoom(null)}
        disabledSlideshow
        styles={{ root: { zIndex: DRAWER_POPPER_Z + 100 } }}
      />
    </Drawer>
  );
}

// ----------------------------------------------------------------------

function Thumb({ src, caption, onClick }: { src: string; caption: string; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        cursor: 'zoom-in',
        borderRadius: 1.5,
        overflow: 'hidden',
        border: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.neutral',
      }}
    >
      <Box
        component="img"
        src={src}
        alt={caption}
        sx={{ width: 1, height: 120, objectFit: 'cover', display: 'block' }}
      />
      <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.5 }} noWrap>
        {caption}
      </Typography>
    </Box>
  );
}
