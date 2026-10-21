'use client';

import type { IBankLink } from 'src/types/payment-service';

import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { apiErrorMessage } from 'src/utils/api-error';

import { revokeBankLink, confirmBankLink, cancelBankLinkRevoke } from 'src/api/payment-settings';

import OtpStep from './otp-step';
import {
  isOtp,
  mobileError,
  identityLabel,
  cleanIdentity,
  identityError,
  normalizeMobile,
} from './utils';

// ----------------------------------------------------------------------
// Huỷ đăng ký báo có: ngân hàng đòi lại CCCD / MST + SĐT của chủ tài khoản rồi gửi OTP → xác thực → ngừng báo có, kết
// nối của tài khoản tắt. Đang chờ OTP huỷ thì mở thẳng bước OTP, hoặc "Giữ đăng ký" để bỏ yêu cầu huỷ.
// ----------------------------------------------------------------------

type Step = 'form' | 'otp' | 'done';

type Props = {
  link: IBankLink | null;
  onClose: VoidFunction;
  onChanged: VoidFunction;
};

export default function BankLinkRevokeDialog({ link, onClose, onChanged }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [identity, setIdentity] = useState('');
  const [mobile, setMobile] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<IBankLink | null>(null);

  useEffect(() => {
    if (!link) return;
    setCurrent(link);
    setStep(link.status === 'revoking' ? 'otp' : 'form');
    setIdentity('');
    setMobile('');
    setShowErrors(false);
    setOtp('');
    setBusy(false);
    setError(null);
  }, [link]);

  const idError = identityError(current?.accountType ?? '', identity);
  const phoneError = mobileError(mobile);
  const canResend = !!identity && !!mobile;

  const request = async () => {
    if (!current) return;
    setShowErrors(true);
    if (idError || phoneError) return;
    setBusy(true);
    setError(null);
    try {
      const res = await revokeBankLink(current.id, {
        identity: cleanIdentity(identity),
        mobile: normalizeMobile(mobile),
      });
      setCurrent(res);
      setOtp('');
      setStep(res.status === 'revoking' ? 'otp' : 'done');
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Ngân hàng chưa nhận yêu cầu huỷ — kiểm tra lại thông tin'));
      setStep('form');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!current || !isOtp(otp)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await confirmBankLink(current.id, otp.trim());
      setCurrent(res);
      setIdentity('');
      setMobile('');
      setStep('done');
      onChanged();
    } catch (err) {
      setError(apiErrorMessage(err, 'Xác thực OTP thất bại'));
    } finally {
      setBusy(false);
    }
  };

  const keep = async () => {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await cancelBankLinkRevoke(current.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Không bỏ được yêu cầu huỷ'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!link} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Huỷ đăng ký báo có</DialogTitle>

      <DialogContent dividers>
        {step === 'form' && current && (
          <Stack spacing={2.5}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Tài khoản <b>{current.accountNumber}</b> ({current.bankName}) sẽ thôi báo tiền về —
              chuyển khoản qua QR phải xác nhận tay. {current.bankName} cần thông tin chủ tài khoản
              để gửi OTP huỷ.
            </Typography>
            <TextField
              label={identityLabel(current.accountType)}
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              error={showErrors && !!idError}
              helperText={showErrors ? idError : undefined}
              inputProps={{ autoComplete: 'off' }}
            />
            <TextField
              label="Số điện thoại"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              error={showErrors && !!phoneError}
              helperText={
                (showErrors && phoneError) || 'SĐT chủ tài khoản đã đăng ký tại ngân hàng'
              }
              inputProps={{ inputMode: 'tel', autoComplete: 'off' }}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}

        {step === 'otp' && current && (
          <OtpStep
            intro={`Nhập mã OTP ${current.bankName || 'ngân hàng'} gửi để huỷ báo có tài khoản ${current.accountNumber}.`}
            maskedMobile={current.maskedMobile}
            otpSentAt={current.otpSentAt}
            otp={otp}
            onOtpChange={setOtp}
            onSubmit={confirm}
            onResend={canResend ? request : () => setStep('form')}
            resendLabel={canResend ? 'Gửi lại mã' : 'Nhập lại thông tin để gửi mã mới'}
            busy={busy}
            error={error}
          />
        )}

        {step === 'done' && current && (
          <Alert severity="success">
            Đã huỷ báo có tài khoản {current.accountNumber}. Tài khoản vẫn ở Tài khoản ngân hàng để
            hiện VietQR; đăng ký lại bất cứ lúc nào.
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        {step === 'form' && (
          <>
            <Button color="inherit" onClick={onClose} disabled={busy}>
              Đóng
            </Button>
            <LoadingButton variant="contained" color="error" loading={busy} onClick={request}>
              Gửi yêu cầu huỷ
            </LoadingButton>
          </>
        )}
        {step === 'otp' && (
          <>
            <Button color="inherit" onClick={keep} disabled={busy}>
              Giữ đăng ký
            </Button>
            <LoadingButton
              variant="contained"
              color="error"
              loading={busy}
              disabled={!isOtp(otp)}
              onClick={confirm}
            >
              Xác nhận huỷ
            </LoadingButton>
          </>
        )}
        {step === 'done' && (
          <Button variant="contained" onClick={onClose}>
            Xong
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
