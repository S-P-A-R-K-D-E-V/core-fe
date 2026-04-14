'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';

import { RoleBasedGuard } from 'src/auth/guard';
import { getKiotVietBankAccounts } from 'src/api/shiftCash';
import {
  queryKiotVietSales,
  exportKiotVietSalesExcel,
} from 'src/api/kiotVietSales';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import {
  IKiotVietBankAccount,
  IKiotVietSalesQueryItem,
  IKiotVietSalesQueryParams,
  IKiotVietSalesQueryResponse,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'Cash', label: 'Tiền mặt' },
  { value: 'Transfer', label: 'Chuyển khoản' },
  { value: 'Card', label: 'Thẻ' },
];

const formatVnd = (n: number) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(n || 0));

const toIsoDate = (d: Date | null): string => {
  if (!d) return '';
  // Vietnam timezone: format as yyyy-MM-dd local
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const PAYMENT_COLOR: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  Cash: 'success',
  Transfer: 'info',
  Card: 'warning',
};

// ----------------------------------------------------------------------

export default function KiotVietSalesView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  // Filters state
  const today = useMemo(() => new Date(), []);
  const [fromDate, setFromDate] = useState<Date | null>(today);
  const [toDate, setToDate] = useState<Date | null>(today);
  const [code, setCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [bankAccountId, setBankAccountId] = useState<number | ''>('');

  // Data state
  const [bankAccounts, setBankAccounts] = useState<IKiotVietBankAccount[]>([]);
  const [data, setData] = useState<IKiotVietSalesQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Pagination (client-side, gọn nhẹ)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Load bank accounts once
  useEffect(() => {
    (async () => {
      try {
        const accs = await getKiotVietBankAccounts();
        setBankAccounts(accs);
      } catch {
        // ignore — user vẫn có thể filter theo các điều kiện khác
      }
    })();
  }, []);

  const buildParams = useCallback((): IKiotVietSalesQueryParams | null => {
    if (!fromDate || !toDate) {
      enqueueSnackbar('Vui lòng chọn khoảng ngày', { variant: 'warning' });
      return null;
    }
    return {
      fromDate: toIsoDate(fromDate),
      toDate: toIsoDate(toDate),
      code: code || undefined,
      paymentMethod: paymentMethod || undefined,
      bankAccountId: bankAccountId === '' ? undefined : bankAccountId,
    };
  }, [fromDate, toDate, code, paymentMethod, bankAccountId, enqueueSnackbar]);

  const handleQuery = useCallback(async () => {
    const params = buildParams();
    if (!params) return;

    setLoading(true);
    try {
      const res = await queryKiotVietSales(params);
      setData(res);
      setPage(0);
      enqueueSnackbar(`Tìm thấy ${res.totalCount} hóa đơn`, { variant: 'success' });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Truy vấn thất bại';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [buildParams, enqueueSnackbar]);

  const handleExport = useCallback(async () => {
    const params = buildParams();
    if (!params) return;

    setExporting(true);
    try {
      await exportKiotVietSalesExcel(params);
      enqueueSnackbar('Đã xuất Excel', { variant: 'success' });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? 'Xuất Excel thất bại';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setExporting(false);
    }
  }, [buildParams, enqueueSnackbar]);

  const handleReset = useCallback(() => {
    setFromDate(today);
    setToDate(today);
    setCode('');
    setPaymentMethod('');
    setBankAccountId('');
    setData(null);
    setPage(0);
  }, [today]);

  const items: IKiotVietSalesQueryItem[] = data?.items ?? [];
  const pagedItems = items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Bán hàng KiotViet"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Bán hàng KiotViet' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RoleBasedGuard hasContent roles={['Admin']}>
        <Stack spacing={3}>
          {/* Filters */}
          <Card sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Iconify icon="mdi:filter-variant" width={28} sx={{ color: 'primary.main' }} />
              <Box>
                <Typography variant="h6">Bộ lọc</Typography>
                <Typography variant="body2" color="text.secondary">
                  Truy vấn hóa đơn KiotViet theo khoảng ngày, mã đơn, phương thức thanh toán và tài khoản nhận tiền.
                </Typography>
              </Box>
            </Stack>

            <Grid container spacing={2}>
              <Grid xs={12} sm={6} md={3}>
                <DatePicker
                  label="Từ ngày"
                  value={fromDate}
                  onChange={setFromDate}
                  format="dd/MM/yyyy"
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <DatePicker
                  label="Đến ngày"
                  value={toDate}
                  onChange={setToDate}
                  format="dd/MM/yyyy"
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <TextField
                  label="Mã hóa đơn"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="VD: HD000123"
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid xs={12} sm={6} md={3}>
                <TextField
                  select
                  label="Phương thức thanh toán"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  fullWidth
                  size="small"
                >
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value || 'all'} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid xs={12} sm={6} md={6}>
                <TextField
                  select
                  label="Tài khoản nhận tiền"
                  value={bankAccountId === '' ? '' : String(bankAccountId)}
                  onChange={(e) =>
                    setBankAccountId(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">Tất cả</MenuItem>
                  {bankAccounts.map((acc) => (
                    <MenuItem key={acc.id} value={String(acc.id)}>
                      {acc.bankName} - {acc.accountNumber}
                      {acc.description ? ` (${acc.description})` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid xs={12} sm={6} md={6}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <LoadingButton
                    variant="outlined"
                    color="inherit"
                    startIcon={<Iconify icon="mdi:refresh" />}
                    onClick={handleReset}
                    disabled={loading || exporting}
                  >
                    Đặt lại
                  </LoadingButton>
                  <LoadingButton
                    variant="contained"
                    color="primary"
                    loading={loading}
                    startIcon={<Iconify icon="mdi:magnify" />}
                    onClick={handleQuery}
                  >
                    Truy vấn
                  </LoadingButton>
                  <LoadingButton
                    variant="contained"
                    color="success"
                    loading={exporting}
                    disabled={!data || data.totalCount === 0}
                    startIcon={<Iconify icon="mdi:microsoft-excel" />}
                    onClick={handleExport}
                  >
                    Xuất Excel
                  </LoadingButton>
                </Stack>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 2 }}>
              Khoảng truy vấn tối đa <strong>31 ngày</strong>. Do KiotViet API có giới hạn tốc độ
              (~3s/trang), truy vấn nhiều ngày có thể mất một lúc.
            </Alert>
          </Card>

          {/* Summary */}
          {data && (
            <Card sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                <Iconify icon="mdi:chart-box" width={28} sx={{ color: 'success.main' }} />
                <Typography variant="h6">
                  Tổng hợp ({data.fromDate} → {data.toDate})
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid xs={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Số hóa đơn
                    </Typography>
                    <Typography variant="h5">{data.totalCount}</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Tổng tiền
                    </Typography>
                    <Typography variant="h5" color="primary.main">
                      {formatVnd(data.totalAmount)} đ
                    </Typography>
                  </Box>
                </Grid>
                <Grid xs={12} md={6}>
                  <Stack direction="row" spacing={2} justifyContent="flex-end" alignItems="center" height="100%">
                    <Chip
                      label={`Tiền mặt: ${formatVnd(data.totalCash)} đ`}
                      color="success"
                      variant="outlined"
                    />
                    <Chip
                      label={`Chuyển khoản: ${formatVnd(data.totalTransfer)} đ`}
                      color="info"
                      variant="outlined"
                    />
                    <Chip
                      label={`Thẻ: ${formatVnd(data.totalCard)} đ`}
                      color="warning"
                      variant="outlined"
                    />
                  </Stack>
                </Grid>
              </Grid>
            </Card>
          )}

          {/* Result table */}
          <Card>
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle1">
                {data
                  ? `Kết quả: ${data.totalCount} hóa đơn`
                  : 'Chọn bộ lọc và bấm "Truy vấn" để xem kết quả'}
              </Typography>
            </Box>
            <Divider />

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 60 }}>STT</TableCell>
                    <TableCell>Mã đơn</TableCell>
                    <TableCell>Ngày tạo</TableCell>
                    <TableCell>Khách hàng</TableCell>
                    <TableCell align="right">Tổng tiền</TableCell>
                    <TableCell align="right">Đã thanh toán</TableCell>
                    <TableCell>Phương thức</TableCell>
                    <TableCell>Tài khoản nhận</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {data ? 'Không có hóa đơn phù hợp' : 'Chưa có dữ liệu'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {pagedItems.map((it, idx) => (
                    <TableRow key={it.id} hover>
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell>
                        <strong>{it.code}</strong>
                      </TableCell>
                      <TableCell>
                        {new Date(it.createdDate).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>{it.customerName || '-'}</TableCell>
                      <TableCell align="right">
                        <strong>{formatVnd(it.total)} đ</strong>
                      </TableCell>
                      <TableCell align="right">{formatVnd(it.totalPayment)} đ</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={it.paymentMethodDisplay}
                          color={PAYMENT_COLOR[it.paymentMethod] ?? 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {it.bankAccountNumber
                          ? `${it.bankAccountName ?? ''} - ${it.bankAccountNumber}`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {data && data.totalCount > 0 && (
              <TablePagination
                component="div"
                count={items.length}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
                labelRowsPerPage="Số dòng:"
              />
            )}
          </Card>
        </Stack>
      </RoleBasedGuard>
    </Container>
  );
}
