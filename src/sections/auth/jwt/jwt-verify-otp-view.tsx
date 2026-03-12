'use client';

import * as Yup from 'yup';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';
import { PATH_AFTER_LOGIN } from 'src/config-global';

import Iconify from 'src/components/iconify';
import FormProvider, { RHFTextField } from 'src/components/hook-form';

// ----------------------------------------------------------------------

export default function JwtVerifyOtpView() {
  const { verifyOtp, resendOtp, pendingVerification } = useAuthContext();

  const router = useRouter();

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [countdown, setCountdown] = useState(0);

  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email');
  const returnTo = searchParams.get('returnTo');

  const email = pendingVerification?.email || emailParam || '';

  // Redirect if no email to verify
  useEffect(() => {
    if (!email) {
      router.push(paths.auth.jwt.login);
    }
  }, [email, router]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const VerifySchema = Yup.object().shape({
    otpCode: Yup.string()
      .required('Mã OTP không được để trống')
      .length(6, 'Mã OTP phải có 6 chữ số'),
  });

  const defaultValues = {
    otpCode: '',
  };

  const methods = useForm({
    resolver: yupResolver(VerifySchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      setErrorMsg('');
      await verifyOtp?.(email, data.otpCode);
      router.push(returnTo || PATH_AFTER_LOGIN);
    } catch (error) {
      console.error(error);
      reset();
      setErrorMsg(typeof error === 'string' ? error : error.message || 'Mã OTP không hợp lệ');
    }
  });

  const handleResendOtp = useCallback(async () => {
    try {
      setErrorMsg('');
      await resendOtp?.(email);
      setSuccessMsg('Đã gửi lại mã OTP. Vui lòng kiểm tra email.');
      setCountdown(60);
    } catch (error) {
      console.error(error);
      setErrorMsg(typeof error === 'string' ? error : error.message || 'Không thể gửi lại mã OTP');
    }
  }, [email, resendOtp]);

  const renderHead = (
    <Stack spacing={2} sx={{ mb: 5 }}>
      <Typography variant="h4">Xác thực email</Typography>

      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Chúng tôi đã gửi mã OTP 6 chữ số đến email{' '}
        <Typography component="span" variant="subtitle2" sx={{ color: 'text.primary' }}>
          {email}
        </Typography>
      </Typography>
    </Stack>
  );

  const renderForm = (
    <Stack spacing={3}>
      <RHFTextField
        name="otpCode"
        label="Mã OTP"
        placeholder="000000"
        inputProps={{
          maxLength: 6,
          style: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700 },
        }}
      />

      <LoadingButton
        fullWidth
        color="inherit"
        size="large"
        type="submit"
        variant="contained"
        loading={isSubmitting}
        startIcon={<Iconify icon="solar:shield-check-bold" />}
      >
        Xác thực
      </LoadingButton>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Không nhận được mã?
        </Typography>

        <Button
          variant="text"
          size="small"
          onClick={handleResendOtp}
          disabled={countdown > 0}
          sx={{ fontWeight: 600 }}
        >
          {countdown > 0 ? `Gửi lại (${countdown}s)` : 'Gửi lại mã OTP'}
        </Button>
      </Stack>

      <Link
        component={RouterLink}
        href={paths.auth.jwt.login}
        variant="body2"
        color="inherit"
        underline="always"
        sx={{ alignSelf: 'center' }}
      >
        Quay lại đăng nhập
      </Link>
    </Stack>
  );

  return (
    <>
      {renderHead}

      {!!errorMsg && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMsg}
        </Alert>
      )}

      {!!successMsg && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMsg}
        </Alert>
      )}

      <FormProvider methods={methods} onSubmit={onSubmit}>
        {renderForm}
      </FormProvider>
    </>
  );
}
