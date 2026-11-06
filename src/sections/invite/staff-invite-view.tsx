'use client';

import { useState, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

import { useRouter } from 'src/routes/hooks';

import { PATH_AFTER_LOGIN } from 'src/config-global';

import axios, { endpoints } from 'src/utils/axios';
import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { STORE_STAFF_ROLES } from 'src/auth/roles';
import { IAuthResponse } from 'src/types/corecms-api';
import { APPLE_SERVICES_ID, beginCentralLogin, tenantCodeFromHost } from 'src/auth/utils/saas-host';
import { StaffInvitePreview, previewStaffInvite, STAFF_INVITE_ROLE_LABEL } from 'src/api/staff-invites';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

export const INVITE_DONE_PATH = '/invite/done';
const DONE_STORE_KEY = 'staffInviteStore';

type Props = {
  token: string;
};

const STATUS_TEXT = {
  Accepted: 'Link mời này đã được dùng — mỗi link chỉ dùng một lần. Nhờ quản lý cửa hàng gửi link mới nếu cần.',
  Revoked: 'Link mời này đã bị thu hồi. Nhờ quản lý cửa hàng gửi link mới.',
  Expired: 'Link mời này đã hết hạn. Nhờ quản lý cửa hàng gửi link mới.',
} as const;

/**
 * Trang người được mời mở link /invite/[token]:
 *  - đang đăng nhập ở cửa hàng (vd tài khoản khách đã đăng nhập Google) → bấm "Nhận lời mời" (phiên mới mang vai trò mới);
 *  - chưa đăng nhập → Google / Apple kèm mã mời: CiCi đăng nhập thẳng trên tên miền, cửa hàng SaaS qua auth.devbyspark.com.
 * Nhận xong → /invite/done (hướng dẫn mở app S Store).
 */
export default function StaffInviteView({ token }: Props) {
  const router = useRouter();
  const { user, authenticated, loading, loginWithOAuth, loginWithAuthResponse, logout } = useAuthContext() as any;

  const [preview, setPreview] = useState<StaffInvitePreview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [saasTenant, setSaasTenant] = useState<string | null>(null);

  useEffect(() => {
    setSaasTenant(tenantCodeFromHost(window.location.host));
  }, []);

  useEffect(() => {
    previewStaffInvite(token)
      .then(setPreview)
      .catch((err) => setLoadError(apiErrorMessage(err, 'Link mời không đúng hoặc không thuộc cửa hàng này.')));
  }, [token]);

  const roles: string[] = [...(user?.roles ?? []), ...(user?.role ? [user.role] : [])];
  const alreadyStaff = authenticated && roles.some((r) => STORE_STAFF_ROLES.includes(r));

  const rememberStore = () => {
    try {
      sessionStorage.setItem(DONE_STORE_KEY, preview?.storeName ?? '');
    } catch {
      // không có sessionStorage — trang hoàn tất hiện chữ chung
    }
  };

  const finish = () => {
    rememberStore();
    router.replace(INVITE_DONE_PATH);
  };

  // Cửa hàng SaaS: Google/Apple chạy ở auth.devbyspark.com, quay về /sso/callback rồi tới /invite/done.
  const centralLogin = (provider: 'google' | 'apple') => {
    rememberStore();
    beginCentralLogin(provider, INVITE_DONE_PATH, null, token);
  };

  const acceptSignedIn = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await axios.post<IAuthResponse>(endpoints.staffInvites.accept, { token });
      await loginWithAuthResponse?.(res.data);
      finish();
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Không nhận được lời mời'));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return <Alert severity="error">{loadError}</Alert>;
  }

  if (!preview || loading) {
    return (
      <Stack alignItems="center" sx={{ py: 5 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const roleLabel = STAFF_INVITE_ROLE_LABEL[preview.role].toLowerCase();

  const renderHead = (
    <Stack spacing={1} sx={{ mb: 3 }}>
      <Typography variant="h4">Lời mời làm {roleLabel}</Typography>
      <Typography variant="body1">
        <strong>{preview.storeName || 'Cửa hàng'}</strong> mời bạn làm {roleLabel}
        {preview.branchNames.length > 0 ? ` (chi nhánh ${preview.branchNames.join(', ')})` : ''}.
      </Typography>
      {preview.status === 'Pending' && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Link dùng một lần, hết hạn {fDateTime(preview.expiresAt)}.
          {preview.emailHint ? ` Chỉ dành cho tài khoản ${preview.emailHint}.` : ''}
        </Typography>
      )}
    </Stack>
  );

  if (preview.status !== 'Pending') {
    return (
      <>
        {renderHead}
        <Alert severity="warning">{STATUS_TEXT[preview.status]}</Alert>
      </>
    );
  }

  const renderSignedIn = alreadyStaff ? (
    <Stack spacing={2}>
      <Alert severity="info">
        Bạn đang đăng nhập bằng {user?.email} — tài khoản này đã là nhân viên của cửa hàng. Nếu link dành cho người
        khác, hãy đăng xuất rồi để họ mở link.
      </Alert>
      <Button variant="contained" onClick={() => router.replace(PATH_AFTER_LOGIN)}>
        Vào trang quản lý
      </Button>
      <Button color="inherit" onClick={() => logout?.()}>
        Đăng xuất
      </Button>
    </Stack>
  ) : (
    <Stack spacing={2}>
      <Typography variant="body2">
        Đang đăng nhập bằng <strong>{user?.email}</strong>.
      </Typography>
      <LoadingButton size="large" variant="contained" loading={busy} onClick={acceptSignedIn}>
        Nhận lời mời
      </LoadingButton>
      <Button color="inherit" disabled={busy} onClick={() => logout?.()}>
        Dùng tài khoản khác
      </Button>
    </Stack>
  );

  const renderSignIn = (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Đăng nhập để nhận lời mời — chưa có tài khoản thì hệ thống tự tạo từ Google/Apple.
      </Typography>
      {saasTenant ? (
        <>
          <LoadingButton
            fullWidth
            size="large"
            variant="outlined"
            color="inherit"
            onClick={() => centralLogin('google')}
            startIcon={<Iconify icon="logos:google-icon" width={20} />}
          >
            Tiếp tục với Google
          </LoadingButton>
          {!!APPLE_SERVICES_ID && (
            <LoadingButton
              fullWidth
              size="large"
              variant="contained"
              color="inherit"
              onClick={() => centralLogin('apple')}
              startIcon={<Iconify icon="mdi:apple" width={22} />}
            >
              Tiếp tục với Apple
            </LoadingButton>
          )}
        </>
      ) : (
        <GoogleLogin
          onSuccess={async (resp) => {
            setErrorMsg('');
            try {
              await loginWithOAuth?.('google', resp.credential!, undefined, token);
              finish();
            } catch (err) {
              setErrorMsg(apiErrorMessage(err, 'Đăng nhập Google thất bại'));
            }
          }}
          onError={() => setErrorMsg('Đăng nhập Google thất bại')}
          width="100%"
          text="continue_with"
          shape="rectangular"
          size="large"
          locale="vi"
        />
      )}
    </Stack>
  );

  return (
    <>
      {renderHead}
      {!!errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
      )}
      {authenticated ? renderSignedIn : renderSignIn}
    </>
  );
}

// ----------------------------------------------------------------------

/** Sau khi nhận lời mời: hướng dẫn mở app S Store bằng cùng tài khoản, hoặc vào trang quản lý web. */
export function StaffInviteDoneView() {
  const router = useRouter();
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    try {
      setStoreName(sessionStorage.getItem(DONE_STORE_KEY) ?? '');
    } catch {
      // bỏ qua
    }
  }, []);

  return (
    <Stack spacing={2.5}>
      <Iconify icon="solar:check-circle-bold" width={64} sx={{ color: 'success.main' }} />
      <Typography variant="h4">Bạn đã là nhân viên{storeName ? ` của ${storeName}` : ''}</Typography>
      <Typography variant="body1">
        Mở app <strong>S Store</strong> trên điện thoại, đăng nhập bằng <strong>đúng tài khoản Google/Apple</strong> vừa
        dùng — cửa hàng sẽ hiện ngay trong danh sách.
      </Typography>
      <Button variant="contained" size="large" onClick={() => router.replace(PATH_AFTER_LOGIN)}>
        Vào trang quản lý trên web
      </Button>
    </Stack>
  );
}
