'use client';

import { useId, useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';

import { useResponsive } from 'src/hooks/use-responsive';

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
  pushPurchaseImportToKiotViet,
  getPurchaseImportCapabilities,
  getPurchaseImportConversation,
  getPurchaseImportSupplierOverview,
} from 'src/api/purchase-imports';

import type {
  IPurchaseImport,
  IPurchaseImportLine,
  IPurchaseImportMessage,
  IPurchaseImportDuplicate,
  IUpdatePurchaseImportLineRequest,
  IPurchaseImportSupplierOverview,
} from 'src/types/purchase-import';

import { usePurchaseAccess } from '../purchase-order/purchase-access';
import PurchaseImportImagesPanel from './purchase-import-images-panel';
import PurchaseImportConversation from './purchase-import-conversation';
import PurchaseImportFormLines from './purchase-import-form-lines';
import PurchaseImportHeaderForm from './purchase-import-header-form';
import PurchaseImportSupplierPanel from './purchase-import-supplier-panel';
import PurchaseImportSupplierOverview from './purchase-import-supplier-overview';
import PurchaseImportComposer, { type ComposerPhoto } from './purchase-import-composer';
import PurchaseImportDrawerLine, { DRAWER_POPPER_Z } from './purchase-import-drawer-line';
import PurchaseImportNewProductsDialog from './purchase-import-new-products-dialog';
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
// Drawer duyệt nhanh một lần nhập từ ảnh (mở từ thẻ hoá đơn trong chat / cột "Phiên nhập"). Màn vừa (iPad): 2 cột dòng
// hàng (tab Ảnh) | trao đổi. Màn rộng: 3 cột — ảnh hoá
// đơn + ảnh sản phẩm | dòng hàng theo đúng hoá đơn (dòng cùng loại "như trên" gom nhóm), nhà cung cấp, tích dòng để tạo
// mã mới | trò chuyện với trợ lý (câu tự do + ảnh sản phẩm, trợ lý sửa lần nhập). Màn hẹp: 3 tab. Trang duyệt đầy đủ mở
// từ nút ở đầu drawer.
// ----------------------------------------------------------------------

const DRAWER_Z = 1450;
const POLL_MS = 3000;
const HIGHLIGHT_MS = 5000;
const MAX_PHOTOS_PER_MESSAGE = 5;

type DrawerTab = 'lines' | 'images' | 'chat';
type SideTab = 'chat' | 'images';

type Props = {
  importId: string | null;
  onClose: () => void;
  /** Mở trang trong dashboard (drawer đóng theo). */
  onNavigate: (href: string) => void;
  /**
   * <c>page</c>: trang duyệt đầy đủ — cùng khung (trao đổi với trợ lý, NCC, tạo phiếu…) nhưng không phải drawer, các
   * dòng là form phiếu nhập (chọn sản phẩm tại ô, sửa số, giá theo gói) kèm ô kho / số / ngày / tổng hoá đơn.
   */
  variant?: 'drawer' | 'page';
};

export default function PurchaseImportDrawer({
  importId,
  onClose,
  onNavigate,
  variant = 'drawer',
}: Props) {
  const page = variant === 'page';
  const [sideTab, setSideTab] = useState<SideTab>('chat');
  // Trang: ẩn cột trao đổi / ảnh để form dòng rộng hết khung.
  const [sideOpen, setSideOpen] = useState(true);
  const instanceId = useId();
  const wide = useResponsive('up', 'lg');
  const medium = useResponsive('up', 'md');
  const access = usePurchaseAccess();
  const [item, setItem] = useState<IPurchaseImport | null>(null);
  const [messages, setMessages] = useState<IPurchaseImportMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [tab, setTab] = useState<DrawerTab>('lines');

  const [busyLine, setBusyLine] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmReread, setConfirmReread] = useState(false);
  const [duplicateCommit, setDuplicateCommit] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [creatingProducts, setCreatingProducts] = useState(false);
  // Cửa hàng nối KiotViet + bật đẩy: tạo phiếu thì mã mới + phiếu nhập tạo luôn bên KiotViet.
  const [kiotViet, setKiotViet] = useState({ push: false, draft: true });
  // Lịch sử nhập của NCC (cả lịch sử): thẻ tổng quan + lịch sử từng mã trên dòng.
  const [overview, setOverview] = useState<IPurchaseImportSupplierOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [draft, setDraft] = useState('');
  const [photos, setPhotos] = useState<ComposerPhoto[]>([]);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<{ text: string; images: string[] } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<IPurchaseImportDuplicate[]>([]);
  const [highlight, setHighlight] = useState<number[]>([]);
  const [zoom, setZoom] = useState<{ slides: { src: string }[]; index: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getPurchaseImportCapabilities()
      .then(
        (c) => alive && setKiotViet({ push: !!c.kiotVietPush, draft: c.kiotVietDraft !== false })
      )
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Ảnh xem trước (blob:) thu hồi khi bỏ ảnh, gửi xong hoặc đóng drawer.
  const photosRef = useRef<ComposerPhoto[]>([]);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);
  const clearPhotos = useCallback(
    (keep: (photo: ComposerPhoto, index: number) => boolean) =>
      setPhotos((current) => {
        current.filter((p, i) => !keep(p, i)).forEach((p) => URL.revokeObjectURL(p.preview));
        return current.filter(keep);
      }),
    []
  );

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
    setSelected([]);
    setConfirming(false);
    setDuplicateCommit(null);
    setActionError(null);
  }, [importId, clearPhotos]);

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

  // Đọc lại tổng quan khi đổi NCC / dòng đổi gợi ý (updatedAt đổi); bỏ qua lúc đang đọc ảnh.
  const overviewKey =
    item && item.supplierId && item.status !== 'Extracting'
      ? `${item.id}|${item.supplierId}|${item.updatedAt}`
      : null;
  useEffect(() => {
    if (!overviewKey || !item) {
      setOverview(null);
      return undefined;
    }
    let alive = true;
    setOverviewLoading(true);
    getPurchaseImportSupplierOverview(item.id)
      .then((data) => alive && setOverview(data))
      .catch(() => alive && setOverview(null))
      .finally(() => alive && setOverviewLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewKey]);
  const historyOf = useMemo(
    () => new Map((overview?.products ?? []).map((p) => [p.productId, p])),
    [overview]
  );

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

  const reviewing = item?.status === 'NeedsReview';
  const canCreateProducts = access.canCreateProducts && reviewing;
  const selectable = useCallback(
    (line: IPurchaseImportLine) =>
      canCreateProducts && line.status !== 'Skipped' && !line.productId && !line.newProductName,
    [canCreateProducts]
  );

  // Dòng đã có mã / đã bỏ thì không còn tích được.
  useEffect(() => {
    if (!item) return;
    setSelected((current) =>
      current.filter((no) => item.lines.some((l) => l.lineNo === no && selectable(l)))
    );
  }, [item, selectable]);

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

  const send = async () => {
    const message = draft.trim();
    if (!importId || sending || (!message && photos.length === 0)) return;
    const sentPhotos = photos;
    setSending(true);
    setSendError(null);
    if (!medium) setTab('chat');
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

  /** Tên nhóm phía trên của từng dòng (dòng "như trên" dùng để gợi ý tìm / tạo mã). */
  const aboveNames = useMemo(() => {
    const names = new Map<number, string | null>();
    let family: string | null = null;
    item?.lines.forEach((line) => {
      names.set(line.lineNo, family);
      if (!line.sameAsAbove && line.name) family = line.name;
    });
    return names;
  }, [item]);

  const familyOf = useCallback(
    (line: IPurchaseImportLine) =>
      (line.sameAsAbove ? aboveNames.get(line.lineNo) : line.name) || line.rawText,
    [aboveNames]
  );

  /** Dòng theo đúng thứ tự hoá đơn; dòng "như trên" gom vào nhóm của dòng có tên phía trên. */
  const groups = useMemo(() => {
    const out: { key: number; family: string | null; lines: IPurchaseImportLine[] }[] = [];
    item?.lines.forEach((line) => {
      if (line.sameAsAbove && out.length > 0) out[out.length - 1].lines.push(line);
      else out.push({ key: line.lineNo, family: line.name ?? null, lines: [line] });
    });
    return out;
  }, [item]);

  const zoomImages = (urls: string[], index: number) =>
    setZoom({ slides: urls.map((src) => ({ src })), index });

  // ---------------------------------------------------------------------- hiển thị

  const status = item ? IMPORT_STATUS[item.status] : null;
  const counts = item ? lineCounts(item) : null;
  const blockers = item ? commitBlockers(item) : [];
  const mismatch = item ? totalMismatch(item) : null;
  const unsuggested =
    item?.lines.filter((l) => selectable(l) && l.candidates.length === 0).map((l) => l.lineNo) ??
    [];

  const renderHeader = () => (
    <Box
      sx={{
        px: 2,
        pt: 1.5,
        pb: 1,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        flexShrink: 0,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Iconify
          icon="solar:bill-list-bold-duotone"
          width={24}
          sx={{ color: 'primary.main', flexShrink: 0 }}
        />
        <Typography variant="h6" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {item
            ? `Hoá đơn ${item.supplierName || item.supplierText || 'nhập hàng'}`
            : 'Hoá đơn nhập'}
          {item?.invoiceNumber ? ` · số ${item.invoiceNumber}` : ''}
        </Typography>
        {status && (
          <Label color={status.color} sx={{ flexShrink: 0 }}>
            {status.label}
          </Label>
        )}
        {page && medium && (
          <Button
            size="small"
            color="inherit"
            onClick={() => setSideOpen((v) => !v)}
            startIcon={<Iconify icon="solar:chat-round-dots-bold-duotone" width={18} />}
            sx={{ flexShrink: 0 }}
          >
            {sideOpen ? 'Ẩn trao đổi' : 'Hiện trao đổi'}
          </Button>
        )}
        {importId && !page && (
          <Tooltip title="Mở trang duyệt đầy đủ">
            <IconButton
              size="small"
              onClick={() => onNavigate(paths.dashboard.pos.purchaseOrder.importDetails(importId))}
            >
              <Iconify icon="solar:square-top-down-linear" width={20} />
            </IconButton>
          </Tooltip>
        )}
        {!page && (
          <Tooltip title="Đóng">
            <IconButton size="small" onClick={onClose}>
              <Iconify icon="mingcute:close-line" width={20} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      {item && counts && item.lines.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {item.lines.length} dòng · {counts.matched} có mã
          {counts.skipped > 0 ? ` · ${counts.skipped} bỏ` : ''} · tổng{' '}
          <strong>{fCurrency(item.linesTotal)}</strong>
          {item.invoiceTotal ? ` / hoá đơn ghi ${fCurrency(item.invoiceTotal)}` : ''}
        </Typography>
      )}
    </Box>
  );

  const renderActions = () => {
    if (!item) return null;
    if (item.status === 'Failed')
      return (
        <Stack direction="row" spacing={1} alignItems="center">
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
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ flex: 1 }}>
              Đã tạo phiếu nhập {item.purchaseOrderNumber ?? ''} (nháp).
              {item.kiotVietPush === 'Pushed' && (
                <>
                  {' '}
                  Bên KiotViet: <strong>{item.kiotVietPurchaseOrderCode}</strong>
                  {kiotViet.draft
                    ? ' (phiếu tạm — hoàn thành bên KiotViet để cộng tồn, tính giá vốn)'
                    : ''}
                  .
                </>
              )}
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
          {item.kiotVietPush === 'Failed' && (
            <Alert
              severity="warning"
              action={
                <LoadingButton
                  size="small"
                  color="warning"
                  variant="contained"
                  loading={working}
                  onClick={() =>
                    run(async () => {
                      await pushPurchaseImportToKiotViet(item.id);
                    }, 'Chưa đẩy được sang KiotViet.')
                  }
                >
                  Đẩy lại
                </LoadingButton>
              }
            >
              Chưa đẩy được phiếu sang KiotViet: {item.kiotVietPushError || 'lỗi không rõ'}
            </Alert>
          )}
        </Stack>
      );
    if (!reviewing) return null;
    if (duplicateCommit)
      return (
        <Alert
          severity="warning"
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
    if (confirmReread)
      return (
        <Alert
          severity="info"
          action={
            <Stack direction="row" spacing={0.5}>
              <LoadingButton
                size="small"
                variant="contained"
                loading={working}
                onClick={() =>
                  run(async () => {
                    await retryPurchaseImport(item.id);
                    setConfirmReread(false);
                  }, 'Không đọc lại được.')
                }
              >
                Đọc lại
              </LoadingButton>
              <Button
                size="small"
                color="inherit"
                disabled={working}
                onClick={() => setConfirmReread(false)}
              >
                Thôi
              </Button>
            </Stack>
          }
        >
          Đọc lại ảnh hoá đơn và gợi ý mã lại từ đầu? Mã đã chọn / mã mới đã đặt sẽ được gợi ý lại.
        </Alert>
      );
    if (confirming)
      return (
        <Alert
          severity="info"
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
          {kiotViet.push &&
            ` Mã mới và phiếu nhập${kiotViet.draft ? ' (phiếu tạm)' : ''} được tạo luôn bên KiotViet.`}
        </Alert>
      );
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
          {blockers.join(' ')}
          {mismatch != null && blockers.length === 0
            ? `Tổng các dòng lệch hoá đơn ${fCurrency(Math.abs(mismatch))}.`
            : ''}
        </Typography>
        {item.images.length > 0 && (
          <Button
            size="small"
            color="inherit"
            disabled={working}
            onClick={() => setConfirmReread(true)}
          >
            Đọc lại
          </Button>
        )}
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

  const renderSelectionBar = () => {
    if (!item || !canCreateProducts || !item.lines.some(selectable)) return null;
    return (
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          py: 0.75,
          px: 1,
          borderRadius: 1,
          bgcolor: selected.length > 0 ? 'primary.lighter' : 'background.neutral',
        }}
      >
        <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }}>
          {selected.length > 0
            ? `${selected.length} dòng đã tích — đặt mã mới`
            : 'Hàng chưa có trong danh mục? Tích dòng để đặt mã mới (tạo khi tạo phiếu nhập).'}
        </Typography>
        {selected.length === 0 && unsuggested.length > 0 && (
          <Button size="small" color="inherit" onClick={() => setSelected(unsuggested)}>
            Tích {unsuggested.length} dòng chưa có gợi ý
          </Button>
        )}
        {selected.length > 0 && (
          <>
            <Button size="small" color="inherit" onClick={() => setSelected([])}>
              Bỏ tích
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" width={16} />}
              onClick={() => setCreatingProducts(true)}
            >
              Đặt mã mới ({selected.length})
            </Button>
          </>
        )}
      </Stack>
    );
  };

  const renderLine = (line: IPurchaseImportLine) => (
    <PurchaseImportDrawerLine
      key={line.lineNo}
      line={line}
      familyName={aboveNames.get(line.lineNo)}
      productImages={item?.productImages ?? []}
      history={historyOf.get(line.productId ?? line.candidates[0]?.productId ?? '') ?? null}
      editable={!!reviewing}
      busy={busyLine === line.lineNo}
      highlighted={highlight.includes(line.lineNo)}
      onSave={(patch) => saveLine(line.lineNo, patch)}
      onZoomImage={(url) => zoomImages([url], 0)}
      selectable={selectable(line)}
      canCreateProduct={!!canCreateProducts}
      selected={selected.includes(line.lineNo)}
      onToggleSelect={() =>
        setSelected((current) =>
          current.includes(line.lineNo)
            ? current.filter((n) => n !== line.lineNo)
            : [...current, line.lineNo]
        )
      }
    />
  );

  const renderLines = () => {
    if (!item) return null;
    if (item.status === 'Extracting')
      return (
        <Box sx={{ py: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Đang đọc hoá đơn và tìm mã hàng…
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
      <Stack spacing={1}>
        {groups.map((group) =>
          group.lines.length === 1 ? (
            renderLine(group.lines[0])
          ) : (
            <Box
              key={group.key}
              sx={{
                pl: 1,
                borderLeft: (theme) => `3px solid ${theme.palette.primary.light}`,
                borderRadius: 0.5,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.5 }}
              >
                <strong>{group.family || 'Cùng loại'}</strong> · {group.lines.length} dòng cùng
                loại, khác bậc giá
              </Typography>
              <Stack spacing={1}>{group.lines.map(renderLine)}</Stack>
            </Box>
          )
        )}
      </Stack>
    );
  };

  /** Cột giữa: NCC, cảnh báo, nút tạo phiếu, thanh tích tạo mã, các dòng. */
  const renderReview = () =>
    item && (
      <Stack spacing={1.25} sx={{ py: 1.5 }}>
        <PurchaseImportSupplierPanel
          key={item.id}
          item={item}
          editable={!!reviewing}
          popperZIndex={DRAWER_POPPER_Z}
          onChanged={changed}
        />
        {page && item.status !== 'Extracting' && (
          <PurchaseImportHeaderForm
            key={item.id}
            item={item}
            editable={!!reviewing}
            onChanged={changed}
            onError={setActionError}
          />
        )}
        {item.supplierId && item.status !== 'Extracting' && (
          <PurchaseImportSupplierOverview
            supplierName={item.supplierName}
            overview={overview}
            loading={overviewLoading}
            onOpenOrder={(orderId) =>
              onNavigate(paths.dashboard.pos.purchaseOrder.details(orderId))
            }
          />
        )}
        {item.warnings.length > 0 && (
          <Alert severity="warning">
            {item.warnings.slice(0, 4).map((w) => (
              <Typography key={w} variant="body2">
                {w}
              </Typography>
            ))}
          </Alert>
        )}
        {actionError && (
          <Alert severity="error" onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}
        {renderActions()}
        {renderSelectionBar()}
        {page && item.status !== 'Extracting' && item.lines.length > 0 ? (
          <PurchaseImportFormLines
            item={item}
            editable={!!reviewing}
            busyLine={busyLine}
            highlight={highlight}
            familyName={familyOf}
            history={(line) =>
              historyOf.get(line.productId ?? line.candidates[0]?.productId ?? '') ?? null
            }
            canCreateProduct={!!canCreateProducts}
            selectable={selectable}
            selected={selected}
            onToggleSelect={(lineNo) =>
              setSelected((current) =>
                current.includes(lineNo)
                  ? current.filter((n) => n !== lineNo)
                  : [...current, lineNo]
              )
            }
            onSave={saveLine}
          />
        ) : (
          renderLines()
        )}
      </Stack>
    );

  const renderConversation = () => (
    <PurchaseImportConversation
      messages={messages}
      pending={pending}
      duplicates={duplicates}
      onExample={(text) => setDraft(text)}
      onZoomImage={(url) => zoomImages([url], 0)}
      onNavigate={onNavigate}
    />
  );

  const renderComposer = () => (
    <PurchaseImportComposer
      draft={draft}
      onDraftChange={setDraft}
      photos={photos}
      maxPhotos={MAX_PHOTOS_PER_MESSAGE}
      onAddFiles={addPhotos}
      onRemovePhoto={(index) => clearPhotos((_, i) => i !== index)}
      fileRef={fileRef}
      sending={sending}
      disabled={!item || item.status === 'Extracting'}
      error={sendError}
      onDismissError={() => setSendError(null)}
      onSend={send}
    />
  );

  const renderImages = () =>
    item && (
      <PurchaseImportImagesPanel
        item={item}
        canAddPhotos={!!reviewing}
        onAddPhotos={() => fileRef.current?.click()}
        onZoom={zoomImages}
      />
    );

  const renderBody = () => {
    if (!item)
      return loadError ? (
        <Alert severity="error" sx={{ m: 2 }}>
          {loadError}
        </Alert>
      ) : (
        <LinearProgress sx={{ mx: 2, my: 3 }} />
      );

    if (page && medium)
      return (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: !sideOpen
              ? 'minmax(0, 1fr)'
              : wide
                ? 'minmax(0, 1fr) 360px'
                : 'minmax(0, 1fr) 320px',
          }}
        >
          <Box sx={{ minHeight: 0, overflowY: 'auto', px: 2 }}>{renderReview()}</Box>
          {sideOpen && (
            <Box
              sx={{
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
              }}
            >
              <Tabs
                value={sideTab}
                onChange={(_, value: SideTab) => setSideTab(value)}
                sx={{ px: 2, flexShrink: 0 }}
              >
                <Tab
                  value="chat"
                  label={`Trao đổi với trợ lý${messages.length ? ` (${messages.length})` : ''}`}
                />
                <Tab
                  value="images"
                  label={`Ảnh (${item.images.length + (item.productImages?.length ?? 0)})`}
                />
              </Tabs>
              {sideTab === 'images' ? (
                <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>{renderImages()}</Box>
              ) : (
                <>
                  <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2 }}>
                    {renderConversation()}
                  </Box>
                  {renderComposer()}
                </>
              )}
            </Box>
          )}
        </Box>
      );

    if (wide)
      return (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '300px minmax(0, 1fr) 380px',
          }}
        >
          <Box
            sx={{
              minHeight: 0,
              overflowY: 'auto',
              p: 2,
              borderRight: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            {renderImages()}
          </Box>
          <Box sx={{ minHeight: 0, overflowY: 'auto', px: 2 }}>{renderReview()}</Box>
          <Box
            sx={{
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, pt: 1.5 }}>
              <Iconify
                icon="solar:chat-round-dots-bold-duotone"
                width={20}
                sx={{ color: 'primary.main' }}
              />
              <Typography variant="subtitle2">Trao đổi với trợ lý</Typography>
            </Stack>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2 }}>
              {renderConversation()}
            </Box>
            {renderComposer()}
          </Box>
        </Box>
      );

    if (medium)
      return (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 360px',
          }}
        >
          <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Tabs
              value={tab === 'chat' ? 'lines' : tab}
              onChange={(_, value: DrawerTab) => setTab(value)}
              sx={{ px: 2, flexShrink: 0 }}
            >
              <Tab value="lines" label={`Dòng hàng (${item.lines.length})`} />
              <Tab
                value="images"
                label={`Ảnh (${item.images.length + (item.productImages?.length ?? 0)})`}
              />
            </Tabs>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2 }}>
              {tab === 'images' ? <Box sx={{ py: 1.5 }}>{renderImages()}</Box> : renderReview()}
            </Box>
          </Box>
          <Box
            sx={{
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, pt: 1.5 }}>
              <Iconify
                icon="solar:chat-round-dots-bold-duotone"
                width={20}
                sx={{ color: 'primary.main' }}
              />
              <Typography variant="subtitle2">Trao đổi với trợ lý</Typography>
            </Stack>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2 }}>
              {renderConversation()}
            </Box>
            {renderComposer()}
          </Box>
        </Box>
      );

    return (
      <>
        <Tabs
          value={tab}
          onChange={(_, value: DrawerTab) => setTab(value)}
          sx={{ px: 2, flexShrink: 0 }}
        >
          <Tab value="lines" label={`Dòng hàng (${item.lines.length})`} />
          <Tab
            value="images"
            label={`Ảnh (${item.images.length + (item.productImages?.length ?? 0)})`}
          />
          <Tab value="chat" label={`Trao đổi${messages.length ? ` (${messages.length})` : ''}`} />
        </Tabs>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2 }}>
          {tab === 'lines' && renderReview()}
          {tab === 'images' && <Box sx={{ py: 1.5 }}>{renderImages()}</Box>}
          {tab === 'chat' && renderConversation()}
        </Box>
        {renderComposer()}
      </>
    );
  };

  const dialogs = (
    <>
      {item && (
        <PurchaseImportNewProductsDialog
          open={creatingProducts}
          item={item}
          lineNos={selected}
          familyName={familyOf}
          zIndex={DRAWER_POPPER_Z}
          onClose={() => setCreatingProducts(false)}
          onSaved={(next, saved) => {
            changed(next);
            setHighlight(saved);
            setSelected((current) => current.filter((n) => !saved.includes(n)));
          }}
        />
      )}

      <Lightbox
        open={!!zoom}
        index={zoom?.index ?? 0}
        slides={zoom?.slides ?? []}
        close={() => setZoom(null)}
        disabledSlideshow
        styles={{ root: { zIndex: DRAWER_POPPER_Z + 100 } }}
      />
    </>
  );

  if (page)
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: { xs: 'auto', md: 'calc(100dvh - 180px)' },
          minHeight: { md: 560 },
          borderRadius: 2,
          bgcolor: 'background.paper',
          boxShadow: (theme) => theme.customShadows?.card,
          overflow: 'hidden',
        }}
      >
        {renderHeader()}
        {renderBody()}
        {dialogs}
      </Box>
    );

  return (
    <Drawer
      anchor="right"
      open={!!importId}
      onClose={onClose}
      sx={{ zIndex: DRAWER_Z }}
      PaperProps={{
        sx: {
          width: wide ? 'min(1440px, 96vw)' : medium ? '96vw' : { xs: '100%', sm: 600 },
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {renderHeader()}
      {renderBody()}
      {dialogs}
    </Drawer>
  );
}
