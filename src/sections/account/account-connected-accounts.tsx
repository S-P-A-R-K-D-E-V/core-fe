'use client';

import { useState, useEffect, useCallback } from 'react';
import FacebookLogin from 'react-facebook-login/dist/facebook-login-render-props';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import axiosInstance, { endpoints } from 'src/utils/axios';
import { apiErrorMessage } from 'src/utils/api-error';

import { FACEBOOK_APP_ID } from 'src/config-global';
import { useAuthContext } from 'src/auth/hooks';
import { AUTH_HOST, APPLE_SERVICES_ID, tenantCodeFromHost } from 'src/auth/utils/saas-host';

import Iconify from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

interface OAuthConnection {
  id: string;
  provider: string;
  email: string | null;
  connectedAt: string;
}

const PROVIDERS: Record<string, { label: string; icon: string }> = {
  google: { label: 'Google', icon: 'devicon:google' },
  apple: { label: 'Apple', icon: 'mdi:apple' },
  facebook: { label: 'Facebook', icon: 'logos:facebook' },
};

/**
 * Một tài khoản = một email đăng nhập; liên kết thêm được nhiều Google/Apple (kể cả nhiều tài khoản
 * Google) để đăng nhập nhanh. Google/Apple liên kết qua trang auth (tên miền duy nhất khai báo với
 * Google/Apple): xin vé một lần rồi mở /sso/start/?link=1 — trang đó gắn xong chuyển về đây với
 * ?tab=connected&linked=<nhà cung cấp>. Facebook (chỉ CiCi) vẫn gắn ngay tại trang này.
 */
export default function AccountConnectedAccounts() {
  const { user } = useAuthContext();
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pendingRemove, setPendingRemove] = useState<OAuthConnection | null>(null);
  const [showFacebook, setShowFacebook] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await axiosInstance.get<OAuthConnection[]>(endpoints.auth.oauthConnections);
      setConnections(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();

    // Facebook chỉ còn ở CiCi (không phải tên miền cửa hàng SaaS).
    setShowFacebook(!!FACEBOOK_APP_ID && tenantCodeFromHost(window.location.host) === null);

    // Quay về từ trang auth sau khi liên kết.
    const params = new URLSearchParams(window.location.search);
    const linked = params.get('linked');
    if (linked) {
      setSuccessMsg(`Đã liên kết ${PROVIDERS[linked]?.label ?? linked}.`);
      params.delete('linked');
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }
  }, [fetchConnections]);

  const startLink = async (provider: 'google' | 'apple') => {
    setActionLoading(provider);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await axiosInstance.post<{ linkToken: string }>(endpoints.auth.oauthLinkStart);
      // Vé đi qua fragment (#t=…) — không lên server, không vào log.
      window.location.assign(
        `https://${AUTH_HOST}/sso/start/?link=1&provider=${provider}#t=${encodeURIComponent(res.data.linkToken)}`
      );
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Không bắt đầu liên kết được. Thử lại sau.'));
      setActionLoading(null);
    }
  };

  const connectFacebook = async (token: string) => {
    setActionLoading('facebook');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await axiosInstance.post(endpoints.auth.oauthConnect, { provider: 'facebook', token });
      setSuccessMsg('Đã liên kết Facebook.');
      await fetchConnections();
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Không thể liên kết Facebook'));
    } finally {
      setActionLoading(null);
    }
  };

  const confirmRemove = async () => {
    const target = pendingRemove;
    setPendingRemove(null);
    if (!target) return;
    setActionLoading(target.id);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await axiosInstance.delete(endpoints.auth.oauthDisconnect(target.id));
      setSuccessMsg(`Đã gỡ liên kết ${PROVIDERS[target.provider]?.label ?? target.provider}.`);
      await fetchConnections();
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Không gỡ được liên kết'));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Card sx={{ p: 3 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h6">Tài khoản liên kết</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Email đăng nhập{user?.email ? ` (${user.email})` : ''} giữ nguyên. Liên kết thêm Google/Apple để
          đăng nhập nhanh — có thể liên kết nhiều tài khoản.
        </Typography>
      </Stack>

      {!!errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
      )}
      {!!successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      {!loading && connections.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Chưa liên kết tài khoản nào.
        </Typography>
      )}

      <Stack divider={<Divider sx={{ borderStyle: 'dashed' }} />}>
        {connections.map((c) => {
          const meta = PROVIDERS[c.provider.toLowerCase()] ?? { label: c.provider, icon: 'mdi:link-variant' };
          return (
            <Stack key={c.id} direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ py: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Iconify icon={meta.icon} width={24} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {meta.label}
                    {c.email ? ` · ${c.email}` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Liên kết ngày {new Date(c.connectedAt).toLocaleDateString('vi-VN')}
                  </Typography>
                </Box>
              </Stack>

              <LoadingButton
                size="small"
                color="error"
                variant="outlined"
                loading={actionLoading === c.id}
                onClick={() => setPendingRemove(c)}
              >
                Gỡ
              </LoadingButton>
            </Stack>
          );
        })}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
        <LoadingButton
          variant="outlined"
          color="inherit"
          loading={actionLoading === 'google'}
          disabled={!!actionLoading}
          onClick={() => startLink('google')}
          startIcon={<Iconify icon="devicon:google" width={18} />}
        >
          Liên kết Google
        </LoadingButton>

        {!!APPLE_SERVICES_ID && (
          <LoadingButton
            variant="outlined"
            color="inherit"
            loading={actionLoading === 'apple'}
            disabled={!!actionLoading}
            onClick={() => startLink('apple')}
            startIcon={<Iconify icon="mdi:apple" width={18} />}
          >
            Liên kết Apple
          </LoadingButton>
        )}

        {showFacebook && (
          <FacebookLogin
            appId={FACEBOOK_APP_ID}
            fields="name,email,first_name,last_name,picture"
            callback={(resp: any) => {
              if (resp?.accessToken) connectFacebook(resp.accessToken);
            }}
            render={(renderProps: any) => (
              <Button
                variant="outlined"
                startIcon={<Iconify icon="logos:facebook" width={18} />}
                onClick={renderProps.onClick}
                disabled={renderProps.isDisabled || !!actionLoading}
                sx={{ borderColor: '#1877F2', color: '#1877F2' }}
              >
                Liên kết Facebook
              </Button>
            )}
          />
        )}
      </Stack>

      <ConfirmDialog
        open={!!pendingRemove}
        onClose={() => setPendingRemove(null)}
        title="Gỡ liên kết?"
        content={
          pendingRemove
            ? `Không đăng nhập bằng ${PROVIDERS[pendingRemove.provider]?.label ?? pendingRemove.provider}${
                pendingRemove.email ? ` (${pendingRemove.email})` : ''
              } được nữa. Email đăng nhập và mật khẩu vẫn dùng bình thường.`
            : ''
        }
        action={
          <Button variant="contained" color="error" onClick={confirmRemove}>
            Gỡ liên kết
          </Button>
        }
      />
    </Card>
  );
}
