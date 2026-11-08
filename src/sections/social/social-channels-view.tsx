'use client';

import type { SocialChannel } from 'src/lib/social';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { usePathname, useSearchParams } from 'src/routes/hooks';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { useSocialChannels, startThreadsConnect, disconnectSocialChannel } from 'src/api/social';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------
// Kênh kết nối: các tài khoản Threads của cửa hàng. Bấm Kết nối → màn đồng ý của Threads → quay lại trang này với
// ?threads=connected|denied|failed|expired (&account=…). Kết nối lại cùng tài khoản = gia hạn token. Một cửa hàng kết
// nối được nhiều tài khoản: Threads đăng nhập bằng tài khoản đang mở trên threads.com của trình duyệt này.

const OUTCOME: Record<string, { variant: 'success' | 'warning' | 'error'; message: string }> = {
  connected: { variant: 'success', message: 'Đã kết nối kênh Threads' },
  denied: { variant: 'warning', message: 'Bạn đã không đồng ý kết nối Threads' },
  expired: { variant: 'warning', message: 'Yêu cầu kết nối đã hết hạn, bấm Kết nối Threads lần nữa' },
  failed: {
    variant: 'error',
    message: 'Chưa kết nối được Threads — kiểm tra App secret và Redirect callback URL ở trang Cấu hình',
  },
};

const STATUS: Record<string, { label: string; color: 'success' | 'warning' | 'default' }> = {
  connected: { label: 'Đang kết nối', color: 'success' },
  expired: { label: 'Cần kết nối lại', color: 'warning' },
  disconnected: { label: 'Đã ngắt', color: 'default' },
};

export function SocialChannelsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { channels, threadsConfigured, loading, error, refresh } = useSocialChannels();
  const [busy, setBusy] = useState(false);

  // Quay về từ Threads: báo kết quả một lần rồi bỏ tham số khỏi địa chỉ.
  const outcome = searchParams.get('threads');
  const account = searchParams.get('account');
  useEffect(() => {
    if (!outcome || !OUTCOME[outcome]) return;
    const { message, variant } = OUTCOME[outcome];
    enqueueSnackbar(outcome === 'connected' && account ? `${message} @${account}` : message, { variant });
    window.history.replaceState(null, '', pathname);
  }, [outcome, account, enqueueSnackbar, pathname]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      window.location.href = await startThreadsConnect(pathname);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Chưa kết nối được Threads'), { variant: 'error' });
      setBusy(false);
    }
  };

  const handleDisconnect = async (channel: SocialChannel) => {
    const ok = await confirm({
      title: `Ngắt kênh @${channel.username}?`,
      content:
        'Bài đã đăng vẫn còn trên Threads. Bài hẹn giờ của kênh này sẽ bị huỷ. Muốn dùng lại thì bấm Kết nối Threads.',
      confirmText: 'Ngắt kết nối',
      destructive: true,
    });
    if (!ok) return;
    try {
      await disconnectSocialChannel(channel.id);
      enqueueSnackbar(`Đã ngắt kênh @${channel.username}`);
      refresh();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Ngắt kết nối thất bại'), { variant: 'error' });
    }
  };

  const connectButton = (
    <LoadingButton
      variant="contained"
      loading={busy}
      disabled={!threadsConfigured}
      startIcon={<Iconify icon="ri:threads-fill" />}
      onClick={handleConnect}
    >
      {channels.length > 0 ? 'Thêm tài khoản Threads' : 'Kết nối Threads'}
    </LoadingButton>
  );

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Kênh kết nối"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Bán hàng online', href: paths.dashboard.social.root },
          { name: 'Kênh kết nối' },
        ]}
        action={connectButton}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {!loading && !threadsConfigured && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" component={RouterLink} href={paths.dashboard.social.settings}>
              Mở Cấu hình
            </Button>
          }
        >
          Cửa hàng chưa nhập Meta app (Threads app ID và app secret). Nhập ở trang Cấu hình rồi quay lại kết nối.
        </Alert>
      )}

      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
          <li>
            Kết nối nhiều trang: Threads dùng tài khoản đang đăng nhập trên threads.com của trình duyệt này. Muốn thêm
            trang khác, mở threads.com, chuyển sang (hoặc đăng nhập) tài khoản đó, rồi bấm Thêm tài khoản Threads.
          </li>
          <li>
            Mỗi tài khoản phải được thêm làm Threads Tester trong Meta app của cửa hàng và bấm chấp nhận trong Threads →
            Cài đặt → Tài khoản → Quyền của trang web.
          </li>
          <li>Để trang ở chế độ công khai thì kết nối tự gia hạn, không phải kết nối lại sau 90 ngày.</li>
        </Stack>
      </Alert>

      {error && <Alert severity="error">{apiErrorMessage(error, 'Không tải được danh sách kênh')}</Alert>}

      {loading && (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={88} />
          <Skeleton variant="rounded" height={88} />
        </Stack>
      )}

      {!loading && !error && channels.length === 0 && (
        <EmptyContent
          filled
          title="Chưa có kênh nào"
          description="Kết nối tài khoản Threads của cửa hàng để đăng bài bán hàng từ đây."
          action={threadsConfigured ? <Stack sx={{ mt: 2 }}>{connectButton}</Stack> : undefined}
          sx={{ py: 8 }}
        />
      )}

      <Stack spacing={2}>
        {channels.map((channel) => {
          const status = STATUS[channel.status] ?? STATUS.connected;
          return (
            <Card key={channel.id} sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Avatar src={channel.avatarUrl ?? undefined} alt={channel.username} sx={{ width: 48, height: 48 }}>
                  {channel.username.charAt(0).toUpperCase()}
                </Avatar>
                <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle1" noWrap>
                      @{channel.username}
                    </Typography>
                    <Label color={status.color}>{status.label}</Label>
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {channel.displayName ? `${channel.displayName} · ` : ''}Threads · kết nối {fDateTime(channel.connectedAt)}
                    {channel.tokenExpiresAt ? ` · token hết hạn ${fDateTime(channel.tokenExpiresAt)}` : ''}
                  </Typography>
                  {channel.lastError && (
                    <Typography variant="caption" sx={{ color: 'error.main' }}>
                      {channel.lastError}
                    </Typography>
                  )}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    component="a"
                    href={`https://www.threads.com/@${channel.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<Iconify icon="eva:external-link-fill" />}
                  >
                    Xem trang
                  </Button>
                  {channel.status === 'expired' && (
                    <Button size="small" variant="contained" color="warning" onClick={handleConnect} disabled={busy}>
                      Kết nối lại
                    </Button>
                  )}
                  <Button size="small" color="error" onClick={() => handleDisconnect(channel)}>
                    Ngắt
                  </Button>
                </Stack>
              </Stack>
            </Card>
          );
        })}
      </Stack>

      {confirmDialog}
    </Container>
  );
}
