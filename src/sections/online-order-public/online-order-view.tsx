'use client';

import type { IStorefrontOrder, IStorefrontPayment } from 'src/types/online-shop';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useCopyToClipboard } from 'src/hooks/use-copy-to-clipboard';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { getOnlineOrderPublic, retryOnlineOrderPayment } from 'src/api/online-shop';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useQrImageSrc, useExpirySeconds } from 'src/components/payment-qr-info';

import { useCheckoutContext } from 'src/sections/checkout/context';
import { orderHref, formatEta } from 'src/sections/checkout/online-checkout-utils';

import { deliveryStatusText } from './online-order-status';

// ----------------------------------------------------------------------
// Trang đơn của khách: chờ thanh toán → mã VietQR (vào số tài khoản / VA của kết nối cửa hàng chọn, nội dung = mã thanh
// toán) hoặc nút sang cổng payOS / VNPay; hỏi máy chủ 3 giây/lần (máy chủ hỏi lại S Payment phòng callback lỡ). Đã trả →
// cảm ơn + tình trạng gói / giao. Hết hạn → tạo mã mới.
// ----------------------------------------------------------------------

const POLL_MS = 3_000;

type Props = { code: string };

export default function OnlineOrderView({ code }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const checkout = useCheckoutContext();
  const token = searchParams.get('t') ?? '';
  const justPlaced = searchParams.get('new') === '1';
  const { enqueueSnackbar } = useSnackbar();

  // Vừa đặt từ trang đặt hàng: làm trống giỏ, nhớ đơn trên máy, bỏ ?new khỏi địa chỉ (tải lại không làm lại).
  useEffect(() => {
    if (!justPlaced || !token) return;
    checkout.onOrderPlaced(code, token);
    router.replace(orderHref(code, token));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justPlaced, code, token]);

  const [order, setOrder] = useState<IStorefrontOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await getOnlineOrderPublic(code, token));
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không tìm thấy đơn hàng'));
    }
  }, [code, token]);

  useEffect(() => {
    load();
  }, [load]);

  // Còn chờ thanh toán thì hỏi lại; trang đang ẩn (khách chuyển sang app ngân hàng) vẫn hỏi để quay lại là thấy ngay.
  useEffect(() => {
    if (order?.status !== 'pending_payment') return undefined;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [order?.status, load]);

  const retry = async () => {
    setRetrying(true);
    try {
      await retryOnlineOrderPayment(code, token);
      await load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tạo được mã mới'), { variant: 'error' });
    } finally {
      setRetrying(false);
    }
  };

  if (error && !order) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">{error}</Alert>
        <Button component={RouterLink} href={paths.product.root} sx={{ mt: 3 }}>
          Tiếp tục mua sắm
        </Button>
      </Container>
    );
  }
  if (!order) {
    return (
      <Stack alignItems="center" sx={{ py: 10 }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 6 } }}>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4" component="h1">
            Đơn hàng {order.orderCode}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Lưu lại trang này để xem tình trạng đơn.
          </Typography>
        </Stack>

        {order.status === 'pending_payment' && <PaymentPanel payment={order.payment} total={order.total} onRetry={retry} retrying={retrying} />}
        {order.status === 'expired' && (
          <Alert
            severity="warning"
            action={
              <LoadingButton color="inherit" loading={retrying} onClick={retry}>
                Tạo mã mới
              </LoadingButton>
            }
          >
            Mã thanh toán đã hết hạn. Tạo mã mới để thanh toán tiếp — nếu bạn đã chuyển khoản, đơn vẫn tự xác nhận khi tiền về.
          </Alert>
        )}
        {order.status === 'cancelled' && <Alert severity="error">Đơn đã huỷ. Liên hệ cửa hàng nếu bạn đã chuyển khoản.</Alert>}
        {order.status === 'paid' && (
          <Alert severity="success" icon={<Iconify icon="solar:check-circle-bold" />}>
            <Typography variant="subtitle1">Cảm ơn bạn! Đơn đã thanh toán.</Typography>
            <Typography variant="body2">{deliveryStatusText(order)}</Typography>
          </Alert>
        )}

        <Card sx={{ p: 3 }}>
          <Stack spacing={1.5}>
            {order.items.map((item, i) => (
              <Stack key={`${item.name}-${i}`} direction="row" spacing={2} alignItems="center">
                {item.imageUrl ? (
                  <Box component="img" src={item.imageUrl} alt="" sx={{ width: 48, height: 48, borderRadius: 1, objectFit: 'cover' }} />
                ) : (
                  <Box sx={{ width: 48, height: 48, borderRadius: 1, bgcolor: 'background.neutral' }} />
                )}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {item.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.quantity} × {fCurrency(item.price)}
                  </Typography>
                </Box>
                <Typography variant="subtitle2">{fCurrency(item.amount)}</Typography>
              </Stack>
            ))}
            <Divider sx={{ borderStyle: 'dashed' }} />
            <Row label="Tiền hàng" value={fCurrency(order.subtotal)} />
            <Row
              label="Phí giao hàng"
              value={order.delivery.method === 'pickup' ? 'Nhận tại cửa hàng' : order.shippingFee > 0 ? fCurrency(order.shippingFee) : 'Miễn phí'}
            />
            <Row label="Tổng thanh toán" value={fCurrency(order.total)} strong />
            {order.delivery.method === 'ship' && order.delivery.address && (
              <>
                <Divider sx={{ borderStyle: 'dashed' }} />
                <Row label="Giao tới" value={order.delivery.address} />
                {order.delivery.carrierLabel && <Row label="Đơn vị giao" value={order.delivery.carrierLabel} />}
                {order.delivery.expectedDeliveryAt && (
                  <Row label="Dự kiến giao" value={formatEta(order.delivery.expectedDeliveryAt) ?? ''} />
                )}
                {order.delivery.trackingCode && <Row label="Mã vận đơn" value={order.delivery.trackingCode} />}
              </>
            )}
          </Stack>
        </Card>

        <Button component={RouterLink} href={paths.product.root} startIcon={<Iconify icon="eva:arrow-ios-back-fill" />} sx={{ alignSelf: 'flex-start' }}>
          Tiếp tục mua sắm
        </Button>
      </Stack>
    </Container>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant={strong ? 'subtitle1' : 'body2'} sx={{ textAlign: 'right', ...(strong && { color: 'error.main' }) }}>
        {value}
      </Typography>
    </Stack>
  );
}

// ----------------------------------------------------------------------

type PaymentProps = {
  payment: IStorefrontPayment;
  total: number;
  onRetry: () => void;
  retrying: boolean;
};

function PaymentPanel({ payment, total, onRetry, retrying }: PaymentProps) {
  const qrSrc = useQrImageSrc(payment.qrImageUrl, payment.qrPayload);
  const secondsLeft = useExpirySeconds(payment.expiresAt);
  const { copy } = useCopyToClipboard();
  const { enqueueSnackbar } = useSnackbar();
  const due = Math.max(0, total - (payment.amountReceived ?? 0));

  const copyValue = async (value: string, label: string) => {
    const ok = await copy(value);
    enqueueSnackbar(ok ? `Đã sao chép ${label}` : 'Không sao chép được', { variant: ok ? 'success' : 'error' });
  };

  // Cổng thanh toán (payOS / VNPay): sang trang cổng, quay về đây.
  if (payment.checkoutUrl && !qrSrc) {
    return (
      <Card sx={{ p: 3 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Typography variant="h6">Thanh toán {fCurrency(due)}</Typography>
          <Button variant="contained" size="large" href={payment.checkoutUrl}>
            Tới trang thanh toán
          </Button>
          <Typography variant="caption" color="text.secondary">
            Trả xong bạn được đưa về trang này, đơn tự xác nhận.
          </Typography>
        </Stack>
      </Card>
    );
  }

  const expired = secondsLeft !== null && secondsLeft <= 0;
  const minutes = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null;
  const seconds = secondsLeft !== null ? secondsLeft % 60 : null;

  return (
    <Card sx={{ p: 3 }}>
      <Stack spacing={2} alignItems="center">
        <Typography variant="h6" textAlign="center">
          Quét mã bằng app ngân hàng để thanh toán
        </Typography>
        {payment.amountReceived > 0 && (
          <Alert severity="warning" sx={{ width: '100%' }}>
            Đã nhận {fCurrency(payment.amountReceived)} — còn thiếu {fCurrency(due)}. Chuyển thêm phần còn lại với cùng nội dung.
          </Alert>
        )}
        {qrSrc && (
          <Box
            component="img"
            src={qrSrc}
            alt="Mã QR chuyển khoản"
            sx={{ width: 260, height: 260, objectFit: 'contain', bgcolor: 'common.white', borderRadius: 1, opacity: expired ? 0.3 : 1 }}
          />
        )}
        {secondsLeft !== null && !expired && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Đang chờ tiền về · mã còn hiệu lực {minutes}:{String(seconds).padStart(2, '0')}
            </Typography>
          </Stack>
        )}
        {expired && (
          <LoadingButton variant="outlined" loading={retrying} onClick={onRetry}>
            Mã hết hạn — tạo mã mới
          </LoadingButton>
        )}

        <Stack spacing={1} sx={{ width: '100%', maxWidth: 420 }}>
          {payment.bankAccount && (
            <>
              <CopyRow label="Ngân hàng" value={payment.bankAccount.bankName ?? ''} />
              <CopyRow label="Số tài khoản" value={payment.bankAccount.accountNumber} onCopy={() => copyValue(payment.bankAccount!.accountNumber, 'số tài khoản')} />
              {payment.bankAccount.accountName && <CopyRow label="Chủ tài khoản" value={payment.bankAccount.accountName} />}
            </>
          )}
          <CopyRow label="Số tiền" value={fCurrency(due)} onCopy={() => copyValue(String(Math.round(due)), 'số tiền')} />
          {payment.paymentCode && (
            <CopyRow label="Nội dung (bắt buộc)" value={payment.paymentCode} strong onCopy={() => copyValue(payment.paymentCode!, 'nội dung')} />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" textAlign="center">
          Giữ nguyên nội dung chuyển khoản để đơn tự xác nhận. Trang tự cập nhật khi tiền về.
        </Typography>
      </Stack>
    </Card>
  );
}

function CopyRow({ label, value, onCopy, strong }: { label: string; value: string; onCopy?: () => void; strong?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 130 }}>
        {label}
      </Typography>
      <Typography variant={strong ? 'subtitle1' : 'subtitle2'} sx={{ flexGrow: 1, wordBreak: 'break-all', ...(strong && { color: 'primary.main' }) }}>
        {value}
      </Typography>
      {onCopy && (
        <IconButton size="small" onClick={onCopy} aria-label={`Sao chép ${label}`}>
          <Iconify icon="solar:copy-bold" width={18} />
        </IconButton>
      )}
    </Stack>
  );
}
