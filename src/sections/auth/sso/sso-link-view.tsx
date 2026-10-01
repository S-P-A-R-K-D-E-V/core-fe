'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useSearchParams } from 'src/routes/hooks';

import axios, { endpoints } from 'src/utils/axios';
import { apiErrorMessage } from 'src/utils/api-error';

import { AUTH_HOST, isAuthHost, APPLE_SERVICES_ID } from 'src/auth/utils/saas-host';
import { parseMobileRedirectUri } from 'src/auth/utils/mobile-redirect';

import Iconify from 'src/components/iconify';

import { signInWithAppleWeb } from './apple-web';

// ----------------------------------------------------------------------

const TEXT = {
  vi: {
    title: 'Liên kết tài khoản',
    google: 'Đăng nhập Google để thêm làm cách đăng nhập nhanh cho tài khoản của bạn.',
    apple: 'Đăng nhập Apple để thêm làm cách đăng nhập nhanh cho tài khoản của bạn.',
    appleButton: 'Tiếp tục với Apple',
    note: 'Email đăng nhập của bạn giữ nguyên. Có thể liên kết nhiều tài khoản Google/Apple.',
    invalid: 'Liên kết không hợp lệ hoặc đã được dùng. Quay lại trang tài khoản và thử lại.',
    retry: 'Mỗi liên kết chỉ dùng một lần — quay lại trang tài khoản (hoặc ứng dụng) và bấm Liên kết lần nữa.',
    googleFailed: 'Liên kết Google thất bại',
    appleFailed: 'Liên kết Apple thất bại',
    backToApp: 'Quay lại ứng dụng',
    onlyAuth: 'Trang này chỉ dùng tại',
  },
  en: {
    title: 'Link an account',
    google: 'Sign in with Google to add it as a quick way to sign in to your account.',
    apple: 'Sign in with Apple to add it as a quick way to sign in to your account.',
    appleButton: 'Continue with Apple',
    note: 'Your sign-in email stays the same. You can link several Google/Apple accounts.',
    invalid: 'This link is not valid or was already used. Go back to your account page and try again.',
    retry: 'Each link works once — go back to your account page (or the app) and tap Link again.',
    googleFailed: 'Linking Google failed',
    appleFailed: 'Linking Apple failed',
    backToApp: 'Back to the app',
    onlyAuth: 'This page only works at',
  },
} as const;

const HOST_PATTERN = /^[a-z0-9.-]+(:\d+)?$/;

type Credential = { provider: 'google' | 'apple'; token: string; nonce?: string; authorizationCode?: string };

/**
 * /sso/start/?link=1&provider=google|apple[&app=1&redirect_uri=sparkstore://…][&lang=en]#t=<vé>
 *
 * Người dùng đã đăng nhập ở cửa hàng (web hoặc app) xin vé liên kết (POST /auth/oauth-link/start) rồi mở
 * trang này — tên miền duy nhất khai báo với Google/Apple. Đăng nhập Google/Apple xong, trang gửi vé +
 * token tới /api/app-hub/link: danh tính được gắn vào tài khoản trong vé, rồi chuyển về trang tài khoản
 * của cửa hàng (web) hoặc deep link của app. Vé chỉ đi qua fragment (#t=…) để không lên server/log.
 */
export default function SsoLinkView() {
  const searchParams = useSearchParams();
  const provider = searchParams.get('provider');
  const appMode = searchParams.get('app') === '1';
  const appRedirectRaw = searchParams.get('redirect_uri');
  const appRedirect = useMemo(() => parseMobileRedirectUri(appRedirectRaw), [appRedirectRaw]);
  const lang = searchParams.get('lang') === 'en' ? 'en' : 'vi';
  const text = TEXT[lang];

  const [host, setHost] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState('');
  const [busy, setBusy] = useState(false);
  // Vé đã gửi đi (đúng hay sai đều bị đốt) — không cho bấm lại.
  const [spent, setSpent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (tokenRef.current === null) {
      tokenRef.current = new URLSearchParams(window.location.hash.slice(1)).get('t') ?? '';
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    setLinkToken(tokenRef.current);
    setHost(window.location.host);
  }, []);

  const invalid = useMemo(() => {
    if (host === null) return '';
    if (!isAuthHost(host)) return `${text.onlyAuth} ${AUTH_HOST}.`;
    if (provider !== 'google' && !(provider === 'apple' && APPLE_SERVICES_ID)) return text.invalid;
    if (!linkToken || (appMode && !appRedirect)) return text.invalid;
    return '';
  }, [host, provider, linkToken, appMode, appRedirect, text]);

  const backToApp = (status: 'linked' | 'error' | 'cancelled', linked?: string) => {
    const back = new URL(appRedirect!.toString());
    back.searchParams.set('status', status);
    if (linked) back.searchParams.set('provider', linked);
    window.location.assign(back.toString());
  };

  const link = async (credential: Credential) => {
    setErrorMsg('');
    setBusy(true);
    setSpent(true);
    try {
      const res = await axios.post<{ provider: string; email: string | null; returnHost: string }>(
        `${window.location.origin}${endpoints.auth.appHubLink}`,
        { linkToken, ...credential }
      );
      if (appMode) {
        backToApp('linked', res.data.provider);
        return;
      }
      const returnHost = res.data.returnHost?.toLowerCase() ?? '';
      if (!HOST_PATTERN.test(returnHost)) throw new Error(text.invalid);
      window.location.assign(
        `https://${returnHost}${paths.dashboard.user.account}/?tab=connected&linked=${encodeURIComponent(res.data.provider)}`
      );
    } catch (err: any) {
      setBusy(false);
      const failed = credential.provider === 'google' ? text.googleFailed : text.appleFailed;
      setErrorMsg(`${apiErrorMessage(err, failed)} ${text.retry}`);
    }
  };

  const handleApple = async () => {
    setErrorMsg('');
    setBusy(true);
    try {
      const apple = await signInWithAppleWeb();
      await link({ provider: 'apple', ...apple });
    } catch (err: any) {
      setBusy(false);
      // Tự đóng cửa sổ Apple: vé chưa dùng, bấm lại được.
      if (err?.error === 'popup_closed_by_user') return;
      setErrorMsg(err?.error ? `${text.appleFailed} (${err.error})` : text.appleFailed);
    }
  };

  if (host === null) return null;

  if (invalid) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">{invalid}</Alert>
        {appMode && appRedirect && (
          <Button variant="outlined" color="inherit" onClick={() => backToApp('error')}>
            {text.backToApp}
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">{text.title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {provider === 'apple' ? text.apple : text.google}
        </Typography>
      </Stack>

      {!!errorMsg && <Alert severity="error">{errorMsg}</Alert>}

      {!spent && provider === 'google' && (
        <GoogleLogin
          onSuccess={(resp) => link({ provider: 'google', token: resp.credential! })}
          onError={() => setErrorMsg(text.googleFailed)}
          width="100%"
          text="continue_with"
          shape="rectangular"
          size="large"
          locale={lang}
        />
      )}

      {!spent && provider === 'apple' && (
        <Button
          fullWidth
          size="large"
          color="inherit"
          variant="contained"
          disabled={busy}
          onClick={handleApple}
          startIcon={<Iconify icon="mdi:apple" width={22} />}
        >
          {text.appleButton}
        </Button>
      )}

      {spent && !busy && appMode && (
        <Button variant="outlined" color="inherit" onClick={() => backToApp('error')}>
          {text.backToApp}
        </Button>
      )}

      <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
        {text.note}
      </Typography>
    </Stack>
  );
}
