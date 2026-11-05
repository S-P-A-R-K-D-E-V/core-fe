'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LoadingButton from '@mui/lab/LoadingButton';

import { usePathname, useSearchParams } from 'src/routes/hooks';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { disconnectSPay, startSPayConnect, getSPayConnectStatus, type SPayConnectStatus } from 'src/api/spay-connect';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// "Kết nối S Payment": cửa hàng nối với portal S Payment bằng một lần đồng ý (không nhập khoá). Sau khi nối, chủ cửa hàng
// thêm / gỡ tài khoản ngân hàng nhận tiền ngay trên S Payment — POS dùng được luôn. Bấm Kết nối → core-be đẩy yêu cầu kèm
// mã cửa hàng → màn đồng ý của S Payment → quay lại trang này với ?spay=connected|denied|failed|expired.
// SPARK chưa bật (chưa có client S Store) thì thẻ không hiện.
// ----------------------------------------------------------------------

const OUTCOME: Record<string, { variant: 'success' | 'warning' | 'error'; message: string }> = {
  connected: { variant: 'success', message: 'Đã kết nối S Payment' },
  denied: { variant: 'warning', message: 'Bạn đã không đồng ý kết nối S Payment' },
  expired: { variant: 'warning', message: 'Yêu cầu kết nối đã hết hạn, bấm Kết nối S Payment lần nữa' },
  failed: { variant: 'error', message: 'Chưa kết nối được S Payment, thử lại sau ít phút' },
};

export default function SPayConnectCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<SPayConnectStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await getSPayConnectStatus());
      setLoadError(null);
    } catch (error) {
      setLoadError(apiErrorMessage(error, 'Không tải được trạng thái kết nối S Payment'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Quay về từ S Payment: báo kết quả một lần rồi bỏ ?spay= khỏi địa chỉ.
  const outcome = searchParams.get('spay');
  useEffect(() => {
    if (!outcome || !OUTCOME[outcome]) return;
    enqueueSnackbar(OUTCOME[outcome].message, { variant: OUTCOME[outcome].variant });
    const params = new URLSearchParams(searchParams.toString());
    params.delete('spay');
    const query = params.toString();
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
  }, [outcome, enqueueSnackbar, pathname, searchParams]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('spay');
      const query = params.toString();
      window.location.href = await startSPayConnect(query ? `${pathname}?${query}` : pathname);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Chưa kết nối được S Payment'), { variant: 'error' });
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Ngắt kết nối S Payment?',
      content:
        'S Store không còn quyền dùng tài khoản S Payment của cửa hàng.\n' +
        'Tài khoản ngân hàng và giao dịch trên S Payment vẫn giữ nguyên; kết nối lại được bất cứ lúc nào.',
      confirmText: 'Ngắt kết nối',
      cancelText: 'Huỷ',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await disconnectSPay();
      enqueueSnackbar('Đã ngắt kết nối S Payment', { variant: 'success' });
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Chưa ngắt được kết nối'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <Alert severity="error">{loadError}</Alert>;
  if (!status) return <Skeleton variant="rounded" height={140} />;
  if (!status.configured) return null;

  const connected = status.status === 'connected';

  return (
    <Card>
      <CardHeader
        title="Kết nối S Payment"
        subheader="Quản lý tài khoản ngân hàng nhận tiền, giao dịch và đối soát của cửa hàng trên S Payment."
        action={<Label color={connected ? 'success' : 'default'}>{connected ? 'Đã kết nối' : 'Chưa kết nối'}</Label>}
      />
      <CardContent>
        <Stack spacing={2}>
          {connected ? (
            <Typography variant="body2" color="text.secondary">
              Kết nối lúc {status.connectedAt ? fDateTime(status.connectedAt) : '—'}
              {status.accountCount != null ? ` · ${status.accountCount} tài khoản nhận tiền` : ''}. Thêm hoặc gỡ ngân hàng ở
              trang Ngân hàng của S Payment; POS dùng được ngay.
            </Typography>
          ) : (
            <>
              {status.disconnectReason === 'revoked_in_spay' && (
                <Alert severity="info">Kết nối đã bị thu hồi trên S Payment. Bấm Kết nối S Payment để nối lại.</Alert>
              )}
              <Typography variant="body2" color="text.secondary">
                Bấm Kết nối, đăng nhập hoặc tạo tài khoản S Payment rồi đồng ý. Không cần nhập khoá hay mã nào.
              </Typography>
            </>
          )}

          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {connected ? (
              <>
                <Button
                  variant="contained"
                  href={status.banksUrl}
                  target="_blank"
                  rel="noopener"
                  startIcon={<Iconify icon="solar:card-bold" />}
                >
                  Quản lý tài khoản ngân hàng
                </Button>
                <LoadingButton color="error" variant="outlined" loading={busy} onClick={handleDisconnect}>
                  Ngắt kết nối
                </LoadingButton>
              </>
            ) : (
              <LoadingButton
                variant="contained"
                loading={busy}
                onClick={handleConnect}
                startIcon={<Iconify icon="solar:link-bold" />}
              >
                Kết nối S Payment
              </LoadingButton>
            )}
          </Stack>
        </Stack>
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
