'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import axiosInstance, { endpoints } from 'src/utils/axios';
import { apiErrorMessage, hasApiErrorCode } from 'src/utils/api-error';

import Iconify from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { ILoginSession } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

const OTHERS = 'others';

/** BE nhận ra "trình duyệt này là phiên nào" qua header này khi access token chưa gắn phiên. */
const SESSION_TOKEN_HEADER = 'X-Session-Token';

function sessionHeaders() {
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : null;
  return sessionToken ? { headers: { [SESSION_TOKEN_HEADER]: sessionToken } } : undefined;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

function deviceIcon(session: ILoginSession) {
  if (session.signedInWithQr) return 'solar:qr-code-bold';
  return session.device?.startsWith('App') ? 'solar:smartphone-bold' : 'solar:monitor-bold';
}

/**
 * Thiết bị đang đăng nhập: các phiên đăng nhập còn mở của chính tài khoản này (mọi cửa hàng), đăng xuất
 * từng thiết bị hoặc mọi thiết bị khác từ xa. BE cắt ngay: access token của thiết bị đó bị từ chối ở
 * request kế tiếp, kết nối realtime bị ngắt, điện thoại thôi nhận thông báo đẩy. Trình duyệt đang xem
 * không có nút ở đây — dùng Đăng xuất thường.
 */
export default function AccountLoginSessions() {
  const [sessions, setSessions] = useState<ILoginSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pending, setPending] = useState<ILoginSession | typeof OTHERS | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await axiosInstance.get<ILoginSession[]>(endpoints.auth.sessions, sessionHeaders());
      setSessions(res.data);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Không tải được danh sách thiết bị.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const others = sessions.filter((s) => !s.isCurrent);
  // Chưa biết trình duyệt này là phiên nào (token cũ, không có sessionToken): "các thiết bị khác" sẽ gồm cả
  // chính nó — không đưa nút đó ra.
  const knowsCurrent = sessions.some((s) => s.isCurrent);

  const confirm = async () => {
    const target = pending;
    setPending(null);
    if (!target) return;

    setErrorMsg('');
    setSuccessMsg('');

    if (target === OTHERS) {
      setActionLoading(OTHERS);
      try {
        const res = await axiosInstance.post<{ revoked: number }>(
          endpoints.auth.sessionsRevokeOthers,
          undefined,
          sessionHeaders()
        );
        setSuccessMsg(`Đã đăng xuất ${res.data.revoked} thiết bị khác.`);
      } catch (err) {
        setErrorMsg(apiErrorMessage(err, 'Không đăng xuất được các thiết bị khác.'));
      } finally {
        setActionLoading(null);
        await fetchSessions();
      }
      return;
    }

    setActionLoading(target.id);
    try {
      await axiosInstance.delete(endpoints.auth.sessionRevoke(target.id));
      setSuccessMsg(`Đã đăng xuất ${target.device ?? 'thiết bị'}.`);
    } catch (err) {
      // Thiết bị đó vừa tự đăng xuất / hết hạn: không còn gì để thu hồi — chỉ cần tải lại danh sách.
      if (!hasApiErrorCode(err, 'Auth.LoginSessionNotFound')) {
        setErrorMsg(apiErrorMessage(err, 'Không đăng xuất được thiết bị này.'));
      }
    } finally {
      setActionLoading(null);
      await fetchSessions();
    }
  };

  return (
    <Card sx={{ p: 3, mt: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h6">Thiết bị đang đăng nhập</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Các nơi tài khoản này đang đăng nhập. Thấy thiết bị lạ thì đăng xuất nó ở đây — có hiệu lực
            ngay — rồi đổi mật khẩu.
          </Typography>
        </Stack>

        {knowsCurrent && others.length > 0 && (
          <LoadingButton
            color="error"
            variant="outlined"
            loading={actionLoading === OTHERS}
            disabled={!!actionLoading}
            onClick={() => setPending(OTHERS)}
            sx={{ flexShrink: 0 }}
          >
            Đăng xuất các thiết bị khác
          </LoadingButton>
        )}
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

      {!loading && sessions.length === 0 && !errorMsg && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Không có phiên đăng nhập nào đang mở.
        </Typography>
      )}

      <Stack divider={<Divider sx={{ borderStyle: 'dashed' }} />}>
        {sessions.map((s) => (
          <Stack
            key={s.id}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{ py: 2 }}
          >
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
                <Iconify icon={deviceIcon(s)} width={24} />
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle2">{s.device ?? 'Thiết bị không rõ'}</Typography>
                  {s.isCurrent && <Chip size="small" color="success" variant="soft" label="Thiết bị này" />}
                  {s.signedInWithQr && <Chip size="small" variant="soft" label="Mã QR" />}
                </Stack>
                <Typography variant="caption" color="text.secondary" component="div">
                  {s.ipAddress ? `IP ${s.ipAddress} · ` : ''}
                  Đăng nhập {formatTime(s.signedInAt)}
                  {s.lastActiveAt ? ` · Hoạt động gần nhất ${formatTime(s.lastActiveAt)}` : ''}
                </Typography>
                {s.signedInWithQr && (
                  <Typography variant="caption" color="text.secondary" component="div">
                    Tự hết lúc {formatTime(s.expiresAt)}
                  </Typography>
                )}
              </Box>
            </Stack>

            {!s.isCurrent && (
              <LoadingButton
                size="small"
                color="error"
                variant="outlined"
                loading={actionLoading === s.id}
                disabled={!!actionLoading}
                onClick={() => setPending(s)}
                sx={{ flexShrink: 0 }}
              >
                Đăng xuất
              </LoadingButton>
            )}
          </Stack>
        ))}
      </Stack>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending === OTHERS ? 'Đăng xuất các thiết bị khác?' : 'Đăng xuất thiết bị này?'}
        content={
          pending === OTHERS
            ? `${others.length} thiết bị khác sẽ bị đăng xuất ngay và phải đăng nhập lại. Trình duyệt này giữ nguyên.`
            : pending
              ? `${pending.device ?? 'Thiết bị này'}${
                  pending.ipAddress ? ` (IP ${pending.ipAddress})` : ''
                } sẽ bị đăng xuất ngay và phải đăng nhập lại.`
              : ''
        }
        action={
          <Button variant="contained" color="error" onClick={confirm}>
            Đăng xuất
          </Button>
        }
      />
    </Card>
  );
}
