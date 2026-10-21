'use client';

import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { formatCountdown, resendSecondsLeft } from './utils';

// ----------------------------------------------------------------------
// Bước nhập OTP ngân hàng gửi về SĐT chủ tài khoản (đăng ký hoặc huỷ) — đếm ngược trước khi cho gửi lại mã.
// ----------------------------------------------------------------------

type Props = {
  intro: React.ReactNode;
  maskedMobile?: string | null;
  otpSentAt?: string | null;
  otp: string;
  onOtpChange: (value: string) => void;
  onSubmit: VoidFunction;
  /** Gửi lại mã; không có = không gửi lại được ở bước này */
  onResend?: VoidFunction;
  resendLabel?: string;
  busy?: boolean;
  error?: string | null;
};

export default function OtpStep({
  intro,
  maskedMobile,
  otpSentAt,
  otp,
  onOtpChange,
  onSubmit,
  onResend,
  resendLabel = 'Gửi lại mã',
  busy,
  error,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const left = resendSecondsLeft(otpSentAt, now);

  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [left]);

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">
        {intro}
        {maskedMobile ? (
          <>
            {' '}
            Mã OTP đã gửi tới số <b>{maskedMobile}</b>.
          </>
        ) : null}
      </Alert>

      <TextField
        autoFocus
        label="Mã OTP"
        value={otp}
        onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
        }}
        inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
      />

      {onResend && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Chưa nhận được mã?
          </Typography>
          <Button size="small" onClick={onResend} disabled={busy || left > 0}>
            {left > 0 ? `${resendLabel} (${formatCountdown(left)})` : resendLabel}
          </Button>
        </Stack>
      )}

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
