'use client';

import type { IOpenOrder, FnbPaymentMethod } from 'src/types/fnb';
import type { IQrPaymentResponse, IKiotVietBankAccount } from 'src/types/corecms-api';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';

import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { usePaymentStatusEvents } from 'src/hooks/use-payment-status-events';

import { fCurrency } from 'src/utils/format-number';
import { qrOutcome, isEventForQr } from 'src/utils/payment-status';

import { getBankAccounts } from 'src/api/bank-accounts';
import { cancelQrPayment, createQrPayment, getQrPaymentStatus } from 'src/api/payment-qr';

import PaymentQrInfo, { useQrImageSrc, useExpirySeconds } from 'src/components/payment-qr-info';

import { changeDue, quickCashOptions } from './lib/checkout';

import type { PaymentInput } from './lib/checkout';

// ----------------------------------------------------------------------
// Chuyển khoản: hiện mã VietQR đúng số tiền + nội dung (dùng chung với Bán hàng). Cửa hàng có đối soát tiền về tự động
// thì mã chuyển "COMPLETED" và đơn tự thanh toán; không thì nhân viên thấy tiền về rồi bấm Thanh toán như cũ.
// Bật dịch vụ thanh toán: tiền về báo ngay qua SignalR (vẫn hỏi 4 s làm dự phòng), mã có nội dung CK + hạn dùng.
// ----------------------------------------------------------------------

const QR_POLL_MS = 4_000;

type Props = {
  open: boolean;
  order: IOpenOrder | null;
  /** Tổng sẽ thanh toán (đơn trên máy chủ + món đang chọn chưa gửi, xem trước). */
  total: number;
  /** Còn món đang chọn chưa gửi — sẽ gửi bar cùng lúc thanh toán. */
  hasDrafts: boolean;
  busy: boolean;
  onClose: VoidFunction;
  onPay: (payment: PaymentInput) => void;
};

export default function FnbCheckoutDialog({ open, order, total, hasDrafts, busy, onClose, onPay }: Props) {
  const [method, setMethod] = useState<FnbPaymentMethod>('Cash');
  const [cash, setCash] = useState('');
  const [accounts, setAccounts] = useState<IKiotVietBankAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [transferRef, setTransferRef] = useState('');
  const [qr, setQr] = useState<IQrPaymentResponse | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrRef = useRef<IQrPaymentResponse | null>(null);
  qrRef.current = qr;

  /** Bỏ mã QR đang hiện (đổi phương thức / tài khoản / số tiền, đóng hộp thoại). */
  const dropQr = () => {
    const current = qrRef.current;
    if (current) cancelQrPayment(current.id).catch(() => {});
    setQr(null);
    setQrError(null);
  };

  useEffect(() => {
    if (!open) {
      dropQr();
      return;
    }
    setMethod('Cash');
    setCash('');
    setTransferRef(order ? `${order.tableName ?? 'Mang ve'} #${order.displayNo}` : '');
    getBankAccounts()
      .then((list) => {
        setAccounts(list);
        setAccountId((current) => current || list[0]?.id || '');
      })
      .catch(() => setAccounts([]));
  }, [open, order]);

  const cashGiven = cash === '' ? null : Number(cash);
  const tooLow = method === 'Cash' && cashGiven !== null && cashGiven < total;

  const payInput = (): PaymentInput => ({
    method,
    cashGiven: method === 'Cash' ? cashGiven : null,
    bankAccountId: method === 'Transfer' ? accountId || null : null,
    transferRef: method === 'Transfer' ? transferRef : null,
  });

  /** Trả bằng mã QR đang hiện: mã giao dịch = mã thanh toán của QR (core-be gắn QR với hoá đơn); không có mã → như cũ. */
  const payInputForQr = (paymentCode: string | null | undefined): PaymentInput => {
    const input = payInput();
    return paymentCode ? { ...input, transferRef: paymentCode } : input;
  };

  // Mã QR cũ không còn đúng khi đổi tài khoản / số tiền / phương thức.
  useEffect(() => {
    dropQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, accountId, total]);

  /** Trạng thái mã (poll hoặc SignalR): tiền về → thanh toán luôn; huỷ / hết hạn → báo tạo lại. true = đã xử lý xong mã. */
  const handleQrStatus = (qrId: string, status: string) => {
    if (qrRef.current?.id !== qrId) return true; // mã đã bỏ / đã xử lý (poll và SignalR cùng báo)
    const outcome = qrOutcome(status);
    if (outcome === 'pending') return false;
    const paymentCode = qrRef.current?.paymentCode;
    qrRef.current = null;
    setQr(null);
    if (outcome === 'completed') onPay(payInputForQr(paymentCode));
    else if (outcome === 'cancelled') setQrError('Mã QR đã bị huỷ — tạo lại mã.');
    else setQrError('Mã QR đã hết hạn — bấm Hiện mã QR để tạo mã mới.');
    return true;
  };

  // Tiền về (đối soát tự động) → thanh toán luôn.
  useEffect(() => {
    if (!qr || busy) return undefined;
    const timer = setInterval(async () => {
      try {
        const status = await getQrPaymentStatus(qr.id);
        if (handleQrStatus(qr.id, status.status)) clearInterval(timer);
      } catch {
        // thử lại lần sau
      }
    }, QR_POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr, busy]);

  usePaymentStatusEvents((event) => {
    if (!qr || busy || !isEventForQr(event, qr.id)) return;
    handleQrStatus(qr.id, event.status);
  });

  const qrImageSrc = useQrImageSrc(qr?.qrDataUrl, qr?.qrPayload);
  const secondsLeft = useExpirySeconds(qr?.expiresAt);

  const showQr = async () => {
    if (!accountId || total <= 0) return;
    setQrLoading(true);
    setQrError(null);
    try {
      setQr(await createQrPayment({ bankAccountId: accountId, amount: total, description: transferRef.trim() || undefined }));
    } catch {
      setQrError('Không tạo được mã QR cho tài khoản này — vẫn thanh toán chuyển khoản bằng tay được.');
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={busy ? undefined : onClose}>
      <DialogTitle>Thanh toán · {fCurrency(total)}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {hasDrafts && <Alert severity="info">Món đang chọn sẽ được gửi bar cùng lúc thanh toán.</Alert>}

          <ToggleButtonGroup exclusive fullWidth value={method} onChange={(_, v) => v && setMethod(v)}>
            <ToggleButton value="Cash">Tiền mặt</ToggleButton>
            <ToggleButton value="Transfer">Chuyển khoản</ToggleButton>
            <ToggleButton value="Card">Thẻ</ToggleButton>
          </ToggleButtonGroup>

          {method === 'Cash' && (
            <Stack spacing={1.5}>
              <TextField
                type="number"
                label="Khách đưa"
                value={cash}
                placeholder={String(total)}
                onChange={(e) => setCash(e.target.value)}
                inputProps={{ min: 0, step: 1000 }}
                error={tooLow}
                helperText={tooLow ? 'Khách đưa ít hơn tổng tiền.' : 'Để trống = khách đưa vừa đủ.'}
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {quickCashOptions(total).map((amount) => (
                  <Chip key={amount} label={fCurrency(amount)} onClick={() => setCash(String(amount))} />
                ))}
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle1">Tiền thối</Typography>
                <Typography variant="subtitle1" color="primary.main">
                  {fCurrency(changeDue(total, cashGiven))}
                </Typography>
              </Stack>
            </Stack>
          )}

          {method === 'Transfer' && (
            <Stack spacing={1.5}>
              <TextField
                select
                label="Tài khoản nhận"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                helperText={accounts.length === 0 ? 'Chưa khai tài khoản ngân hàng của cửa hàng — vẫn ghi nhận được.' : undefined}
              >
                <MenuItem value="">— Không chọn —</MenuItem>
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {[a.shortName || a.bankName, a.accountNumber, a.description].filter(Boolean).join(' · ')}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Nội dung chuyển khoản"
                value={transferRef}
                onChange={(e) => {
                  setTransferRef(e.target.value);
                  if (qr) dropQr();
                }}
              />
              {accountId && !qr && (
                <LoadingButton variant="outlined" loading={qrLoading} onClick={showQr} sx={{ alignSelf: 'flex-start' }}>
                  Hiện mã QR
                </LoadingButton>
              )}
              {qrError && <Alert severity="warning">{qrError}</Alert>}
              {qr && qrImageSrc && (
                <Stack alignItems="center" spacing={1}>
                  <Box
                    component="img"
                    src={qrImageSrc}
                    alt="Mã QR chuyển khoản"
                    sx={{ width: 240, height: 240, objectFit: 'contain', borderRadius: 1, bgcolor: 'common.white' }}
                  />
                  <Typography variant="caption" color="text.secondary" textAlign="center">
                    {fCurrency(total)} · {qr.bankName ?? ''} {qr.accountNumber ?? ''} — đang chờ tiền về; tiền về là tự thanh
                    toán.
                  </Typography>
                  <PaymentQrInfo paymentCode={qr.paymentCode} secondsLeft={secondsLeft} />
                </Stack>
              )}
              <Typography variant="caption" color="text.secondary">
                Không tự nhận được tiền về thì bấm Thanh toán khi đã thấy tiền vào tài khoản.
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          Huỷ
        </Button>
        <LoadingButton
          variant="contained"
          loading={busy}
          disabled={tooLow}
          onClick={() => {
            const input = qr ? payInputForQr(qr.paymentCode) : payInput();
            if (qr) {
              // Thanh toán tay khi đã thấy tiền: bỏ theo dõi mã (không huỷ — tiền có thể đang về theo mã này).
              setQr(null);
            }
            onPay(input);
          }}
        >
          Thanh toán
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
