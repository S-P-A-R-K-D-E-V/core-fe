'use client';

import { useId, useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';

import {
  getPurchaseImport,
  retryPurchaseImport,
  cancelPurchaseImport,
  commitPurchaseImport,
  updatePurchaseImportLine,
} from 'src/api/purchase-imports';

import type {
  IPurchaseImport,
  IPurchaseImportLine,
  IUpdatePurchaseImportLineRequest,
} from 'src/types/purchase-import';

import PurchaseImportProductPicker from './purchase-import-product-picker';
import {
  openPurchaseImportDrawer,
  PURCHASE_IMPORT_CHANGED_EVENT,
  announcePurchaseImportChange,
  type PurchaseImportChangedDetail,
} from './purchase-import-events';
import {
  lineCounts,
  issueLabel,
  IMPORT_STATUS,
  isLinePending,
  commitBlockers,
  hasNumberIssue,
  importErrorMessage,
  isDuplicateInvoice,
} from './purchase-import-utils';

// ----------------------------------------------------------------------
// Thẻ hoá đơn nhập trong khung chat trợ lý (khối "purchase-import"): tự tải lần nhập bằng quyền của người dùng, chọn mã
// cho các dòng chưa khớp, bỏ dòng, tạo phiếu nháp. Bấm thẻ / "Xem & trao đổi" → drawer duyệt nhanh bên phải (xem ảnh,
// nhắn trợ lý sửa lần nhập); trang duyệt đầy đủ mở từ drawer.
// ----------------------------------------------------------------------

const POLL_MS = 3000;

// Một lần nhập hiện ở nhiều tin (tin gửi ảnh, mỗi lần nhắn sửa dòng lại kèm thẻ mới) và trong drawer duyệt nhanh: nơi
// nào đổi / thẻ mới xuất hiện thì báo, các nơi khác của cùng lần nhập tải lại. Bỏ qua tin báo trong lúc cả loạt thẻ
// vừa mở (tải lịch sử).
const CHANGED_EVENT = PURCHASE_IMPORT_CHANGED_EVENT;
const SETTLE_MS = 1500;

type ChangedDetail = PurchaseImportChangedDetail;

const announceChange = announcePurchaseImportChange;
/** Khung chat ở zIndex 1400 — danh sách gợi ý phải nổi trên nó. */
const POPPER_Z = 1500;

type Props = {
  importId: string;
  /** Mở trang trong dashboard (đóng khung chat trên màn nhỏ). */
  onNavigate: (href: string) => void;
};

export default function PurchaseImportChatCard({ importId, onNavigate }: Props) {
  const [item, setItem] = useState<IPurchaseImport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [busyLine, setBusyLine] = useState<number | null>(null);
  const [changing, setChanging] = useState<number | null>(null);
  const [showMatched, setShowMatched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const instanceId = useId();
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    const onChanged = (event: Event) => {
      const { detail } = event as CustomEvent<ChangedDetail>;
      if (detail?.importId !== importId || detail.source === instanceId) return;
      if (Date.now() - mountedAt.current < SETTLE_MS) return;
      setPollKey((k) => k + 1);
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    // Thẻ mới (vd câu trả lời sau khi nhắn sửa dòng) → thẻ cũ của cùng lần nhập cập nhật theo.
    announceChange(importId, instanceId);
    return () => window.removeEventListener(CHANGED_EVENT, onChanged);
  }, [importId, instanceId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const data = await getPurchaseImport(importId);
        if (cancelled) return;
        setItem(data);
        setLoadError(null);
        if (data.status === 'Extracting') timer = setTimeout(tick, POLL_MS);
      } catch (error) {
        if (!cancelled) setLoadError(importErrorMessage(error, 'Không xem được lần nhập này (cần quyền nhập hàng).'));
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [importId, pollKey]);

  const saveLine = useCallback(
    async (lineNo: number, patch: IUpdatePurchaseImportLineRequest) => {
      setBusyLine(lineNo);
      setActionError(null);
      try {
        setItem(await updatePurchaseImportLine(importId, lineNo, patch));
        setChanging(null);
        announceChange(importId, instanceId);
      } catch (error) {
        setActionError(importErrorMessage(error, 'Không lưu được dòng.'));
      } finally {
        setBusyLine(null);
      }
    },
    [importId, instanceId]
  );

  const run = async (action: () => Promise<void>, fallback: string) => {
    setWorking(true);
    setActionError(null);
    try {
      await action();
      announceChange(importId, instanceId);
    } catch (error) {
      setActionError(importErrorMessage(error, fallback));
    } finally {
      setWorking(false);
    }
  };

  const commit = (allowDuplicate: boolean) =>
    run(async () => {
      try {
        await commitPurchaseImport(importId, allowDuplicate);
        setConfirming(false);
        setDuplicate(null);
        setPollKey((k) => k + 1);
      } catch (error) {
        if (!allowDuplicate && isDuplicateInvoice(error)) {
          setConfirming(false);
          setDuplicate(importErrorMessage(error, 'Hoá đơn này đã được nhập.'));
          return;
        }
        throw error;
      }
    }, 'Không tạo được phiếu nhập.');

  if (loadError && !item) {
    return (
      <Card variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {loadError}
        </Typography>
      </Card>
    );
  }

  if (!item) {
    return (
      <Card variant="outlined" sx={{ p: 1.5 }}>
        <LinearProgress />
      </Card>
    );
  }

  const status = IMPORT_STATUS[item.status];
  const reviewing = item.status === 'NeedsReview';
  const active = item.lines.filter((l) => l.status !== 'Skipped');
  const pending = item.lines.filter((l) => isLinePending(l) || l.lineNo === changing);
  const settled = active.filter((l) => !pending.includes(l));
  const counts = lineCounts(item);
  const blockers = commitBlockers(item);

  const renderPendingLine = (line: IPurchaseImportLine) => {
    const busy = busyLine === line.lineNo;
    const choices = line.candidates.filter((c) => c.productId !== line.productId).slice(0, 2);
    return (
      <Box
        key={line.lineNo}
        sx={{ p: 1, borderRadius: 1, border: (theme) => `1px dashed ${theme.palette.divider}` }}
      >
        <Stack direction="row" spacing={1} alignItems="baseline">
          <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            Dòng {line.lineNo} · {line.name || line.rawText}
          </Typography>
          <Typography variant="caption" sx={{ flexShrink: 0, color: 'text.secondary' }}>
            {line.quantity ?? '?'} × {line.unitPrice ? fCurrency(line.unitPrice) : '?'}
          </Typography>
        </Stack>
        {hasNumberIssue(line) && (
          <Typography variant="caption" sx={{ color: 'warning.main', display: 'block' }}>
            {line.issues.filter((i) => i !== 'unit_converted').map(issueLabel).join(' · ')} — nhắn trợ lý
            trong «Xem & trao đổi»
          </Typography>
        )}

        <Stack spacing={0.75} sx={{ mt: 0.75 }}>
          {choices.map((c, index) => (
            <Stack key={c.productId} direction="row" spacing={1} alignItems="center">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {index === 0 && c.productId === line.suggestedProductId && (
                    <Box component="span" sx={{ color: 'warning.main', mr: 0.5 }}>
                      Có thể là
                    </Box>
                  )}
                  <strong>{c.code}</strong> — {c.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {c.reason}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="soft"
                color="primary"
                disabled={!reviewing || busy}
                onClick={() => saveLine(line.lineNo, { productId: c.productId })}
                sx={{ flexShrink: 0 }}
              >
                Đúng
              </Button>
            </Stack>
          ))}

          <Stack direction="row" spacing={0.75} alignItems="center">
            <PurchaseImportProductPicker
              defaultKeyword={line.name ?? undefined}
              disabled={!reviewing || busy}
              popperZIndex={POPPER_Z}
              onPick={(product) => saveLine(line.lineNo, { productId: product.id })}
            />
            {line.lineNo === changing ? (
              <Button size="small" color="inherit" onClick={() => setChanging(null)} sx={{ flexShrink: 0 }}>
                Giữ mã cũ
              </Button>
            ) : (
              <Button
                size="small"
                color="inherit"
                disabled={!reviewing || busy}
                onClick={() => saveLine(line.lineNo, { skip: true })}
                sx={{ flexShrink: 0 }}
              >
                Bỏ dòng
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
    );
  };

  return (
    <Card variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        role="button"
        tabIndex={0}
        title="Mở drawer duyệt nhanh"
        onClick={() => openPurchaseImportDrawer(item.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPurchaseImportDrawer(item.id);
          }
        }}
        sx={{ cursor: 'pointer', borderRadius: 1, '&:hover .import-open-hint': { color: 'primary.main' } }}
      >
        <Iconify icon="solar:bill-list-bold-duotone" width={22} sx={{ color: 'primary.main', flexShrink: 0 }} />
        <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {item.supplierName || item.supplierText || 'Chưa rõ nhà cung cấp'}
          {item.invoiceNumber ? ` · số ${item.invoiceNumber}` : ''}
        </Typography>
        <Label color={status.color} sx={{ flexShrink: 0 }}>
          {status.label}
        </Label>
        <Iconify
          className="import-open-hint"
          icon="solar:sidebar-minimalistic-linear"
          width={18}
          sx={{ color: 'text.disabled', flexShrink: 0, transform: 'scaleX(-1)' }}
        />
      </Stack>

      {item.status === 'Extracting' && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Đang đọc hoá đơn…
          </Typography>
          <LinearProgress sx={{ mt: 0.5 }} />
        </Box>
      )}

      {item.status !== 'Extracting' && item.lines.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {item.lines.length} dòng · {counts.matched} đã có mã
          {counts.skipped > 0 ? ` · ${counts.skipped} bỏ` : ''} · tổng {fCurrency(item.linesTotal)}
          {item.invoiceTotal ? ` / HĐ ${fCurrency(item.invoiceTotal)}` : ''}
        </Typography>
      )}

      {item.status === 'Failed' && (
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Typography variant="body2" color="error.main">
            {item.error || 'Không đọc được hoá đơn.'}
          </Typography>
          <Stack direction="row" spacing={1}>
            <LoadingButton
              size="small"
              variant="contained"
              loading={working}
              onClick={() => run(async () => {
                await retryPurchaseImport(item.id);
                setPollKey((k) => k + 1);
              }, 'Không đọc lại được.')}
            >
              Đọc lại
            </LoadingButton>
            <Button
              size="small"
              color="inherit"
              disabled={working}
              onClick={() => run(async () => {
                await cancelPurchaseImport(item.id);
                setPollKey((k) => k + 1);
              }, 'Không huỷ được.')}
            >
              Huỷ
            </Button>
          </Stack>
        </Stack>
      )}

      {reviewing && (
        <Stack spacing={1} sx={{ mt: 1 }}>
          {!item.supplierId && (
            <Typography variant="caption" sx={{ color: 'warning.main' }}>
              Chưa nhận ra nhà cung cấp — chọn trong màn duyệt để gợi ý mã theo lịch sử nhập.
            </Typography>
          )}

          {pending.map(renderPendingLine)}

          {settled.length > 0 && (
            <Box>
              <Button
                size="small"
                color="inherit"
                onClick={() => setShowMatched((v) => !v)}
                startIcon={<Iconify icon={showMatched ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'} />}
              >
                {settled.length} dòng đã có mã
              </Button>
              <Collapse in={showMatched} unmountOnExit>
                <Stack spacing={0.5} sx={{ pl: 1, pt: 0.5 }}>
                  {settled.map((line) => {
                    const chosen = line.candidates.find((c) => c.productId === line.productId);
                    return (
                      <Stack key={line.lineNo} direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" sx={{ flex: 1, minWidth: 0 }} noWrap>
                          {line.lineNo}. {line.name || line.rawText} →{' '}
                          <strong>{chosen ? `${chosen.code} ${chosen.name}` : 'đã chọn'}</strong>
                        </Typography>
                        <Button
                          size="small"
                          color="inherit"
                          sx={{ minWidth: 0, px: 0.75, flexShrink: 0 }}
                          onClick={() => setChanging(line.lineNo)}
                        >
                          Đổi
                        </Button>
                      </Stack>
                    );
                  })}
                </Stack>
              </Collapse>
            </Box>
          )}

          {actionError && (
            <Typography variant="caption" color="error.main">
              {actionError}
            </Typography>
          )}

          {duplicate && (
            <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'warning.lighter' }}>
              <Typography variant="body2">{duplicate}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                <LoadingButton size="small" variant="contained" color="warning" loading={working} onClick={() => commit(true)}>
                  Vẫn tạo phiếu
                </LoadingButton>
                <Button size="small" color="inherit" onClick={() => setDuplicate(null)}>
                  Thôi
                </Button>
              </Stack>
            </Box>
          )}

          {confirming ? (
            <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'background.neutral' }}>
              <Typography variant="body2">
                Tạo phiếu nhập <strong>nháp</strong> gồm {active.length} dòng, tổng {fCurrency(item.linesTotal)}? Chưa
                cộng tồn kho cho tới khi nhận hàng.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                <LoadingButton size="small" variant="contained" loading={working} onClick={() => commit(false)}>
                  Tạo phiếu
                </LoadingButton>
                <Button size="small" color="inherit" disabled={working} onClick={() => setConfirming(false)}>
                  Thôi
                </Button>
              </Stack>
            </Box>
          ) : (
            !duplicate && (
              <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                <Button size="small" color="inherit" onClick={() => openPurchaseImportDrawer(item.id)}>
                  Xem & trao đổi
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={blockers.length > 0}
                  title={blockers.join(' ')}
                  onClick={() => setConfirming(true)}
                >
                  Tạo phiếu nhập
                </Button>
              </Stack>
            )
          )}
          {blockers.length > 0 && !confirming && (
            <Typography variant="caption" color="text.secondary">
              {blockers.join(' ')}
            </Typography>
          )}
        </Stack>
      )}

      {item.status === 'Committed' && item.purchaseOrderId && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            Đã tạo phiếu nhập {item.purchaseOrderNumber ?? ''} (nháp).
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onNavigate(paths.dashboard.pos.purchaseOrder.details(item.purchaseOrderId!))}
          >
            Xem phiếu
          </Button>
        </Stack>
      )}
    </Card>
  );
}
