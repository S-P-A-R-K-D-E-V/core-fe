'use client';

import type { IOnlineOrder } from 'src/types/payment-service';

import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';
import { statusChip, ONLINE_ORDER_STATUS, ONLINE_PAYMENT_METHOD_LABEL } from 'src/utils/payment-status';

import { getOnlineOrder, cancelOnlineOrder } from 'src/api/online-orders';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

type Props = {
  /** Đơn chọn từ danh sách (chưa có lines) — null = đóng */
  order: IOnlineOrder | null;
  onClose: VoidFunction;
  onChanged: (order: IOnlineOrder) => void;
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={2}>
      <Typography variant="body2" sx={{ color: 'text.secondary', width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography component="div" variant="body2" sx={{ wordBreak: 'break-word' }}>
        {children}
      </Typography>
    </Stack>
  );
}

export default function OnlineOrderDetailDialog({ order, onClose, onChanged }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [detail, setDetail] = useState<IOnlineOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!order) {
      setDetail(null);
      return undefined;
    }
    let cancelled = false;
    setDetail(order);
    setLoading(true);
    getOnlineOrder(order.id)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch((err) => {
        if (!cancelled) enqueueSnackbar(apiErrorMessage(err, 'Không tải được chi tiết đơn'), { variant: 'error' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order, enqueueSnackbar]);

  const handleCancel = async () => {
    if (!detail) return;
    setCancelling(true);
    try {
      const res = await cancelOnlineOrder(detail.id);
      setDetail((prev) => ({ ...res, lines: res.lines ?? prev?.lines }));
      setConfirmCancel(false);
      enqueueSnackbar('Đã huỷ đơn');
      onChanged(res);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Huỷ đơn thất bại'), { variant: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  const chip = statusChip(ONLINE_ORDER_STATUS, detail?.status);

  return (
    <>
      <Dialog fullWidth maxWidth="md" open={!!order} onClose={onClose}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Đơn {detail?.code}
          {detail && <Chip size="small" color={chip.color} label={chip.label} />}
          <IconButton onClick={onClose} size="small" sx={{ ml: 'auto' }}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {detail && (
            <Stack spacing={2.5}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Khách hàng</Typography>
                <InfoRow label="Tên">{detail.customerName}</InfoRow>
                <InfoRow label="Điện thoại">{detail.phone}</InfoRow>
                {detail.email && <InfoRow label="Email">{detail.email}</InfoRow>}
                {detail.address && <InfoRow label="Địa chỉ">{detail.address}</InfoRow>}
                {detail.note && <InfoRow label="Ghi chú">{detail.note}</InfoRow>}
                <InfoRow label="Đặt lúc">{fDateTime(detail.createdAt)}</InfoRow>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2">Thanh toán</Typography>
                <InfoRow label="Cách trả">
                  {ONLINE_PAYMENT_METHOD_LABEL[detail.paymentMethod] ?? detail.paymentMethod}
                </InfoRow>
                {detail.paymentCode && (
                  <InfoRow label="Mã thanh toán">
                    <span style={{ fontFamily: 'monospace' }}>{detail.paymentCode}</span>
                  </InfoRow>
                )}
                {detail.paidAt && <InfoRow label="Thanh toán lúc">{fDateTime(detail.paidAt)}</InfoRow>}
                <InfoRow label="Hoá đơn">
                  {detail.salesOrderId ? (
                    <Link component={RouterLink} href={paths.dashboard.pos.salesOrder.details(detail.salesOrderId)}>
                      {detail.salesOrderCode || 'Xem hoá đơn'}
                    </Link>
                  ) : (
                    'Chưa có — hoá đơn chỉ được tạo (và trừ kho) khi khách đã thanh toán'
                  )}
                </InfoRow>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2">Sản phẩm</Typography>
                {loading && !detail.lines ? (
                  <Stack alignItems="center" sx={{ py: 3 }}>
                    <CircularProgress size={24} />
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Sản phẩm</TableCell>
                          <TableCell align="right">SL</TableCell>
                          <TableCell align="right">Đơn giá</TableCell>
                          <TableCell align="right">Thành tiền</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(detail.lines ?? []).map((l, idx) => (
                          <TableRow key={`${l.productId}-${idx}`}>
                            <TableCell>
                              <Typography variant="body2">{l.productName}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {l.productCode}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{l.quantity}</TableCell>
                            <TableCell align="right">{fCurrency(l.price)}</TableCell>
                            <TableCell align="right">{fCurrency(l.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={3} align="right">
                            <Typography variant="subtitle2">Tổng cộng</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="subtitle2">{fCurrency(detail.total)}</Typography>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>

              {detail.status === 'pending_payment' && (
                <Alert severity="info">
                  Đơn chưa thanh toán không giữ hàng trong kho. Khách chuyển khoản đúng mã thanh toán thì đơn tự chuyển
                  sang Đã thanh toán và sinh hoá đơn.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          {detail?.status === 'pending_payment' && (
            <Button color="error" onClick={() => setConfirmCancel(true)} sx={{ mr: 'auto' }}>
              Huỷ đơn
            </Button>
          )}
          <Button variant="outlined" onClick={onClose}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Huỷ đơn online?"
        content={`Huỷ đơn ${detail?.code ?? ''} và mã thanh toán của đơn. Khách vẫn chuyển khoản theo mã cũ thì tiền được ghi là "về trễ" ở Thanh toán → Đối soát.`}
        action={
          <LoadingButton variant="contained" color="error" loading={cancelling} onClick={handleCancel}>
            Huỷ đơn
          </LoadingButton>
        }
      />
    </>
  );
}
