'use client';

import { useCallback, useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import FacebookLogin from 'react-facebook-login/dist/facebook-login-render-props';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { FACEBOOK_APP_ID } from 'src/config-global';
import { endpoints } from 'src/utils/axios';
import axiosInstance from 'src/utils/axios';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

interface OAuthConnection {
  provider: string;
  connectedAt: string;
}

export default function AccountConnectedAccounts() {
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
  }, [fetchConnections]);

  const isConnected = (provider: string) =>
    connections.some((c) => c.provider.toLowerCase() === provider.toLowerCase());

  const handleDisconnect = async (provider: string) => {
    setActionLoading(provider);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await axiosInstance.delete(endpoints.auth.oauthDisconnect(provider));
      setSuccessMsg(`Đã ngắt kết nối ${provider}`);
      await fetchConnections();
    } catch (err: any) {
      setErrorMsg(err?.title || err?.message || `Không thể ngắt kết nối ${provider}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConnect = async (provider: string, token: string) => {
    setActionLoading(provider);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await axiosInstance.post(endpoints.auth.oauthConnect, { provider, token });
      setSuccessMsg(`Đã kết nối ${provider} thành công`);
      await fetchConnections();
    } catch (err: any) {
      setErrorMsg(err?.title || err?.message || `Không thể kết nối ${provider}`);
    } finally {
      setActionLoading(null);
    }
  };

  const providers = [
    {
      id: 'google',
      label: 'Google',
      icon: 'devicon:google',
      color: '#DB4437',
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: 'logos:facebook',
      color: '#1877F2',
    },
  ];

  return (
    <Card sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Tài khoản liên kết
      </Typography>

      {errorMsg && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {errorMsg}
        </Typography>
      )}
      {successMsg && (
        <Typography variant="body2" color="success.main" sx={{ mb: 2 }}>
          {successMsg}
        </Typography>
      )}

      <Stack divider={<Divider sx={{ borderStyle: 'dashed' }} />} spacing={0}>
        {providers.map((p) => {
          const connected = isConnected(p.id);
          const conn = connections.find((c) => c.provider.toLowerCase() === p.id);

          return (
            <Stack
              key={p.id}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ py: 2.5 }}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Iconify icon={p.icon} width={24} />
                </Box>
                <Box>
                  <Typography variant="subtitle2">{p.label}</Typography>
                  {connected && conn ? (
                    <Typography variant="caption" color="text.secondary">
                      Đã kết nối •{' '}
                      {new Date(conn.connectedAt).toLocaleDateString('vi-VN')}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Chưa kết nối
                    </Typography>
                  )}
                </Box>
              </Stack>

              {connected ? (
                <LoadingButton
                  size="small"
                  color="error"
                  variant="outlined"
                  loading={actionLoading === p.id}
                  onClick={() => handleDisconnect(p.id)}
                >
                  Ngắt kết nối
                </LoadingButton>
              ) : (
                <>
                  {p.id === 'google' && (
                    <GoogleLogin
                      onSuccess={(resp) => handleConnect('google', resp.credential!)}
                      onError={() => setErrorMsg('Không thể kết nối Google')}
                      text="continue_with"
                      shape="rectangular"
                      size="medium"
                      locale="vi"
                    />
                  )}
                  {p.id === 'facebook' && (
                    <FacebookLogin
                      appId={FACEBOOK_APP_ID}
                      fields="name,email,first_name,last_name,picture"
                      callback={async (resp: any) => {
                        if (!resp?.accessToken) return;
                        handleConnect('facebook', resp.accessToken);
                      }}
                      render={(renderProps: any) => (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Iconify icon="logos:facebook" width={18} />}
                          onClick={renderProps.onClick}
                          disabled={renderProps.isDisabled || actionLoading === 'facebook'}
                          sx={{ borderColor: '#1877F2', color: '#1877F2' }}
                        >
                          Kết nối
                        </Button>
                      )}
                    />
                  )}
                </>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Card>
  );
}
