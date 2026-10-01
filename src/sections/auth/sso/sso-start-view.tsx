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
  tenantCodeFromHost,
} from 'src/auth/utils/saas-host';

import { parseMobileRedirectUri } from 'src/auth/utils/mobile-redirect';

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
// PKCE S256 của app: base64url(SHA-256(verifier)) = 43 ký tự.
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// Chữ của chế độ app (?app=1) — app gửi kèm ngôn ngữ đang dùng (lang=en|vi).
const APP_TEXT = {
  vi: {
    title: 'Đăng nhập',
    subtitle: 'Đăng nhập một lần — ứng dụng sẽ tự tìm các cửa hàng của bạn.',
    apple: 'Tiếp tục với Apple',
    invited: 'Chỉ tài khoản đã được cửa hàng mời mới vào được cửa hàng.',
    invalid: 'Liên kết đăng nhập không hợp lệ. Hãy quay lại ứng dụng và thử lại.',
    googleFailed: 'Đăng nhập Google thất bại',
    appleFailed: 'Đăng nhập Apple thất bại',
  },
  en: {
    title: 'Sign in',
    subtitle: 'Sign in once — the app will find your stores.',
    apple: 'Continue with Apple',
    invited: 'Only accounts invited by a store can open that store.',
    invalid: 'This sign-in link is not valid. Go back to the app and try again.',
    googleFailed: 'Google sign-in failed',
    appleFailed: 'Apple sign-in failed',
  },
} as const;

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
  // Chế độ app: app cửa hàng mở trang này để đăng nhập Google/Apple (app không tự làm được), nhận mã
  // dùng một lần qua deep link redirect_uri rồi tự đổi mã (kèm PKCE verifier) lấy danh sách cửa hàng.
  const appMode = searchParams.get('app') === '1';
  const challenge = searchParams.get('challenge');
  const appRedirectRaw = searchParams.get('redirect_uri');
  const appRedirect = useMemo(() => parseMobileRedirectUri(appRedirectRaw), [appRedirectRaw]);
  const appProvider = searchParams.get('provider');
  const appLang = searchParams.get('lang') === 'en' ? 'en' : 'vi';
  const text = APP_TEXT[appLang];
  const returnTo = searchParams.get('returnTo');
  // Tên miền cửa hàng người dùng đang dùng; chỉ tin khi đúng là tên miền của mã cửa hàng này.
  const hostParam = searchParams.get('host');
  const storeHost = hostParam && tenantCodeFromHost(hostParam) === tenant ? hostParam.split(':')[0] : `${tenant}.${SAAS_ZONE}`;

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
    if (appMode) {
      return !state || !STATE_PATTERN.test(state) || !challenge || !CHALLENGE_PATTERN.test(challenge) || !appRedirect
        ? text.invalid
        : '';
    }
    if (!isValidTenantCode(tenant) || !state || !STATE_PATTERN.test(state)) {
      return 'Liên kết đăng nhập không hợp lệ. Hãy mở lại trang đăng nhập của cửa hàng.';
    }
    return '';
  }, [host, tenant, state, appMode, challenge, appRedirect, text]);

  const handoff = useCallback(
    async (payload: {
      provider: 'google' | 'apple';
      token: string;
      nonce?: string;
      firstName?: string;
      lastName?: string;
      authorizationCode?: string;
    }) => {
      if (appMode) {
        const res = await axios.post<{ code: string }>(`${window.location.origin}${endpoints.auth.appWebHandoff}`, {
          ...payload,
          state,
          codeChallenge: challenge,
        });
        const back = new URL(appRedirect!.toString());
        back.searchParams.set('code', res.data.code);
        back.searchParams.set('state', state!);
        window.location.assign(back.toString());
        return;
      }
      const res = await axios.post<{ redirectUrl: string }>(endpoints.auth.ssoHandoff(tenant!), {
        ...payload,
        state,
        host: storeHost,
        returnTo,
      });
      window.location.assign(res.data.redirectUrl);
    },
    [tenant, state, returnTo, storeHost, appMode, challenge, appRedirect]
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
      const appleFailed = appMode ? text.appleFailed : 'Đăng nhập Apple thất bại';
      showError(err, err?.error ? `${appleFailed} (${err.error})` : appleFailed);
    }
  };

  if (host === null) return null;

  if (invalidRequest) {
    return <Alert severity="error">{invalidRequest}</Alert>;
  }

  if (appMode) {
    const showGoogle = appProvider !== 'apple';
    const showApple = !!APPLE_SERVICES_ID && appProvider !== 'google';
    return (
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4">{text.title}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {text.subtitle}
          </Typography>
        </Stack>

        {!!errorMsg && <Alert severity="error">{errorMsg}</Alert>}

        {showGoogle && (
          <GoogleLogin
            onSuccess={async (resp) => {
              setErrorMsg('');
              setBusy(true);
              try {
                await handoff({ provider: 'google', token: resp.credential! });
              } catch (err: any) {
                showError(err, text.googleFailed);
              }
            }}
            onError={() => setErrorMsg(text.googleFailed)}
            width="100%"
            text="continue_with"
            shape="rectangular"
            size="large"
            locale={appLang}
          />
        )}

        {showApple && (
          <Button
            fullWidth
            size="large"
            color="inherit"
            variant="contained"
            disabled={busy}
            onClick={handleApple}
            startIcon={<Iconify icon="mdi:apple" width={22} />}
          >
            {text.apple}
          </Button>
        )}

        <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
          {text.invited}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">Đăng nhập</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Vào cửa hàng{' '}
          <Typography component="span" variant="subtitle2" sx={{ color: 'text.primary' }}>
            {storeHost}
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
        href={`https://${storeHost}/auth/jwt/login/${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
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
