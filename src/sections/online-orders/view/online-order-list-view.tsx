'use client';

import type { IOnlineOrder, OnlineOrderStatus } from 'src/types/payment-service';

import { useRef, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { useDebounce } from 'src/hooks/use-debounce';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';
import { statusChip, ONLINE_ORDER_STATUS, ONLINE_PAYMENT_METHOD_LABEL } from 'src/utils/payment-status';

import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { getOnlineOrders } from 'src/api/online-orders';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { TableNoData, TableHeadCustom, TablePaginationCustom } from 'src/components/table';

import OnlineOrderDetailDialog from '../online-order-detail-dialog';

// ----------------------------------------------------------------------
// Đơn khách đặt trên storefront. Đơn chỉ sinh hoá đơn bán hàng (và trừ kho) khi đã thanh toán; đơn chờ thanh toán
// quản lý có thể huỷ.
// ----------------------------------------------------------------------

const STATUS_TABS: { value: '' | OnlineOrderStatus; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'pending_payment', label: 'Chờ thanh toán' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'cancelled', label: 'Đã huỷ' },
  { value: 'expired', label: 'Hết hạn' },
];

const TABLE_HEAD = [
  { id: 'code', label: 'Mã đơn' },
  { id: 'customer', label: 'Khách hàng' },
  { id: 'total', label: 'Tổng tiền', align: 'right' },
  { id: 'payment', label: 'Thanh toán' },
  { id: 'status', label: 'Trạng thái' },
  { id: 'salesOrder', label: 'Hoá đơn' },
  { id: 'createdAt', label: 'Đặt lúc' },
];

export default function OnlineOrderListView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [status, setStatus] = useState<'' | OnlineOrderStatus>('');
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 400);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [items, setItems] = useState<IOnlineOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IOnlineOrder | null>(null);

  const requestRef = useRef(0);
  useEffect(() => {
    setPage(0);
  }, [status, q]);

  const fetchData = useCallback(async () => {
    requestRef.current += 1;
    const requestId = requestRef.current;
    setLoading(true);
    try {
      const res = await getOnlineOrders({
        status: status || undefined,
        q: q || undefined,
        page: page + 1,
        pageSize: rowsPerPage,
      });
      if (requestId !== requestRef.current) return;
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      if (requestId === requestRef.current) {
        enqueueSnackbar(apiErrorMessage(err, 'Không tải được đơn online'), { variant: 'error' });
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [status, q, page, rowsPerPage, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <RoleBasedGuard hasContent roles={['Admin', 'Manager']}>
      <Container maxWidth={settings.themeStretch ? false : 'xl'}>
        <CustomBreadcrumbs
          heading="Đơn online"
          links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Đơn online' }]}
          action={
            <Button variant="outlined" startIcon={<Iconify icon="solar:restart-bold" />} onClick={fetchData}>
              Làm mới
            </Button>
          }
          sx={{ mb: 3 }}
        />

        <Card>
          <Tabs value={status} onChange={(_, v) => setStatus(v)} sx={{ px: 2.5 }}>
            {STATUS_TABS.map((t) => (
              <Tab key={t.value || 'all'} value={t.value} label={t.label} />
            ))}
          </Tabs>

          <Stack sx={{ p: 2.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Tìm mã đơn, tên khách, số điện thoại…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHeadCustom headLabel={TABLE_HEAD} />
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={TABLE_HEAD.length} align="center" sx={{ py: 5 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((o) => {
                      const chip = statusChip(ONLINE_ORDER_STATUS, o.status);
                      return (
                        <TableRow key={o.id} hover onClick={() => setSelected(o)} sx={{ cursor: 'pointer' }}>
                          <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{o.code}</TableCell>
                          <TableCell>
                            <Typography variant="body2">{o.customerName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {o.phone}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {fCurrency(o.total)}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {ONLINE_PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}
                            </Typography>
                            {o.paymentCode && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                {o.paymentCode}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" color={chip.color} label={chip.label} />
                          </TableCell>
                          <TableCell>{o.salesOrderCode || '—'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(o.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  <TableNoData notFound={!loading && items.length === 0} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>

          <TablePaginationCustom
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </Card>

        <OnlineOrderDetailDialog
          order={selected}
          onClose={() => setSelected(null)}
          onChanged={(updated) => setItems((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)))}
        />
      </Container>
    </RoleBasedGuard>
  );
}
