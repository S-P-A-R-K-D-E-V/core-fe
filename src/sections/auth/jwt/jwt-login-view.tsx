'use client';

import * as Yup from 'yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { GoogleLogin } from '@react-oauth/google';
import FacebookLogin from 'react-facebook-login/dist/facebook-login-render-props';

import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { useBoolean } from 'src/hooks/use-boolean';

import { useAuthContext } from 'src/auth/hooks';
import { PATH_AFTER_LOGIN, FACEBOOK_APP_ID } from 'src/config-global';

import Iconify from 'src/components/iconify';
import FormProvider, { RHFTextField } from 'src/components/hook-form';

// ----------------------------------------------------------------------

export default function JwtLoginView() {
  const { login, resendOtp, verifyOtp, loginWithOAuth } = useAuthContext();

  const router = useRouter();

  const [errorMsg, setErrorMsg] = useState('');

  const searchParams = useSearchParams();

  const returnTo = searchParams.get('returnTo');

  const password = useBoolean();

  const LoginSchema = Yup.object().shape({
    email: Yup.string().required('Email is required').email('Email must be a valid email address'),
    password: Yup.string().required('Password is required'),
  });

  const defaultValues = {
    email: '',
    password: '',
  };

  const methods = useForm({
    resolver: yupResolver(LoginSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await login?.(data.email, data.password);

      router.push(returnTo || PATH_AFTER_LOGIN);
    } catch (error) {
      console.error(error);
      const responseErrors = error?.errors;

      // If OTP required, redirect to verify-otp page
      if (responseErrors?.['OTP_REQUIRED'] || error?.message?.includes('OTP_REQUIRED')) {
        router.push(`${paths.auth.jwt.verifyOtp}?email=${encodeURIComponent(data.email)}`);
        return;
      }

      // Email not verified — resend OTP then redirect
      if (responseErrors?.['User.EmailNotVerified']) {
        const msg = responseErrors['User.EmailNotVerified'][0] ?? 'Email has not been verified.';
        setErrorMsg(msg);
        try {
          await resendOtp?.(data.email);
        } catch (_) {
          // ignore resend errors
        }
        router.push(`${paths.auth.jwt.verifyOtp}?email=${encodeURIComponent(data.email)}`);
        return;
      }

      const errMsg = typeof error === 'string' ? error : error?.response?.data?.title || error?.title || error?.message || '';
      reset();
      setErrorMsg(errMsg || 'Đăng nhập thất bại');
    }
  });

  const renderHead = (
    <Stack spacing={2} sx={{ mb: 5 }}>
      <Typography variant="h4">Sign in to CiCi</Typography>

      <Stack direction="row" spacing={0.5}>
        <Typography variant="body2">New user?</Typography>

        <Link component={RouterLink} href={paths.auth.jwt.register} variant="subtitle2">
          Create an account
        </Link>
      </Stack>
    </Stack>
  );

  const renderForm = (
    <Stack spacing={2.5}>
      <RHFTextField name="email" label="Email address" />

      <RHFTextField
        name="password"
        label="Password"
        type={password.value ? 'text' : 'password'}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={password.onToggle} edge="end">
                <Iconify icon={password.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Link variant="body2" color="inherit" underline="always" sx={{ alignSelf: 'flex-end' }}>
        Forgot password?
      </Link>

      <LoadingButton
        fullWidth
        color="inherit"
        size="large"
        type="submit"
        variant="contained"
        loading={isSubmitting}
      >
        Login
      </LoadingButton>

      <Divider sx={{ my: 0.5 }}>
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          OR
        </Typography>
      </Divider>

      <GoogleLogin
        onSuccess={async (resp) => {
          try {
            await loginWithOAuth?.('google', resp.credential!);
            router.push(returnTo || PATH_AFTER_LOGIN);
          } catch (err) {
            setErrorMsg('Đăng nhập Google thất bại');
          }
        }}
        onError={() => setErrorMsg('Đăng nhập Google thất bại')}
        width="100%"
        text="continue_with"
        shape="rectangular"
        size="large"
        locale="vi"
      />

      <FacebookLogin
        appId={FACEBOOK_APP_ID}
        fields="name,email,first_name,last_name,picture"
        callback={async (resp: any) => {
          if (!resp?.accessToken) return;
          try {
            await loginWithOAuth?.('facebook', resp.accessToken);
            router.push(returnTo || PATH_AFTER_LOGIN);
          } catch (err) {
            setErrorMsg('Đăng nhập Facebook thất bại');
          }
        }}
        render={(renderProps: any) => (
          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<Iconify icon="logos:facebook" width={22} />}
            onClick={renderProps.onClick}
            disabled={renderProps.isDisabled}
            sx={{ borderColor: '#1877F2', color: '#1877F2', '&:hover': { borderColor: '#1877F2', bgcolor: 'rgba(24,119,242,0.04)' } }}
          >
            Continue with Facebook
          </Button>
        )}
      />
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

      <FormProvider methods={methods} onSubmit={onSubmit}>
        {renderForm}
      </FormProvider>
    </>
  );
}
