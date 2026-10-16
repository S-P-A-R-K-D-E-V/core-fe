'use client';

import { useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CardActionArea from '@mui/material/CardActionArea';

import axios, { endpoints } from 'src/utils/axios';
import { apiErrorMessage } from 'src/utils/api-error';

import { randomToken, APPLE_SERVICES_ID } from 'src/auth/utils/saas-host';

import Iconify from 'src/components/iconify';

import JwtQrLogin from 'src/sections/auth/jwt/jwt-qr-login';
import { signInWithAppleWeb } from 'src/sections/auth/sso/apple-web';

// ----------------------------------------------------------------------
// Trang đăng nhập chung auth.devbyspark.com: đăng nhập một lần bằng Google / Apple / email (hoặc quét QR bằng app) →
// chọn cửa hàng → vào web của cửa hàng đó. Dùng /api/app-hub/discover (giống app): server trả danh sách cửa hàng kèm
// vé dùng một lần (60 giây) gắn với state của trang này; trang chuyển sang /sso/callback/?from=hub của cửa hàng.
// Vé hết hạn khi người dùng chọn chậm → hỏi lại server bằng thông tin đăng nhập vẫn giữ trong bộ nhớ của trang
// (không lưu xuống trình duyệt).

type DiscoveredStore = {
  code: string;
  name: string;
  logoUrl?: string | null;
  host: string;
  webOrigin: string;
  role: string;
  ssoCode: string;
};

type DiscoverResponse = { email?: string | null; displayName?: string | null; stores: DiscoveredStore[] };

type Credential =
  | { provider: 'google'; token: string }
  | { provider: 'apple'; token: string; nonce: string; authorizationCode?: string; firstName?: string; lastName?: string }
  | { email: string; password: string };

/** Vé sống 60 giây — quá ngần này thì xin lại trước khi chuyển. */
const TICKET_FRESH_MS = 45_000;

const ROLE_LABEL: Record<string, string> = { Admin: 'Chủ cửa hàng', Manager: 'Quản lý', Staff: 'Nhân viên' };

function goToStore(store: DiscoveredStore, state: string) {
  const url = new URL('/sso/callback/', store.webOrigin);
  url.searchParams.set('code', store.ssoCode);
  url.searchParams.set('state', state);
  url.searchParams.set('from', 'hub');
  window.location.assign(url.toString());
}

export default function HubLoginView() {
  const [mode, setMode] = useState<'choose' | 'email' | 'qr'>('choose');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<{ data: DiscoverResponse; state: string; at: number } | null>(null);
  const credential = useRef<Credential | null>(null);

  async function discover(cred: Credential, autoGo: boolean) {
    const state = randomToken(24);
    const res = await axios.post<DiscoverResponse>(`${window.location.origin}/api/app-hub/discover`, { ...cred, state });
    credential.current = cred;
    if (autoGo && res.data.stores.length === 1) {
      goToStore(res.data.stores[0], state);
      return;
    }
    setResult({ data: res.data, state, at: Date.now() });
  }

  async function run(cred: Credential) {
    setErrorMsg('');
    setBusy(true);
    try {
      await discover(cred, true);
    } catch (err: any) {
      setErrorMsg(apiErrorMessage(err, 'Đăng nhập thất bại.'));
    } finally {
      setBusy(false);
    }
  }

  async function pick(store: DiscoveredStore) {
    if (!result) return;
    if (Date.now() - result.at < TICKET_FRESH_MS || !credential.current) {
      goToStore(store, result.state);
      return;
    }
    // Vé cũ: hỏi lại server rồi chuyển bằng vé mới của đúng cửa hàng đó.
    setBusy(true);
    try {
      const state = randomToken(24);
      const res = await axios.post<DiscoverResponse>(`${window.location.origin}/api/app-hub/discover`, {
        ...credential.current,
        state,
      });
      const fresh = res.data.stores.find((s) => s.code === store.code);
      if (!fresh) throw new Error('Bạn không còn ở cửa hàng này.');
      goToStore(fresh, state);
    } catch (err: any) {
      setErrorMsg(apiErrorMessage(err, 'Phiên đăng nhập đã hết hạn — đăng nhập lại.'));
      setResult(null);
      setBusy(false);
    }
  }

  async function handleApple() {
    try {
      const apple = await signInWithAppleWeb();
      await run({
        provider: 'apple',
        token: apple.token,
        nonce: apple.nonce,
        authorizationCode: apple.authorizationCode,
        firstName: apple.firstName,
        lastName: apple.lastName,
      });
    } catch (err: any) {
      if (err?.error === 'popup_closed_by_user' || err?.error === 'user_cancelled_authorize') return;
      setErrorMsg('Đăng nhập Apple thất bại');
    }
  }

  // ── Đã đăng nhập: chọn cửa hàng ──
  if (result) {
    const { stores } = result.data;
    return (
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4">Chọn cửa hàng</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {result.data.displayName || result.data.email}
          </Typography>
        </Stack>
        {!!errorMsg && <Alert severity="error">{errorMsg}</Alert>}
        {stores.length === 0 ? (
          <Alert severity="info">
            Tài khoản {result.data.email ? <b>{result.data.email}</b> : 'này'} chưa thuộc cửa hàng nào. Nhờ chủ cửa hàng
            thêm đúng email này rồi đăng nhập lại.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {stores.map((s) => (
              <Card key={s.code} variant="outlined">
                <CardActionArea disabled={busy} onClick={() => pick(s)} sx={{ p: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar src={s.logoUrl ?? undefined} alt={s.name} variant="rounded">
                      {s.name.slice(0, 1)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" noWrap>
                        {s.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                        {ROLE_LABEL[s.role] ?? s.role} · {s.host}
                      </Typography>
                    </Box>
                    <Iconify icon="eva:arrow-ios-forward-fill" />
                  </Stack>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        )}
        <Button
          color="inherit"
          onClick={() => {
            setResult(null);
            credential.current = null;
          }}
        >
          Dùng tài khoản khác
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">Đăng nhập Spark Store</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Đăng nhập một lần rồi chọn cửa hàng của bạn.
        </Typography>
      </Stack>

      {!!errorMsg && <Alert severity="error">{errorMsg}</Alert>}

      {mode === 'qr' ? (
        <JwtQrLogin
          api={{
            start: `${window.location.origin}${endpoints.auth.appHubQrStart}`,
            status: `${window.location.origin}${endpoints.auth.appHubQrStatus}`,
          }}
          hint="Mở app Spark Store trên điện thoại (đang đăng nhập cửa hàng của bạn), vào Hồ sơ → Quét mã đăng nhập web rồi quét mã này."
          onBack={() => setMode('choose')}
          onSuccess={() => {}}
          onApproved={async (code, verifier) => {
            const state = randomToken(24);
            const res = await axios.post<{ redirectUrl: string }>(`${window.location.origin}${endpoints.auth.appHubQrExchange}`, {
              code,
              codeVerifier: verifier,
              state,
            });
            window.location.assign(res.data.redirectUrl);
          }}
        />
      ) : mode === 'email' ? (
        <Stack spacing={2}>
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="Mật khẩu"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && email && password) run({ email: email.trim(), password });
            }}
          />
          <LoadingButton
            size="large"
            variant="contained"
            loading={busy}
            disabled={!email || !password}
            onClick={() => run({ email: email.trim(), password })}
          >
            Đăng nhập
          </LoadingButton>
          <Button color="inherit" onClick={() => setMode('choose')}>
            Cách đăng nhập khác
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <GoogleLogin
            onSuccess={(resp) => resp.credential && run({ provider: 'google', token: resp.credential })}
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
          <Button
            fullWidth
            size="large"
            variant="outlined"
            color="inherit"
            disabled={busy}
            onClick={() => setMode('email')}
            startIcon={<Iconify icon="solar:letter-bold" width={20} />}
          >
            Đăng nhập bằng email
          </Button>
          <Divider sx={{ typography: 'overline', color: 'text.disabled' }}>HOẶC</Divider>
          <Button
            fullWidth
            size="large"
            variant="soft"
            disabled={busy}
            onClick={() => setMode('qr')}
            startIcon={<Iconify icon="solar:qr-code-bold" width={20} />}
          >
            Quét mã QR bằng app
          </Button>
        </Stack>
      )}

      <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
        Chỉ tài khoản đã được cửa hàng mời mới đăng nhập được.{' '}
        <Link href="/privacy-policy/" color="inherit" underline="always">
          Chính sách quyền riêng tư
        </Link>
      </Typography>
    </Stack>
  );
}
