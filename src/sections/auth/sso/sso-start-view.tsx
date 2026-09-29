'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { GoogleLogin } from '@react-oauth/google';

import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { useSearchParams } from 'src/routes/hooks';

import axios, { endpoints } from 'src/utils/axios';
import { apiErrorMessage } from 'src/utils/api-error';

import {
  SAAS_ZONE,
  isAuthHost,
  sha256Hex,
  randomToken,
  isValidTenantCode,
  APPLE_SERVICES_ID,
  AUTH_HOST,
} from 'src/auth/utils/saas-host';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

type AppleSignInResponse = {
  authorization: { id_token: string; code: string };
  user?: { name?: { firstName?: string; lastName?: string }; email?: string };
};

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: Record<string, unknown>) => void;
        signIn: () => Promise<AppleSignInResponse>;
      };
    };
  }
}

const APPLE_SDK = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/vi_VN/appleid.auth.js';

function loadAppleSdk(): Promise<void> {
  if (window.AppleID) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = APPLE_SDK;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được Sign in with Apple'));
    document.head.appendChild(script);
  });
}

const STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Chạy trên auth.devbyspark.com — tên miền DUY NHẤT đăng ký với Google/Apple cho mọi cửa hàng SaaS.
 * Xác minh Google/Apple cho cửa hàng trong ?tenant=, backend trả URL /sso/callback của đúng cửa
 * hàng đó kèm mã dùng một lần. Trang này không giữ phiên đăng nhập nào.
 */
export default function SsoStartView() {
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const tenant = searchParams.get('tenant');
  const state = searchParams.get('state');
  const returnTo = searchParams.get('returnTo');

  // Host chỉ biết được ở trình duyệt; đọc sau khi mount để HTML render ở server và lần render đầu
  // ở client giống nhau.
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => {
    setHost(window.location.host);
  }, []);

  const invalidRequest = useMemo(() => {
    if (host !== null && !isAuthHost(host)) {
      return `Trang này chỉ dùng tại ${AUTH_HOST}.`;
    }
    if (!isValidTenantCode(tenant) || !state || !STATE_PATTERN.test(state)) {
      return 'Liên kết đăng nhập không hợp lệ. Hãy mở lại trang đăng nhập của cửa hàng.';
    }
    return '';
  }, [host, tenant, state]);

  const handoff = useCallback(
    async (payload: {
      provider: 'google' | 'apple';
      token: string;
      nonce?: string;
      firstName?: string;
      lastName?: string;
      authorizationCode?: string;
    }) => {
      const res = await axios.post<{ redirectUrl: string }>(endpoints.auth.ssoHandoff(tenant!), {
        ...payload,
        state,
        returnTo,
      });
      window.location.assign(res.data.redirectUrl);
    },
    [tenant, state, returnTo]
  );

  const showError = (err: any, fallback: string) => {
    setBusy(false);
    setErrorMsg(apiErrorMessage(err, fallback));
  };

  const handleApple = async () => {
    setErrorMsg('');
    setBusy(true);
    try {
      await loadAppleSdk();
      const rawNonce = randomToken(24);
      window.AppleID!.auth.init({
        clientId: APPLE_SERVICES_ID,
        scope: 'name email',
        redirectURI: `https://${AUTH_HOST}/sso/start/`,
        nonce: await sha256Hex(rawNonce),
        usePopup: true,
      });
      const res = await window.AppleID!.auth.signIn();
      await handoff({
        provider: 'apple',
        token: res.authorization.id_token,
        nonce: rawNonce,
        authorizationCode: res.authorization.code,
        firstName: res.user?.name?.firstName,
        lastName: res.user?.name?.lastName,
      });
    } catch (err: any) {
      // Người dùng tự đóng cửa sổ Apple: không báo lỗi.
      if (err?.error === 'popup_closed_by_user') {
        setBusy(false);
        return;
      }
      // Lỗi từ Apple JS là object { error: '<mã>' } — hiện mã để biết lỗi gì (không phải lỗi của cửa hàng).
      showError(err, err?.error ? `Đăng nhập Apple thất bại (${err.error})` : 'Đăng nhập Apple thất bại');
    }
  };

  if (host === null) return null;

  if (invalidRequest) {
    return <Alert severity="error">{invalidRequest}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">Đăng nhập</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Vào cửa hàng{' '}
          <Typography component="span" variant="subtitle2" sx={{ color: 'text.primary' }}>
            {tenant}.{SAAS_ZONE}
          </Typography>
        </Typography>
      </Stack>

      {!!errorMsg && <Alert severity="error">{errorMsg}</Alert>}

      <GoogleLogin
        onSuccess={async (resp) => {
          setErrorMsg('');
          setBusy(true);
          try {
            await handoff({ provider: 'google', token: resp.credential! });
          } catch (err: any) {
            showError(err, 'Đăng nhập Google thất bại');
          }
        }}
        onError={() => setErrorMsg('Đăng nhập Google thất bại')}
        width="100%"
        text="continue_with"
        shape="rectangular"
        size="large"
        locale="vi"
      />

      {!!APPLE_SERVICES_ID && (
        <Button
          fullWidth
          size="large"
          color="inherit"
          variant="contained"
          disabled={busy}
          onClick={handleApple}
          startIcon={<Iconify icon="mdi:apple" width={22} />}
        >
          Tiếp tục với Apple
        </Button>
      )}

      {/* Trang này chỉ lo Google/Apple (hai bên chỉ cho khai báo một tên miền). Đăng nhập bằng mật
          khẩu nằm ở trang đăng nhập của chính cửa hàng. */}
      <Link
        href={`https://${tenant}.${SAAS_ZONE}/auth/jwt/login/${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
        variant="body2"
        sx={{ textAlign: 'center' }}
      >
        Đăng nhập bằng email và mật khẩu
      </Link>

      <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
        Chỉ tài khoản đã được cửa hàng mời mới đăng nhập được.
      </Typography>
    </Stack>
  );
}
