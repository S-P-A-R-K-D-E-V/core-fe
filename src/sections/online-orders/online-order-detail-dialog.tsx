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

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';
import {
  statusChip,
  CARRIER_LABEL,
  ONLINE_ORDER_STATUS,
  SHIPPING_STATUS_LABEL,
  ONLINE_SHIPMENT_STATUS,
  ONLINE_PAYMENT_METHOD_LABEL,
} from 'src/utils/payment-status';

import { useAuthContext } from 'src/auth/hooks';
import { hasAnyRole, getUserRoles, MANAGER_ROLES } from 'src/auth/roles';
import {
  packOnlineOrder,
  shipOnlineOrder,
  getOnlineOrder,
  cancelOnlineOrder,
  completeOnlineOrder,
  cancelOnlineOrderShipment,
} from 'src/api/online-orders';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { onlineOrderActions } from './online-order-actions';

// ----------------------------------------------------------------------
// Chi tiết đơn online: khách, sản phẩm, giao hàng, tiền (khách trả / cước hãng / cửa hàng bù / phí đối soát), và việc
// tiếp theo: Đã gói xong → Tạo vận đơn (hãng tới lấy) hoặc Khách đã nhận (nhận tại cửa hàng). Nhân viên đang làm mở từ
// thông báo "đơn đã thanh toán — cần gói hàng"; huỷ đơn / huỷ vận đơn chỉ chủ và quản lý.
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
      <Typography variant="body2" sx={{ color: 'text.secondary', width: 160, flexShrink: 0 }}>
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
  const { user } = useAuthContext();
  const manager = hasAnyRole(getUserRoles(user), MANAGER_ROLES);
  const [confirm, confirmDialog] = useConfirmDialog();
  const [detail, setDetail] = useState<IOnlineOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

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

  const run = async (key: string, action: () => Promise<IOnlineOrder>, done: string, failed: string) => {
    setBusy(key);
    try {
      const res = await action();
      setDetail((prev) => ({ ...res, lines: res.lines ?? prev?.lines }));
      enqueueSnackbar(done);
      onChanged(res);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, failed), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const chip = statusChip(ONLINE_ORDER_STATUS, detail?.status);
  const shipping = detail?.shipping;
  const costs = detail?.costs;
  const actions = detail ? onlineOrderActions(detail, manager) : null;
  const shipChip = shipping && detail?.status === 'paid' ? statusChip(ONLINE_SHIPMENT_STATUS, shipping.shipmentStatus) : null;

  const handleShip = async () => {
    if (!detail) return;
    const estimate = costs?.shippingCost ? ` Cước báo giá lúc đặt: ${fCurrency(costs.shippingCost)} (hãng có thể cân lại).` : '';
    const ok = await confirm({
      title: 'Tạo vận đơn?',
      content: `Gửi đơn ${detail.code} cho ${CARRIER_LABEL[shipping?.carrier ?? ''] ?? 'hãng vận chuyển'} tới lấy hàng — cước trừ vào tài khoản hãng của cửa hàng.${estimate}`,
      confirmText: 'Tạo vận đơn',
    });
    if (ok) await run('ship', () => shipOnlineOrder(detail.id), 'Đã tạo vận đơn', 'Tạo vận đơn thất bại');
  };

  const handleCancel = async () => {
    if (!detail) return;
    const ok = await confirm({
      title: 'Huỷ đơn online?',
      content: `Huỷ đơn ${detail.code} và mã thanh toán của đơn. Khách vẫn chuyển khoản theo mã cũ thì tiền được ghi là "về trễ" ở Thanh toán → Đối soát.`,
      confirmText: 'Huỷ đơn',
      destructive: true,
    });
    if (ok) await run('cancel', () => cancelOnlineOrder(detail.id), 'Đã huỷ đơn', 'Huỷ đơn thất bại');
  };

  const handleCancelShipment = async () => {
    if (!detail) return;
    const ok = await confirm({
      title: 'Huỷ vận đơn?',
      content: `Huỷ vận đơn ${shipping?.trackingCode ?? ''} — chỉ được khi hãng chưa lấy hàng. Đơn quay về "Đã gói", tạo vận đơn lại được.`,
      confirmText: 'Huỷ vận đơn',
      destructive: true,
    });
    if (ok) await run('cancel-shipment', () => cancelOnlineOrderShipment(detail.id), 'Đã huỷ vận đơn', 'Huỷ vận đơn thất bại');
  };

  return (
    <>
      {confirmDialog}
      <Dialog fullWidth maxWidth="md" open={!!order} onClose={onClose}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          Đơn {detail?.code}
          {detail && <Chip size="small" color={chip.color} label={chip.label} />}
          {shipChip && <Chip size="small" variant="outlined" color={shipChip.color} label={shipChip.label} />}
          <IconButton onClick={onClose} size="small" sx={{ ml: 'auto' }}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {detail && (
            <Stack spacing={2.5}>
              {detail.fulfillmentError && <Alert severity="warning">{detail.fulfillmentError}</Alert>}

              <Stack spacing={1}>
                <Typography variant="subtitle2">Khách hàng</Typography>
                <InfoRow label="Tên">{detail.customerName}</InfoRow>
                <InfoRow label="Điện thoại">
                  <Link href={`tel:${detail.phone}`}>{detail.phone}</Link>
                </InfoRow>
                {detail.email && <InfoRow label="Email">{detail.email}</InfoRow>}
                {detail.note && <InfoRow label="Ghi chú">{detail.note}</InfoRow>}
                <InfoRow label="Đặt lúc">{fDateTime(detail.createdAt)}</InfoRow>
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
                                {l.weightGrams ? ` · ${l.weightGrams} g` : ''}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{l.quantity}</TableCell>
                            <TableCell align="right">{fCurrency(l.price)}</TableCell>
                            <TableCell align="right">{fCurrency(l.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2">Giao hàng</Typography>
                {shipping?.method === 'pickup' ? (
                  <InfoRow label="Cách nhận">Khách nhận tại cửa hàng</InfoRow>
                ) : (
                  <>
                    <InfoRow label="Giao tới">{detail.address || '—'}</InfoRow>
                    {shipping?.carrier && (
                      <InfoRow label="Hãng">{CARRIER_LABEL[shipping.carrier] ?? shipping.carrier}</InfoRow>
                    )}
                    {shipping?.weightGrams && (
                      <InfoRow label="Khối lượng tính cước">{(shipping.weightGrams / 1000).toLocaleString('vi-VN')} kg</InfoRow>
                    )}
                    {!!shipping?.insuranceValue && <InfoRow label="Khai giá">{fCurrency(shipping.insuranceValue)}</InfoRow>}
                    {shipping?.expectedDeliveryAt && <InfoRow label="Dự kiến giao">{fDateTime(shipping.expectedDeliveryAt)}</InfoRow>}
                    {shipping?.trackingCode && (
                      <InfoRow label="Mã vận đơn">
                        <span style={{ fontFamily: 'monospace' }}>{shipping.trackingCode}</span>
                        {shipping.shippingStatus && ` — ${SHIPPING_STATUS_LABEL[shipping.shippingStatus] ?? shipping.shippingStatus}`}
                      </InfoRow>
                    )}
                  </>
                )}
                {shipping?.packedAt && (
                  <InfoRow label="Đã gói">
                    {fDateTime(shipping.packedAt)}
                    {shipping.packedByName ? ` · ${shipping.packedByName}` : ''}
                  </InfoRow>
                )}
                {shipping?.completedAt && <InfoRow label="Khách đã nhận">{fDateTime(shipping.completedAt)}</InfoRow>}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2">Thanh toán & chi phí</Typography>
                <InfoRow label="Cách trả">
                  {ONLINE_PAYMENT_METHOD_LABEL[detail.paymentMethod] ?? detail.paymentMethod}
                  {detail.paymentCode && (
                    <span style={{ fontFamily: 'monospace' }}> · {detail.paymentCode}</span>
                  )}
                </InfoRow>
                {detail.paidAt && <InfoRow label="Thanh toán lúc">{fDateTime(detail.paidAt)}</InfoRow>}
                {costs && (
                  <>
                    <InfoRow label="Tiền hàng">{fCurrency(costs.subtotal)}</InfoRow>
                    <InfoRow label="Phí ship khách trả">{costs.shippingFee > 0 ? fCurrency(costs.shippingFee) : 'Miễn phí'}</InfoRow>
                    <InfoRow label="Khách trả">
                      <strong>{fCurrency(costs.total)}</strong>
                    </InfoRow>
                    {costs.shippingCost > 0 && (
                      <InfoRow label="Cước hãng (cửa hàng trả)">
                        {fCurrency(costs.shippingCost)}
                        {shipping?.shipmentId ? '' : ' — báo giá lúc đặt'}
                      </InfoRow>
                    )}
                    {costs.shippingSubsidy > 0 && (
                      <InfoRow label="Cửa hàng bù ship">
                        <Typography component="span" variant="body2" color="warning.main">
                          {fCurrency(costs.shippingSubsidy)}
                        </Typography>
                      </InfoRow>
                    )}
                    {costs.paymentFeeMax != null && (
                      <InfoRow label="Phí đối soát">Tối đa {fCurrency(costs.paymentFeeMax)} (ApiPay: miễn phí trong 60 giao dịch đầu tháng)</InfoRow>
                    )}
                    <InfoRow label="Còn lại sau cước & phí">
                      <strong>{fCurrency(costs.netAfterShipping)}</strong>
                    </InfoRow>
                  </>
                )}
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

              {detail.status === 'pending_payment' && (
                <Alert severity="info">
                  Đơn chưa thanh toán không giữ hàng trong kho. Khách chuyển khoản đúng mã thanh toán thì đơn tự chuyển
                  sang Đã thanh toán, sinh hoá đơn và báo người đang làm gói hàng.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          {actions?.cancel && (
            <Button color="error" onClick={handleCancel} disabled={!!busy} sx={{ mr: 'auto' }}>
              Huỷ đơn
            </Button>
          )}
          {actions?.cancelShipment && (
            <LoadingButton color="error" loading={busy === 'cancel-shipment'} onClick={handleCancelShipment} sx={{ mr: 'auto' }}>
              Huỷ vận đơn
            </LoadingButton>
          )}
          {actions?.pack && detail && (
            <LoadingButton
              variant="outlined"
              loading={busy === 'pack'}
              onClick={() => run('pack', () => packOnlineOrder(detail.id), 'Đã đánh dấu gói xong', 'Thao tác thất bại')}
            >
              Đã gói xong
            </LoadingButton>
          )}
          {actions?.ship && (
            <LoadingButton variant="contained" loading={busy === 'ship'} onClick={handleShip}>
              Tạo vận đơn
            </LoadingButton>
          )}
          {actions?.complete && detail && (
            <LoadingButton
              variant="contained"
              color="success"
              loading={busy === 'complete'}
              onClick={() => run('complete', () => completeOnlineOrder(detail.id), 'Đã ghi nhận khách nhận hàng', 'Thao tác thất bại')}
            >
              Khách đã nhận
            </LoadingButton>
          )}
          <Button variant="outlined" onClick={onClose}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
