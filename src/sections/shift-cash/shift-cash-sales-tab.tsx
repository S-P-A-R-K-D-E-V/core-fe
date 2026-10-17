'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';

import ReceiptPrintDialog from 'src/sections/pos/receipt-print/receipt-print-dialog';

import type {
  IShiftCashRevenue,
  IShiftCashSalesReturn,
  IShiftCashSalesInvoice,
  ShiftCashTransferStatus,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Tab "Hoá đơn bán hàng" của trang Kiểm tiền quầy — hoá đơn của ngày từ dữ liệu HỆ THỐNG (bán trên Spark +
// đồng bộ từ KiotViet), không gọi KiotViet: mọi cửa hàng dùng được. Xem nhanh + in lại phiếu bằng hộp thoại in
// của POS; mở trang chi tiết hoá đơn ở tab mới. Người không có quyền xem doanh thu: BE không gửi danh sách.
// ----------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}

// Giờ Việt Nam "HH:mm" từ mốc UTC.
function timeVN(iso: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  return new Date(ms + 7 * 60 * 60 * 1000).toISOString().slice(11, 16);
}

type Filter = 'all' | 'cash' | 'transfer' | 'card' | 'ewallet' | 'returns';

const TRANSFER_STATUS: Record<ShiftCashTransferStatus, { label: string; color: 'success' | 'warning' | 'default' }> = {
  received: { label: 'Đã về', color: 'success' },
  missing: { label: 'Chưa thấy tiền về', color: 'warning' },
  unknown: { label: 'Chưa theo dõi NH', color: 'default' },
};

const NUM_SX = { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const;

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// CSV có BOM để Excel mở đúng tiếng Việt.
function downloadCsv(date: string, invoices: IShiftCashSalesInvoice[], returns: IShiftCashSalesReturn[]) {
  const lines = [
    ['Mã hoá đơn', 'Giờ', 'Khách hàng', 'Tổng', 'Tiền mặt', 'Chuyển khoản', 'Thẻ', 'Ví', 'Khác', 'Tiền về NH', 'Trả hàng'],
    ...invoices.map((i) => [
      i.code,
      timeVN(i.purchaseDate),
      i.customerName ?? '',
      i.total,
      i.cash,
      i.transfer,
      i.card,
      i.eWallet,
      i.other,
      i.transferStatus ? TRANSFER_STATUS[i.transferStatus].label : '',
      i.hasReturn ? i.returnAmount : '',
    ]),
    [],
    ['Mã phiếu trả', 'Giờ', 'Hoá đơn gốc', 'Khách hàng', 'Giá trị trả', 'Đổi hàng', 'Tiền mặt trả khách'],
    ...returns.map((r) => [
      r.code,
      timeVN(r.returnDate),
      r.invoiceCode ?? '',
      r.customerName ?? '',
      r.returnTotal,
      r.exchangeTotal,
      r.cashRefund,
    ]),
  ];
  const blob = new Blob([`﻿${lines.map((l) => l.map(csvCell).join(',')).join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hoa-don-ban-hang-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  date: string;
  revenue: IShiftCashRevenue | null;
  loading: boolean;
  onReload: VoidFunction;
};

export default function ShiftCashSalesTab({ date, revenue, loading, onReload }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [printId, setPrintId] = useState<string | null>(null);

  const data = revenue && revenue.masked !== true ? revenue : null;
  const invoices = useMemo(() => data?.invoices ?? [], [data]);
  const returns = useMemo(() => data?.returns ?? [], [data]);

  const counts = useMemo(
    () => ({
      all: invoices.length,
      cash: invoices.filter((i) => i.cash > 0).length,
      transfer: invoices.filter((i) => i.transfer > 0).length,
      card: invoices.filter((i) => i.card > 0).length,
      ewallet: invoices.filter((i) => i.eWallet > 0).length,
      returns: returns.length,
    }),
    [invoices, returns]
  );

  const q = query.trim().toLowerCase();
  const matches = (code: string, customer: string | null) =>
    !q || code.toLowerCase().includes(q) || (customer ?? '').toLowerCase().includes(q);

  const shownInvoices = invoices.filter((i) => {
    if (!matches(i.code, i.customerName)) return false;
    if (filter === 'cash') return i.cash > 0;
    if (filter === 'transfer') return i.transfer > 0;
    if (filter === 'card') return i.card > 0;
    if (filter === 'ewallet') return i.eWallet > 0;
    return true;
  });
  const shownReturns = returns.filter((r) => matches(r.code, r.customerName) || matches(r.invoiceCode ?? '', null));

  if (loading && !revenue) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (revenue?.masked === true) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Iconify icon="solar:lock-keyhole-bold-duotone" width={48} sx={{ color: 'text.disabled', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          Bạn chưa được cấp quyền xem doanh thu và hoá đơn bán ở Kiểm quầy.
        </Typography>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Iconify icon="solar:bill-list-bold-duotone" width={48} sx={{ color: 'text.disabled', mb: 2 }} />
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Không tải được hoá đơn bán hàng
        </Typography>
        <Button variant="outlined" size="small" onClick={onReload} startIcon={<Iconify icon="solar:refresh-bold" />}>
          Thử lại
        </Button>
      </Box>
    );
  }

  const sales = data.revenue.sales;

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
        <Chip icon={<Iconify icon="solar:bill-list-bold" width={16} />} label={`${sales.invoiceCount} đơn`} variant="outlined" />
        <Chip label={`Tổng: ${formatCurrency(sales.revenue)}`} color="primary" variant="soft" />
        <Chip label={`TM: ${formatCurrency(sales.cash)}`} color="success" variant="soft" />
        <Chip label={`CK: ${formatCurrency(sales.transfer)}`} color="info" variant="soft" />
        <Chip label={`Thẻ: ${formatCurrency(sales.card)}`} color="warning" variant="soft" />
        {sales.eWallet !== 0 && <Chip label={`Ví: ${formatCurrency(sales.eWallet)}`} color="secondary" variant="soft" />}
        {sales.returns !== 0 && <Chip label={`Trả: −${formatCurrency(sales.returns)}`} color="error" variant="soft" />}
        {data.kiotVietConnected && (
          <Tooltip title="Gồm hoá đơn đã đồng bộ từ KiotViet. So trực tiếp với KiotViet ở phần Đối chiếu doanh thu.">
            <Chip size="small" variant="outlined" label="Dữ liệu hệ thống" icon={<Iconify icon="solar:info-circle-bold" width={16} />} />
          </Tooltip>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <TextField
          size="small"
          placeholder="Mã hoá đơn, khách hàng…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ width: { xs: 1, sm: 220 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
          onClick={() => downloadCsv(date, invoices, returns)}
          disabled={invoices.length === 0 && returns.length === 0}
        >
          Tải Excel
        </Button>
      </Stack>

      <Tabs value={filter} onChange={(_, v) => setFilter(v)} variant="scrollable" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="all" label={`Tất cả (${counts.all})`} />
        <Tab value="cash" label={`Tiền mặt (${counts.cash})`} />
        <Tab value="transfer" label={`Chuyển khoản (${counts.transfer})`} />
        <Tab value="card" label={`Thẻ (${counts.card})`} />
        {counts.ewallet > 0 && <Tab value="ewallet" label={`Ví (${counts.ewallet})`} />}
        <Tab value="returns" label={`Trả hàng (${counts.returns})`} />
      </Tabs>

      {filter === 'returns' ? (
        <Scrollbar>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Mã phiếu trả</TableCell>
                  <TableCell>Giờ</TableCell>
                  <TableCell>Hoá đơn gốc</TableCell>
                  <TableCell>Khách hàng</TableCell>
                  <TableCell align="right">Giá trị trả</TableCell>
                  <TableCell align="right">Đổi hàng</TableCell>
                  <TableCell align="right">Tiền mặt trả khách</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {shownReturns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      Không có phiếu trả hàng
                    </TableCell>
                  </TableRow>
                ) : (
                  shownReturns.map((r) => (
                    <TableRow key={r.returnId} hover>
                      <TableCell>{r.code}</TableCell>
                      <TableCell sx={NUM_SX}>{timeVN(r.returnDate)}</TableCell>
                      <TableCell>{r.invoiceCode ?? '—'}</TableCell>
                      <TableCell>{r.customerName || 'Khách lẻ'}</TableCell>
                      <TableCell align="right" sx={NUM_SX}>
                        {formatCurrency(r.returnTotal)}
                      </TableCell>
                      <TableCell align="right" sx={NUM_SX}>
                        {r.exchangeTotal ? formatCurrency(r.exchangeTotal) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ ...NUM_SX, color: 'error.main' }}>
                        −{formatCurrency(r.cashRefund)}
                      </TableCell>
                      <TableCell align="right">
                        {r.salesOrderId && (
                          <InvoiceActions orderId={r.salesOrderId} onPrint={() => setPrintId(r.salesOrderId)} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      ) : (
        <Scrollbar>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 860 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Mã hoá đơn</TableCell>
                  <TableCell>Giờ</TableCell>
                  <TableCell>Khách hàng</TableCell>
                  <TableCell align="right">Tổng</TableCell>
                  <TableCell align="right">Tiền mặt</TableCell>
                  <TableCell align="right">Chuyển khoản</TableCell>
                  <TableCell align="right">Thẻ / Ví</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {shownInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      Không có hoá đơn
                    </TableCell>
                  </TableRow>
                ) : (
                  shownInvoices.map((i) => (
                    <TableRow key={i.salesOrderId} hover>
                      <TableCell>
                        <Typography variant="body2">{i.code}</Typography>
                        {i.hasReturn && (
                          <Typography variant="caption" color="error.main">
                            Trả {formatCurrency(i.returnAmount)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={NUM_SX}>{timeVN(i.purchaseDate)}</TableCell>
                      <TableCell>{i.customerName || 'Khách lẻ'}</TableCell>
                      <TableCell align="right" sx={{ ...NUM_SX, fontWeight: 600 }}>
                        {formatCurrency(i.total)}
                      </TableCell>
                      <TableCell align="right" sx={NUM_SX}>
                        {i.cash ? formatCurrency(i.cash) : '—'}
                        {i.untracked > 0 && i.untracked !== i.total && (
                          <Tooltip title="Phần chưa ghi thanh toán — Kiểm quầy tính là tiền mặt">
                            <Iconify icon="solar:info-circle-bold" width={14} sx={{ ml: 0.5, color: 'warning.main', verticalAlign: 'text-bottom' }} />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={NUM_SX}>
                        {i.transfer ? (
                          <Stack alignItems="flex-end" spacing={0.25}>
                            <span>{formatCurrency(i.transfer)}</span>
                            {i.transferStatus && (
                              <Label variant="soft" color={TRANSFER_STATUS[i.transferStatus].color}>
                                {TRANSFER_STATUS[i.transferStatus].label}
                              </Label>
                            )}
                          </Stack>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell align="right" sx={NUM_SX}>
                        {i.card || i.eWallet ? formatCurrency(i.card + i.eWallet) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <InvoiceActions orderId={i.salesOrderId} onPrint={() => setPrintId(i.salesOrderId)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      )}

      <ReceiptPrintDialog open={!!printId} orderId={printId} onClose={() => setPrintId(null)} />
    </>
  );
}

function InvoiceActions({ orderId, onPrint }: { orderId: string; onPrint: VoidFunction }) {
  return (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
      <Tooltip title="Xem & in nhanh">
        <IconButton size="small" onClick={onPrint}>
          <Iconify icon="solar:printer-minimalistic-bold-duotone" width={18} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Mở chi tiết hoá đơn (tab mới)">
        <IconButton
          size="small"
          component="a"
          href={paths.dashboard.pos.salesOrder.details(orderId)}
          target="_blank"
          rel="noopener"
        >
          <Iconify icon="solar:eye-bold" width={18} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
