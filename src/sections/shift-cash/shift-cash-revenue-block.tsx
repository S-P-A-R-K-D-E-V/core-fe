'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import Iconify from 'src/components/iconify';

import type { IShiftCashRevenue } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Khối "Doanh thu" trong thẻ Tổng hợp của trang Kiểm tiền quầy — số của HỆ THỐNG (hoá đơn bán trên Spark +
// hoá đơn đồng bộ từ KiotViet), dùng được ở mọi cửa hàng. Không có quyền xem doanh thu → BE không gửi con số
// nào ({ masked: true }) và ở đây hiện "****". Cuối ngày quản lý xem chủ yếu dòng chuyển khoản: số trên hoá
// đơn so với tiền ngân hàng thực nhận (khi cửa hàng có theo dõi ngân hàng).
// ----------------------------------------------------------------------

export const MASKED = '****';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}

type Props = {
  revenue: IShiftCashRevenue | null;
  loading: boolean;
  /** Bấm "Đối chiếu" → mở phần đối chiếu doanh thu (chỉ có khi được xem doanh thu). */
  onReconcile?: () => void;
};

export default function ShiftCashRevenueBlock({ revenue, loading, onReconcile }: Props) {
  const theme = useTheme();
  const masked = revenue?.masked === true;
  const data = revenue && revenue.masked !== true ? revenue : null;

  const line = (label: string, value: string, color?: string, indent = true) => (
    <Stack direction="row" justifyContent="space-between" sx={indent ? { pl: 2 } : undefined}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="caption" color={color ?? 'text.secondary'} sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Stack>
  );

  const sales = data?.revenue.sales;
  const bank = data?.bank;
  const bankGap = bank?.hasBankFeed ? bank.difference : 0;
  const bankIssue = !!bank?.hasBankFeed && (bank.missingCredits.length > 0 || bank.unmatchedCredits.length > 0);

  return (
    <Box
      id="tour-kiotviet-summary"
      sx={{ p: 1.5, borderRadius: 1, border: `1px dashed ${alpha(theme.palette.divider, 0.8)}` }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: data ? 1 : 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Iconify icon="solar:graph-up-bold-duotone" width={18} sx={{ color: 'text.secondary' }} />
          <Typography variant="subtitle2">Doanh thu</Typography>
          {data && (
            <Typography variant="caption" color="text.disabled">
              {sales!.invoiceCount} hoá đơn
            </Typography>
          )}
        </Stack>
        {!revenue ? (
          // Đang tải, hoặc tải lỗi (không phải bị che) — không hiện "****" gây hiểu nhầm là thiếu quyền.
          <Typography variant="subtitle2" color="text.disabled">
            {loading ? '…' : '—'}
          </Typography>
        ) : masked ? (
          <Tooltip title="Bạn chưa được cấp quyền xem doanh thu ở Kiểm quầy">
            <Typography variant="subtitle2" color="text.disabled" sx={{ letterSpacing: 2 }}>
              {MASKED}
            </Typography>
          </Tooltip>
        ) : (
          <Typography variant="subtitle2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(sales!.netRevenue)}
          </Typography>
        )}
      </Stack>

      {data && sales && bank && (
        <Stack spacing={0.5}>
          {line('Tiền mặt', formatCurrency(sales.cash))}
          {line('Chuyển khoản', formatCurrency(sales.transfer))}
          {bank.hasBankFeed && (sales.transfer > 0 || bank.received > 0) && (
            <Stack direction="row" justifyContent="space-between" sx={{ pl: 4 }}>
              <Typography variant="caption" color="text.disabled">
                Ngân hàng nhận
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontVariantNumeric: 'tabular-nums' }}
                color={bankIssue ? 'warning.main' : 'success.main'}
              >
                {formatCurrency(bank.received)}
                {Math.abs(bankGap) >= 1 && ` (${bankGap > 0 ? '+' : '−'}${formatCurrency(Math.abs(bankGap))})`}
              </Typography>
            </Stack>
          )}
          {line('Quẹt thẻ', formatCurrency(sales.card))}
          {sales.eWallet !== 0 && line('Ví điện tử', formatCurrency(sales.eWallet))}
          {sales.other !== 0 && line('Khác (voucher, điểm…)', formatCurrency(sales.other))}
          {sales.returns !== 0 && line('Trả hàng', `−${formatCurrency(sales.returns)}`, 'error.main')}

          {(bankIssue || onReconcile) && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.5 }}>
              {bankIssue && (
                <Typography variant="caption" color="warning.main" sx={{ flex: 1 }}>
                  <Iconify icon="solar:danger-triangle-bold" width={14} sx={{ mr: 0.5, verticalAlign: 'text-bottom' }} />
                  {bank.missingCredits.length > 0 &&
                    `${bank.missingCredits.length} hoá đơn chuyển khoản chưa thấy tiền về`}
                  {bank.missingCredits.length > 0 && bank.unmatchedCredits.length > 0 && ' · '}
                  {bank.unmatchedCredits.length > 0 &&
                    `${bank.unmatchedCredits.length} khoản tiền về chưa khớp hoá đơn`}
                </Typography>
              )}
              {onReconcile && (
                <Button
                  size="small"
                  variant="text"
                  onClick={onReconcile}
                  startIcon={<Iconify icon="solar:scale-bold-duotone" width={16} />}
                  sx={{ ml: 'auto', flexShrink: 0 }}
                >
                  Đối chiếu
                </Button>
              )}
            </Stack>
          )}
          {!bank.hasBankFeed && sales.transfer > 0 && (
            <Typography variant="caption" color="text.disabled">
              Chưa theo dõi tiền vào ngân hàng nên chưa đối chiếu được chuyển khoản.
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  );
}
