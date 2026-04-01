'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Unstable_Grid2';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Box from '@mui/material/Box';
import LoadingButton from '@mui/lab/LoadingButton';
import Label from 'src/components/label';

import { fCurrency } from 'src/utils/format-number';
import { fDateTime } from 'src/utils/format-time';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useSnackbar } from 'src/components/snackbar';
import Iconify from 'src/components/iconify';

import { ISalesOrder } from 'src/types/corecms-api';
import { getSalesOrderById, cancelSalesOrder } from 'src/api/sales-orders';

// ----------------------------------------------------------------------

const STATUS_COLOR_MAP: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  Draft: 'default',
  Confirmed: 'info',
  Completed: 'success',
  Cancelled: 'error',
  Returned: 'warning',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  Draft: 'Nháp',
  Confirmed: 'Đã xác nhận',
  Completed: 'Hoàn thành',
  Cancelled: 'Đã hủy',
  Returned: 'Trả hàng',
};

const PAYMENT_STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  Pending: 'default',
  Paid: 'success',
  PartiallyPaid: 'warning',
  Refunded: 'error',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  Pending: 'Chưa thanh toán',
  Paid: 'Đã thanh toán',
  PartiallyPaid: 'Thanh toán một phần',
  Refunded: 'Đã hoàn tiền',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  Cash: 'Tiền mặt',
  BankTransfer: 'Chuyển khoản',
  QRCode: 'QR Code',
};

type Props = { id: string };

export default function SalesOrderDetailView({ id }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();

  const [order, setOrder] = useState<ISalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSalesOrderById(id);
      setOrder(data);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không tải được đơn hàng', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, enqueueSnackbar]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      await cancelSalesOrder(id);
      enqueueSnackbar('Đã hủy đơn hàng!');
      fetchOrder();
    } catch (error) {
      enqueueSnackbar('Lỗi hủy đơn', { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !order) {
    return <Typography>Đang tải...</Typography>;
  }

  const canCancel = order.status === 'Completed' || order.status === 'Draft' || order.status === 'Confirmed';

  return (
    <Grid container spacing={3}>
      {/* Header */}
      <Grid xs={12}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h4">Đơn bán hàng #{order.orderNumber}</Typography>
            <Label color={STATUS_COLOR_MAP[order.status]}>{STATUS_LABEL_MAP[order.status] || order.status}</Label>
            <Label color={PAYMENT_STATUS_COLOR[order.paymentStatus]}>{PAYMENT_STATUS_LABEL[order.paymentStatus] || order.paymentStatus}</Label>
          </Stack>
          <Stack direction="row" spacing={1}>
            {canCancel && order.status !== 'Cancelled' && (
              <>
                <Button
                  variant="outlined"
                  onClick={() => router.push(paths.dashboard.pos.salesOrder.edit(id))}
                  startIcon={<Iconify icon="solar:pen-bold" />}
                >
                  Chỉnh sửa
                </Button>
                <LoadingButton variant="outlined" color="error" loading={actionLoading} onClick={handleCancel}
                  startIcon={<Iconify icon="solar:close-circle-bold" />}>
                  Hủy đơn
                </LoadingButton>
              </>
            )}
          </Stack>
        </Stack>
      </Grid>

      {/* Info */}
      <Grid xs={12} md={8}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Thông tin chung</Typography>
          <Box rowGap={2} columnGap={2} display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Khách hàng</Typography>
              <Typography variant="body2">{order.customerName || 'Khách lẻ'}</Typography>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Kho xuất</Typography>
              <Typography variant="body2">{order.warehouseName}</Typography>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Ngày tạo</Typography>
              <Typography variant="body2">{fDateTime(order.createdAt)}</Typography>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Người tạo</Typography>
              <Typography variant="body2">{order.createdByName}</Typography>
            </Stack>
          </Box>
          {order.note && (
            <Stack spacing={0.5} sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">Ghi chú</Typography>
              <Typography variant="body2">{order.note}</Typography>
            </Stack>
          )}
        </Card>
      </Grid>

      {/* Totals */}
      <Grid xs={12} md={4}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Tổng hợp</Typography>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Tạm tính</Typography>
              <Typography variant="body2">{fCurrency(order.subTotal)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">VAT</Typography>
              <Typography variant="body2">{fCurrency(order.vatAmount)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Chiết khấu</Typography>
              <Typography variant="body2">-{fCurrency(order.discountAmount)}</Typography>
            </Stack>
            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="subtitle1">Tổng cộng</Typography>
              <Typography variant="subtitle1" color="primary">{fCurrency(order.totalAmount)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Đã thanh toán</Typography>
              <Typography variant="body2" color="success.main">{fCurrency(order.paidAmount)}</Typography>
            </Stack>
            {order.totalAmount - order.paidAmount > 0 && (
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Còn thiếu</Typography>
                <Typography variant="body2" color="error.main">{fCurrency(order.totalAmount - order.paidAmount)}</Typography>
              </Stack>
            )}
          </Stack>
        </Card>
      </Grid>

      {/* Items table */}
      <Grid xs={12}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Chi tiết sản phẩm</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sản phẩm</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell align="center">SL</TableCell>
                <TableCell align="right">Đơn giá</TableCell>
                <TableCell align="right">VAT %</TableCell>
                <TableCell align="right">Chiết khấu</TableCell>
                <TableCell align="right">Thành tiền</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>{item.productSKU}</TableCell>
                  <TableCell align="center">{item.quantity}</TableCell>
                  <TableCell align="right">{fCurrency(item.unitPrice)}</TableCell>
                  <TableCell align="right">{item.vatRate}%</TableCell>
                  <TableCell align="right">{fCurrency(item.discountAmount)}</TableCell>
                  <TableCell align="right">{fCurrency(item.totalPrice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Grid>

      {/* Payments */}
      {order.payments.length > 0 && (
        <Grid xs={12}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Thanh toán</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Phương thức</TableCell>
                  <TableCell align="right">Số tiền</TableCell>
                  <TableCell>Mã giao dịch</TableCell>
                  <TableCell>Ghi chú</TableCell>
                  <TableCell>Người tạo</TableCell>
                  <TableCell>Thời gian</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {order.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{PAYMENT_METHOD_LABEL[p.method] || p.method}</TableCell>
                    <TableCell align="right">{fCurrency(p.amount)}</TableCell>
                    <TableCell>{p.transactionRef || '—'}</TableCell>
                    <TableCell>{p.note || '—'}</TableCell>
                    <TableCell>{p.createdByName}</TableCell>
                    <TableCell>{fDateTime(p.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Grid>
      )}
    </Grid>
  );
}
