'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';
import CircularProgress from '@mui/material/CircularProgress';

import { getStorageUrl } from 'src/utils/storage';

import { useAuthContext } from 'src/auth/hooks';
import {
  getCounterRoster,
  exchangeCounterQr,
  verifyCounterLogin,
  requestCounterLogin,
  counterPasswordLogin,
  type CounterError,
  type CounterRoster,
  type CounterPerson,
} from 'src/api/counter';

import JwtQrLogin from 'src/sections/auth/jwt/jwt-qr-login';

import { clearCounterDevice, type CounterDevice } from './counter-device';

import type { IAuthResponse } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Màn khoá máy quầy trên web: người có ca hôm nay ở chi nhánh (+ chủ cửa hàng / quản lý). Bấm tên → mã 6 số gửi về
// app điện thoại → gõ mã. Người chưa có app: mật khẩu tài khoản. Dự phòng: quét QR bằng app. Cùng API với app máy
// quầy (core-be CounterController); phiên tới hết ca + 30 phút, ai đăng nhập cũng chỉ có bán hàng.
// ----------------------------------------------------------------------

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

const GROUPS: { key: string; label: string }[] = [
  { key: 'working', label: 'Đang trong ca' },
  { key: 'upcoming', label: 'Sắp vào ca' },
  { key: 'otherBranch', label: 'Ca chưa gắn chi nhánh' },
  { key: 'manager', label: 'Quản lý' },
  { key: 'ended', label: 'Đã hết ca' },
];

/** Cùng chi nhánh theo trạng thái ca; ca chưa gắn chi nhánh gom riêng, trước quản lý (như app máy quầy). */
export function groupRoster(people: CounterPerson[]): { key: string; label: string; people: CounterPerson[] }[] {
  return GROUPS.map((g) => ({
    ...g,
    people:
      g.key === 'otherBranch'
        ? people.filter((p) => p.atThisBranch === false)
        : people.filter((p) => p.atThisBranch !== false && p.status === g.key),
  })).filter((g) => g.people.length > 0);
}

function roleLabel(p: CounterPerson): string {
  if (p.role === 'Admin') return 'Chủ cửa hàng';
  if (p.role === 'Manager') return 'Quản lý';
  if (p.startTime && p.endTime) return `${p.shiftName ? `${p.shiftName} · ` : ''}${p.startTime}–${p.endTime}`;
  return 'Nhân viên';
}

function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type Pending = { person: CounterPerson; requestId: string; expiresAt: number; sentTo: number; resendAt: number };
type Mode = { kind: 'list' } | { kind: 'code'; pending: Pending } | { kind: 'password'; person: CounterPerson } | { kind: 'qr' };

type Props = {
  device: CounterDevice;
  /** Đăng nhập xong → vào trang bán hàng. */
  onSignedIn: () => void;
};

export default function CounterLockView({ device, onSignedIn }: Props) {
  const { loginWithAuthResponse } = useAuthContext();
  const [roster, setRoster] = useState<CounterRoster | null>(null);
  const [rosterError, setRosterError] = useState<CounterError | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [sending, setSending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      setRoster(await getCounterRoster());
      setRosterError(null);
    } catch (err) {
      setRosterError(err as CounterError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const revoked = rosterError?.code === 'Counter.Unauthorized' || rosterError?.code === 'Counter.NotCounterDevice';
  const groups = useMemo(() => groupRoster(roster?.people ?? []), [roster]);

  const signedIn = useCallback(
    async (auth: IAuthResponse) => {
      await loginWithAuthResponse?.(auth);
      onSignedIn();
    },
    [loginWithAuthResponse, onSignedIn]
  );

  async function choose(person: CounterPerson) {
    setNotice(null);
    if (!person.canSignIn) {
      setNotice(person.status === 'ended' ? 'Ca của bạn đã kết thúc.' : 'Chưa tới giờ đăng nhập (sớm nhất 2 giờ trước ca).');
      return;
    }
    if (!person.hasApp) {
      setMode({ kind: 'password', person });
      return;
    }
    setSending(person.userId);
    try {
      const res = await requestCounterLogin(person.userId);
      const at = Date.now();
      setMode({
        kind: 'code',
        pending: {
          person,
          requestId: res.requestId,
          expiresAt: at + res.expiresInSeconds * 1000,
          sentTo: res.sentToDevices,
          resendAt: at + RESEND_SECONDS * 1000,
        },
      });
    } catch (err) {
      setNotice((err as CounterError).message);
    } finally {
      setSending(null);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: { xs: 2, md: 4 }, py: 3 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 3, maxWidth: 1280, mx: 'auto' }}>
        <Box>
          <Typography variant="h5">{device.deviceName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {roster?.branchName || device.branchName}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h5">{now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
        {mode.kind === 'qr' && (
          <Card sx={{ p: 4, maxWidth: 480, mx: 'auto' }}>
            <JwtQrLogin
              hint="Mở app trên điện thoại → Hồ sơ → Đăng nhập web bằng mã QR, quét rồi bấm Đồng ý."
              onBack={() => setMode({ kind: 'list' })}
              onSuccess={() => {}}
              onApproved={async (code, verifier) => signedIn(await exchangeCounterQr(code, verifier))}
            />
          </Card>
        )}

        {mode.kind === 'code' && (
          <CodeEntry
            pending={mode.pending}
            onCancel={() => setMode({ kind: 'list' })}
            onResend={() => choose(mode.pending.person)}
            onUsePassword={() => setMode({ kind: 'password', person: mode.pending.person })}
            onSignedIn={signedIn}
          />
        )}

        {mode.kind === 'password' && (
          <PasswordEntry
            person={mode.person}
            onCancel={() => setMode({ kind: 'list' })}
            onUseCode={() => choose(mode.person)}
            onSignedIn={signedIn}
          />
        )}

        {mode.kind === 'list' && revoked && (
          <Stack spacing={2} alignItems="center" sx={{ py: 10, textAlign: 'center' }}>
            <Typography variant="h6">Máy quầy đã bị thu hồi</Typography>
            <Typography color="text.secondary">Chủ cửa hàng / quản lý đã gỡ máy này trên trang quản trị.</Typography>
            <Button variant="outlined" color="inherit" onClick={() => clearCounterDevice()}>
              Thoát chế độ máy quầy
            </Button>
          </Stack>
        )}

        {mode.kind === 'list' && !revoked && (
          <>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ sm: 'flex-start' }}
              justifyContent="space-between"
              sx={{ mb: 3 }}
            >
              <Box>
                <Typography variant="h6">Chọn tên của bạn để đăng nhập</Typography>
                <Typography variant="body2" color="text.secondary">
                  Mã 6 số sẽ gửi về app trên điện thoại của bạn. Chưa có app thì dùng mật khẩu tài khoản.
                </Typography>
              </Box>
              <Button variant="soft" onClick={() => setMode({ kind: 'qr' })} sx={{ alignSelf: { xs: 'flex-start' } }}>
                Quét QR bằng điện thoại
              </Button>
            </Stack>

            {notice && (
              <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
                {notice}
              </Alert>
            )}

            {loading && (
              <Box sx={{ py: 10, textAlign: 'center' }}>
                <CircularProgress />
              </Box>
            )}
            {!loading && rosterError && (
              <Stack spacing={2} alignItems="center" sx={{ py: 10 }}>
                <Typography color="text.secondary">{rosterError.message}</Typography>
                <Button variant="outlined" onClick={load}>
                  Thử lại
                </Button>
              </Stack>
            )}
            {!loading && !rosterError && groups.length === 0 && (
              <Typography color="text.secondary" sx={{ py: 10, textAlign: 'center' }}>
                Chưa có ai có ca hôm nay ở chi nhánh này.
              </Typography>
            )}

            {groups.map((g) => (
              <Box key={g.key} sx={{ mb: 4 }}>
                <Typography variant="overline" color="text.secondary">
                  {g.label} · {g.people.length}
                </Typography>
                <Box
                  sx={{
                    mt: 1,
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(5, 1fr)' },
                  }}
                >
                  {g.people.map((p) => (
                    <Card key={p.userId} variant="outlined" sx={{ opacity: p.canSignIn ? 1 : 0.5 }}>
                      <CardActionArea disabled={!!sending} onClick={() => choose(p)} sx={{ p: 2.5, textAlign: 'center' }}>
                        <Avatar src={p.avatarUrl ? getStorageUrl(p.avatarUrl) : undefined} sx={{ width: 64, height: 64, mx: 'auto', mb: 1.5 }}>
                          {p.fullName.charAt(0)}
                        </Avatar>
                        <Typography variant="subtitle1" noWrap>
                          {p.fullName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {roleLabel(p)}
                        </Typography>
                        {sending === p.userId && <CircularProgress size={18} sx={{ mt: 1 }} />}
                        {sending !== p.userId && !p.hasApp && p.canSignIn && (
                          <Typography variant="caption" color="warning.main" component="div">
                            Chưa có app — đăng nhập bằng mật khẩu
                          </Typography>
                        )}
                      </CardActionArea>
                    </Card>
                  ))}
                </Box>
              </Box>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------------------

function CodeEntry({
  pending,
  onCancel,
  onResend,
  onUsePassword,
  onSignedIn,
}: {
  pending: Pending;
  onCancel: () => void;
  onResend: () => void;
  onUsePassword: () => void;
  onSignedIn: (auth: IAuthResponse) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const submitted = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setCode('');
    setError(null);
    submitted.current = null;
    inputRef.current?.focus();
  }, [pending.requestId]);

  const secondsLeft = Math.max(0, Math.ceil((pending.expiresAt - tick) / 1000));
  const resendIn = Math.max(0, Math.ceil((pending.resendAt - tick) / 1000));
  const expired = secondsLeft === 0;

  async function submit(value: string) {
    if (submitted.current === value) return;
    submitted.current = value;
    setChecking(true);
    setError(null);
    try {
      await onSignedIn(await verifyCounterLogin(pending.requestId, value));
    } catch (err) {
      setError((err as CounterError).message);
      setCode('');
      submitted.current = null;
      inputRef.current?.focus();
    } finally {
      setChecking(false);
    }
  }

  function change(raw: string) {
    const next = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(next);
    if (next.length === CODE_LENGTH) submit(next);
  }

  const sentText =
    pending.sentTo > 1
      ? `Mã đã gửi tới app trên ${pending.sentTo} thiết bị của bạn.`
      : 'Mã đã gửi tới app trên điện thoại của bạn.';

  return (
    <Card sx={{ p: 4, maxWidth: 520, mx: 'auto', textAlign: 'center' }}>
      <Avatar src={pending.person.avatarUrl ? getStorageUrl(pending.person.avatarUrl) : undefined} sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }}>
        {pending.person.fullName.charAt(0)}
      </Avatar>
      <Typography variant="h5">{pending.person.fullName}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        {sentText}
      </Typography>
      <Typography color={expired ? 'error.main' : 'text.secondary'} sx={{ mb: 3 }}>
        {expired ? 'Mã đã hết hạn.' : `Hết hạn sau ${mmss(secondsLeft)}`}
      </Typography>

      <TextField
        inputRef={inputRef}
        autoFocus
        value={code}
        disabled={checking || expired}
        onChange={(e) => change(e.target.value)}
        placeholder="••••••"
        inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: CODE_LENGTH, style: { textAlign: 'center', fontSize: 32, letterSpacing: 12 } }}
        sx={{ width: 280 }}
      />
      <Box sx={{ minHeight: 28, mt: 1.5 }}>
        {checking && <CircularProgress size={20} />}
        {!checking && error && <Typography color="error.main">{error}</Typography>}
      </Box>

      <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 2 }}>
        <Button variant="outlined" color="inherit" onClick={onCancel}>
          Chọn người khác
        </Button>
        <Button variant="soft" disabled={resendIn > 0} onClick={onResend}>
          {resendIn > 0 ? `Gửi lại (${resendIn}s)` : 'Gửi lại mã'}
        </Button>
      </Stack>
      <Link component="button" variant="body2" onClick={onUsePassword} sx={{ mt: 2 }}>
        Không nhận được mã? Dùng mật khẩu
      </Link>
    </Card>
  );
}

function PasswordEntry({
  person,
  onCancel,
  onUseCode,
  onSignedIn,
}: {
  person: CounterPerson;
  onCancel: () => void;
  onUseCode: () => void;
  onSignedIn: (auth: IAuthResponse) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!password || checking) return;
    setChecking(true);
    setError(null);
    try {
      await onSignedIn(await counterPasswordLogin(person.userId, password));
    } catch (err) {
      // Counter.WrongPassword (kèm số lần còn lại) / PasswordLocked / NoPassword: server ghi sẵn câu hiển thị.
      setError((err as CounterError).message);
      setPassword('');
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card component="form" onSubmit={submit} sx={{ p: 4, maxWidth: 440, mx: 'auto', textAlign: 'center' }}>
      <Avatar src={person.avatarUrl ? getStorageUrl(person.avatarUrl) : undefined} sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }}>
        {person.fullName.charAt(0)}
      </Avatar>
      <Typography variant="h5">{person.fullName}</Typography>
      <Typography variant="subtitle1" sx={{ mt: 2 }}>
        Nhập mật khẩu tài khoản
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Mật khẩu bạn dùng để đăng nhập app / trang quản trị. Phiên trên máy quầy tự hết khi hết ca.
      </Typography>
      <TextField
        fullWidth
        autoFocus
        type="password"
        label="Mật khẩu"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        // Máy quầy dùng chung: không để trình duyệt lưu / gợi ý mật khẩu của từng người.
        autoComplete="off"
        inputProps={{ 'data-lpignore': 'true', 'data-1p-ignore': 'true' }}
      />
      {error && (
        <Typography color="error.main" sx={{ mt: 1.5 }}>
          {error}
        </Typography>
      )}
      <Stack spacing={1.5} sx={{ mt: 3 }}>
        <Button type="submit" variant="contained" size="large" disabled={!password || checking}>
          {checking ? <CircularProgress size={22} color="inherit" /> : 'Đăng nhập'}
        </Button>
        {person.hasApp && (
          <Button variant="soft" onClick={onUseCode}>
            Gửi mã về điện thoại
          </Button>
        )}
        <Button variant="outlined" color="inherit" onClick={onCancel}>
          Chọn người khác
        </Button>
      </Stack>
    </Card>
  );
}
