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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';

import { useDebounce } from 'src/hooks/use-debounce';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';
import {
  statusChip,
  CARRIER_LABEL,
  ONLINE_ORDER_STATUS,
  ONLINE_SHIPMENT_STATUS,
  ONLINE_PAYMENT_METHOD_LABEL,
} from 'src/utils/payment-status';

import { useSearchParams } from 'src/routes/hooks';

import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { getOnlineOrders } from 'src/api/online-orders';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { TableNoData, TableHeadCustom, TablePaginationCustom } from 'src/components/table';

import OnlineOrderDetailDialog from '../online-order-detail-dialog';

// ----------------------------------------------------------------------
// Thanh toán → Đơn online: đơn khách đặt trên trang bán online. Đơn chỉ sinh hoá đơn (và trừ kho) khi đã thanh toán; mở trang
// mặc định ở tab "Cần gói" (việc của người đang làm); thông báo mở thẳng đơn bằng ?code=. Tiêu đề + tab ở layout mục.
// ----------------------------------------------------------------------

/** "to_pack" = đã thanh toán, chưa gói (việc của người đang làm). */
type ListTab = '' | 'to_pack' | OnlineOrderStatus;

const STATUS_TABS: { value: ListTab; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'to_pack', label: 'Cần gói' },
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
  { id: 'delivery', label: 'Giao hàng' },
  { id: 'salesOrder', label: 'Hoá đơn' },
  { id: 'createdAt', label: 'Đặt lúc' },
];

export default function OnlineOrderListView() {
  const { enqueueSnackbar } = useSnackbar();
  const searchParams = useSearchParams();
  // Mở từ thông báo "đơn đã thanh toán — cần gói hàng": ?code=W... → tìm đúng đơn và mở chi tiết.
  const deepLinkCode = searchParams.get('code')?.trim().toUpperCase() || '';
  const [status, setStatus] = useState<ListTab>(deepLinkCode ? '' : 'to_pack');
  const [search, setSearch] = useState(deepLinkCode);
  const openedCodeRef = useRef<string | null>(null);
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
        status: status === 'to_pack' ? 'paid' : status || undefined,
        shipment: status === 'to_pack' ? 'to_pack' : undefined,
        q: q || undefined,
        page: page + 1,
        pageSize: rowsPerPage,
      });
      if (requestId !== requestRef.current) return;
      setItems(res.items);
      setTotal(res.total);
      if (deepLinkCode && openedCodeRef.current !== deepLinkCode) {
        const hit = res.items.find((o) => o.code === deepLinkCode);
        if (hit) {
          openedCodeRef.current = deepLinkCode;
          setSelected(hit);
        }
      }
    } catch (err) {
      if (requestId === requestRef.current) {
        enqueueSnackbar(apiErrorMessage(err, 'Không tải được đơn online'), { variant: 'error' });
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [status, q, page, rowsPerPage, enqueueSnackbar, deepLinkCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <RoleBasedGuard hasContent roles={['Admin', 'Manager', 'Staff']}>
      <>
        <Card>
          <Tabs value={status} onChange={(_, v) => setStatus(v)} sx={{ px: 2.5 }}>
            {STATUS_TABS.map((t) => (
              <Tab key={t.value || 'all'} value={t.value} label={t.label} />
            ))}
          </Tabs>

          <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2.5 }}>
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
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:restart-bold" />}
              onClick={fetchData}
              sx={{ flexShrink: 0 }}
            >
              Làm mới
            </Button>
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
                          <TableCell>
                            <DeliveryCell order={o} />
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
      </>
    </RoleBasedGuard>
  );
}

function DeliveryCell({ order }: { order: IOnlineOrder }) {
  const s = order.shipping;
  if (!s?.method) return <>—</>;
  const chip = order.status === 'paid' ? statusChip(ONLINE_SHIPMENT_STATUS, s.shipmentStatus) : null;
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Typography variant="body2">
        {s.method === 'pickup' ? 'Nhận tại cửa hàng' : CARRIER_LABEL[s.carrier ?? ''] ?? 'Giao tận nơi'}
      </Typography>
      {chip && <Chip size="small" variant="outlined" color={chip.color} label={chip.label} />}
    </Stack>
  );
}
