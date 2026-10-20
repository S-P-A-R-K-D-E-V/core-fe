'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';

import { fDate } from 'src/utils/format-time';
import { fCurrency, fShortenNumber } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';

import type {
  IPurchaseImportDuplicate,
  IPurchaseImportSupplierOverview,
} from 'src/types/purchase-import';

// ----------------------------------------------------------------------
// Thẻ "Lịch sử nhập" của NCC trong drawer duyệt nhanh — đọc từ MỌI phiếu nhập của NCC (cả lịch sử, không chỉ 180 ngày):
// số phiếu / tiền từ lần đầu, theo năm, phiếu cũ nghi trùng hoá đơn này (so thành tiền + mã từng dòng, tổng tiền, ngày
// hoá đơn) và các phiếu gần nhất. Lịch sử của từng mã hiện ngay trên dòng.
// ----------------------------------------------------------------------

type Props = {
  supplierName?: string | null;
  overview: IPurchaseImportSupplierOverview | null;
  loading: boolean;
  onOpenOrder: (purchaseOrderId: string) => void;
};

/** "4/13 dòng cùng mã + 5 chỉ cùng thành tiền · cùng tổng tiền · cùng ngày hoá đơn" */
export function duplicateDetail(d: IPurchaseImportDuplicate): string {
  const parts = [`${d.matchedLines}/${d.importLines} dòng cùng mã`];
  if (d.amountOnlyLines) parts[0] += ` + ${d.amountOnlyLines} chỉ cùng thành tiền`;
  if (d.totalMatches) parts.push('cùng tổng tiền');
  if (d.sameDate) parts.push('cùng ngày hoá đơn');
  return parts.join(' · ');
}

export default function PurchaseImportSupplierOverview({
  supplierName,
  overview,
  loading,
  onOpenOrder,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!overview) {
    if (!loading) return null;
    return (
      <Typography variant="caption" color="text.secondary">
        Đang đọc lịch sử nhập của NCC…
      </Typography>
    );
  }

  if (overview.orders === 0)
    return (
      <Typography variant="caption" color="text.secondary">
        Chưa có phiếu nhập nào từ {supplierName || 'NCC này'} — hàng trên hoá đơn sẽ là lần nhập
        đầu.
      </Typography>
    );

  return (
    <Box
      sx={{
        px: 1.25,
        py: 1,
        borderRadius: 1.25,
        border: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Iconify
          icon="solar:bill-list-bold-duotone"
          width={18}
          sx={{ color: 'text.secondary', flexShrink: 0 }}
        />
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
          <strong>{overview.orders} phiếu</strong> từ {supplierName || 'NCC này'}
          {overview.firstDate ? ` từ ${fDate(overview.firstDate, 'MM/yyyy')}` : ''}
          {overview.lastDate ? ` · gần nhất ${fDate(overview.lastDate, 'dd/MM/yyyy')}` : ''} · tổng{' '}
          {fShortenNumber(overview.amount)}
        </Typography>
        <Button
          size="small"
          color="inherit"
          onClick={() => setOpen((v) => !v)}
          sx={{ flexShrink: 0 }}
        >
          {open ? 'Thu gọn' : 'Chi tiết'}
        </Button>
      </Stack>

      {overview.duplicates.length > 0 && (
        <Stack spacing={0.75} sx={{ mt: 1 }}>
          {overview.duplicates.map((d) => (
            <Alert
              key={d.purchaseOrderId}
              severity="warning"
              icon={<Iconify icon="solar:copy-bold-duotone" width={20} />}
              action={
                <Button size="small" color="inherit" onClick={() => onOpenOrder(d.purchaseOrderId)}>
                  Xem phiếu
                </Button>
              }
              sx={{ py: 0 }}
            >
              <Typography variant="body2">
                Có thể đã nhập: <strong>{d.orderNumber}</strong> ngày {fDate(d.date, 'dd/MM/yyyy')}{' '}
                ({fCurrency(d.total)})
              </Typography>
              <Typography variant="caption">{duplicateDetail(d)}</Typography>
            </Alert>
          ))}
        </Stack>
      )}

      <Collapse in={open} unmountOnExit>
        <Stack spacing={1} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {overview.years.map((y) => (
              <Chip
                key={y.year}
                size="small"
                variant="soft"
                label={`${y.year}: ${y.orders} phiếu · ${fShortenNumber(y.amount)}`}
              />
            ))}
          </Stack>
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              Phiếu gần nhất
            </Typography>
            {overview.recent.map((r) => (
              <Stack key={r.purchaseOrderId} direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  <strong>{r.orderNumber}</strong> · {fDate(r.date, 'dd/MM/yyyy')} · {r.lines} dòng
                  · {fCurrency(r.total)}
                </Typography>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => onOpenOrder(r.purchaseOrderId)}
                  sx={{ flexShrink: 0, minWidth: 0 }}
                >
                  Xem
                </Button>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Collapse>
    </Box>
  );
}
