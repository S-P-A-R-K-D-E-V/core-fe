'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
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
import TextField from '@mui/material/TextField';
import LoadingButton from '@mui/lab/LoadingButton';
import Label from 'src/components/label';
import Chip from '@mui/material/Chip';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fCurrency } from 'src/utils/format-number';
import { fDateTime } from 'src/utils/format-time';

import { useSnackbar } from 'src/components/snackbar';
import Iconify from 'src/components/iconify';

import { IPurchaseOrder, IPurchaseOrderItem } from 'src/types/corecms-api';
import {
  getPurchaseOrderById,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrder,
} from 'src/api/purchase-orders';

// ----------------------------------------------------------------------

const STATUS_COLOR_MAP: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  Draft: 'default',
  Confirmed: 'info',
  PartiallyReceived: 'warning',
  Completed: 'success',
  Cancelled: 'error',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  Draft: 'Nháp',
  Confirmed: 'Đã duyệt',
  PartiallyReceived: 'Nhận một phần',
  Completed: 'Hoàn thành',
  Cancelled: 'Đã hủy',
};

type Props = { id: string };

export default function PurchaseOrderDetailView({ id }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [order, setOrder] = useState<IPurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [receiveMode, setReceiveMode] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({});

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPurchaseOrderById(id);
      setOrder(data);
      // Init receive quantities
      const quantities: Record<string, number> = {};
      (data.items || []).forEach((item: IPurchaseOrderItem) => {
        quantities[item.id] = 0;
      });
      setReceiveQuantities(quantities);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không tải được đơn hàng', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, enqueueSnackbar]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleConfirm = async () => {
    try {
      setActionLoading(true);
      await confirmPurchaseOrder(id);
      enqueueSnackbar('Đã duyệt đơn hàng!');
      fetchOrder();
    } catch (error) {
      enqueueSnackbar('Lỗi duyệt đơn', { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      await cancelPurchaseOrder(id);
      enqueueSnackbar('Đã hủy đơn hàng!');
      fetchOrder();
    } catch (error) {
      enqueueSnackbar('Lỗi hủy đơn', { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceive = async () => {
    try {
      setActionLoading(true);
      const items = Object.entries(receiveQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([purchaseOrderItemId, receivedQuantity]) => ({ purchaseOrderItemId, receivedQuantity }));

      if (items.length === 0) {
        enqueueSnackbar('Nhập số lượng nhận cho ít nhất 1 sản phẩm', { variant: 'warning' });
        setActionLoading(false);
        return;
      }

      await receivePurchaseOrder(id, { items });
      enqueueSnackbar('Nhận hàng thành công! Kho đã được cập nhật.');
      setReceiveMode(false);
      fetchOrder();
    } catch (error) {
      enqueueSnackbar('Lỗi nhận hàng', { variant: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !order) {
    return <Typography>Đang tải...</Typography>;
  }

  const canConfirm = order.status === 'Draft';
  const canCancel = order.status === 'Draft';
  const canReceive = order.status === 'Confirmed' || order.status === 'PartiallyReceived';

  return (
    <Grid container spacing={3}>
      {/* Header */}
      <Grid xs={12}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h4">Đơn nhập hàng #{order.orderNumber}</Typography>
            <Label color={STATUS_COLOR_MAP[order.status]}>{STATUS_LABEL_MAP[order.status] || order.status}</Label>
          </Stack>
          <Stack direction="row" spacing={1}>
            {canConfirm && (
              <LoadingButton variant="contained" color="info" loading={actionLoading} onClick={handleConfirm}
                startIcon={<Iconify icon="eva:checkmark-circle-2-fill" />}>
                Duyệt
              </LoadingButton>
            )}
            {canReceive && !receiveMode && (
              <Button variant="contained" color="warning" onClick={() => setReceiveMode(true)}
                startIcon={<Iconify icon="solar:box-bold" />}>
                Nhận hàng
              </Button>
            )}
            {canCancel && (
              <LoadingButton variant="outlined" color="error" loading={actionLoading} onClick={handleCancel}
                startIcon={<Iconify icon="solar:close-circle-bold" />}>
                Hủy đơn
              </LoadingButton>
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
              <Typography variant="caption" color="text.secondary">Nhà cung cấp</Typography>
              <Typography variant="body2">{order.supplierName}</Typography>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Kho nhập</Typography>
              <Typography variant="body2">{order.warehouseName}</Typography>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Ngày tạo</Typography>
              <Typography variant="body2">{fDateTime(order.createdAt)}</Typography>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Ngày dự kiến</Typography>
              <Typography variant="body2">{order.expectedDate ? fDateTime(order.expectedDate) : '—'}</Typography>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Người tạo</Typography>
              <Typography variant="body2">{order.createdByName}</Typography>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">Người duyệt</Typography>
              <Typography variant="body2">{order.approvedByName || '—'}</Typography>
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
          </Stack>
        </Card>
      </Grid>

      {/* Items table */}
      <Grid xs={12}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Chi tiết sản phẩm {receiveMode && <Chip label="Chế độ nhận hàng" color="warning" size="small" sx={{ ml: 1 }} />}
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sản phẩm</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell align="right">SL đặt</TableCell>
                <TableCell align="right">Đã nhận</TableCell>
                {receiveMode && <TableCell align="right" width={120}>Nhận lần này</TableCell>}
                <TableCell align="right">Đơn giá</TableCell>
                <TableCell align="right">VAT%</TableCell>
                <TableCell align="right">Chiết khấu</TableCell>
                <TableCell align="right">Thành tiền</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(order.items || []).map((item: IPurchaseOrderItem) => {
                const remaining = item.quantity - item.receivedQuantity;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.productName}
                      {item.variantName && <Typography variant="caption" color="text.secondary"> ({item.variantName})</Typography>}
                    </TableCell>
                    <TableCell>{item.productSKU}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">
                      {item.receivedQuantity}
                      {item.receivedQuantity >= item.quantity && (
                        <Iconify icon="eva:checkmark-circle-2-fill" sx={{ ml: 0.5, color: 'success.main', width: 16 }} />
                      )}
                    </TableCell>
                    {receiveMode && (
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={receiveQuantities[item.id] || 0}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(remaining, Number(e.target.value)));
                            setReceiveQuantities((prev) => ({ ...prev, [item.id]: val }));
                          }}
                          inputProps={{ min: 0, max: remaining }}
                          sx={{ width: 80 }}
                          disabled={remaining <= 0}
                          helperText={remaining > 0 ? `Còn ${remaining}` : 'Đủ'}
                        />
                      </TableCell>
                    )}
                    <TableCell align="right">{fCurrency(item.unitPrice)}</TableCell>
                    <TableCell align="right">{item.vatRate}%</TableCell>
                    <TableCell align="right">{fCurrency(item.discountAmount)}</TableCell>
                    <TableCell align="right">{fCurrency(item.totalPrice)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {receiveMode && (
            <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 3 }}>
              <Button variant="outlined" onClick={() => setReceiveMode(false)}>Hủy</Button>
              <LoadingButton variant="contained" color="warning" loading={actionLoading} onClick={handleReceive}>
                Xác nhận nhận hàng
              </LoadingButton>
            </Stack>
          )}
        </Card>
      </Grid>
    </Grid>
  );
}
