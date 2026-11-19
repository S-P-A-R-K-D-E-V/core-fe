'use client';

import type { SocialChannel, SocialChannelList } from 'src/lib/social';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { usePathname, useSearchParams } from 'src/routes/hooks';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import {
  channelUrl,
  channelLabel,
  PLATFORM_ICON,
  PLATFORM_LABEL,
  subscriptionSummary,
} from 'src/lib/social';
import {
  useSocialChannels,
  startThreadsConnect,
  startFacebookConnect,
  setSocialChannelInbox,
  disconnectSocialChannel,
  resubscribeSocialChannel,
} from 'src/api/social';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------
// Kênh kết nối: tài khoản Threads + fanpage Facebook của cửa hàng. Bấm Kết nối → màn đồng ý của Threads / Facebook → quay
// lại trang này với ?threads=… hoặc ?facebook=connected|denied|failed|expired|nopages (&account=…). Kết nối lại cùng tài
// khoản / page = thay token. Threads đăng nhập bằng tài khoản đang mở trên threads.com; Facebook cho chọn page ngay trong
// màn đồng ý (mọi page được chọn mà tài khoản có quyền đăng bài đều được nối).
// Fanpage có thêm công tắc Hộp thư khách (nhận tin + bình luận) / Agent CSKH, nút Đăng ký lại nhận tin và mốc webhook gần nhất.

const OUTCOME: Record<string, { variant: 'success' | 'warning' | 'error'; message: string }> = {
  connected: { variant: 'success', message: 'Đã kết nối kênh Threads' },
  denied: { variant: 'warning', message: 'Bạn đã không đồng ý kết nối Threads' },
  expired: { variant: 'warning', message: 'Yêu cầu kết nối đã hết hạn, bấm Kết nối Threads lần nữa' },
  failed: {
    variant: 'error',
    message: 'Chưa kết nối được Threads — kiểm tra App secret và Redirect callback URL ở trang Cấu hình',
  },
};

const FACEBOOK_OUTCOME: Record<string, { variant: 'success' | 'warning' | 'error'; message: string }> = {
  connected: { variant: 'success', message: 'Đã kết nối fanpage' },
  denied: { variant: 'warning', message: 'Bạn đã không đồng ý kết nối Facebook' },
  expired: { variant: 'warning', message: 'Yêu cầu kết nối đã hết hạn, bấm Kết nối Fanpage lần nữa' },
  nopages: {
    variant: 'warning',
    message: 'Không có fanpage nào đăng bài được — chọn page trong màn đồng ý và kiểm tra tài khoản có quyền đăng bài trên page',
  },
  failed: {
    variant: 'error',
    message: 'Chưa kết nối được fanpage — kiểm tra App ID, App secret và Valid OAuth Redirect URI ở trang Cấu hình',
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
  const { channels, threadsConfigured, facebookConfigured, loading, error, refresh } = useSocialChannels();
  const [busy, setBusy] = useState(false);

  // Quay về từ Threads / Facebook: báo kết quả một lần rồi bỏ tham số khỏi địa chỉ.
  const outcome = searchParams.get('threads');
  const fbOutcome = searchParams.get('facebook');
  const account = searchParams.get('account');
  useEffect(() => {
    if (outcome && OUTCOME[outcome]) {
      const { message, variant } = OUTCOME[outcome];
      enqueueSnackbar(outcome === 'connected' && account ? `${message} @${account}` : message, { variant });
    } else if (fbOutcome && FACEBOOK_OUTCOME[fbOutcome]) {
      const { message, variant } = FACEBOOK_OUTCOME[fbOutcome];
      enqueueSnackbar(fbOutcome === 'connected' && account ? `${message}: ${account}` : message, { variant });
    } else return;
    window.history.replaceState(null, '', pathname);
  }, [outcome, fbOutcome, account, enqueueSnackbar, pathname]);

  const handleConnectFacebook = async () => {
    setBusy(true);
    try {
      window.location.href = await startFacebookConnect(pathname);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Chưa kết nối được fanpage'), { variant: 'error' });
      setBusy(false);
    }
  };

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
      title: `Ngắt kênh ${channelLabel(channel)}?`,
      content:
        channel.platform === 'facebook'
          ? 'Bài đã đăng vẫn còn trên fanpage. Bài hẹn giờ của kênh này sẽ bị huỷ. Muốn dùng lại thì bấm Kết nối Fanpage.'
          : 'Bài đã đăng vẫn còn trên Threads. Bài hẹn giờ của kênh này sẽ bị huỷ. Muốn dùng lại thì bấm Kết nối Threads.',
      confirmText: 'Ngắt kết nối',
      destructive: true,
    });
    if (!ok) return;
    try {
      await disconnectSocialChannel(channel.id);
      enqueueSnackbar(`Đã ngắt kênh ${channelLabel(channel)}`);
      refresh();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Ngắt kết nối thất bại'), { variant: 'error' });
    }
  };

  const hasThreads = channels.some((c) => c.platform === 'threads');
  const hasFacebook = channels.some((c) => c.platform === 'facebook' && c.status !== 'disconnected');

  const handleInboxChange = async (channel: SocialChannel, input: { inboxEnabled: boolean; agentEnabled: boolean }) => {
    try {
      const saved = await setSocialChannelInbox(channel.id, input);
      refresh(
        (data: SocialChannelList | undefined) =>
          data && {
            ...data,
            items: data.items.map((c) =>
              c.id === channel.id ? { ...c, inboxEnabled: saved.inboxEnabled, agentEnabled: saved.agentEnabled } : c
            ),
          },
        { revalidate: false }
      );
      enqueueSnackbar(
        !saved.inboxEnabled
          ? `Đã tắt hộp thư cho ${channelLabel(channel)} — page chỉ để đăng bài`
          : saved.agentEnabled
            ? `Agent CSKH sẽ trả lời khách của ${channelLabel(channel)}`
            : `Tin nhắn và bình luận của ${channelLabel(channel)} vào Hộp thư khách`
      );
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được cài đặt hộp thư'), { variant: 'error' });
      throw err;
    }
  };
  const connectButton = (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <LoadingButton
        variant="contained"
        loading={busy}
        disabled={!facebookConfigured}
        startIcon={<Iconify icon="eva:facebook-fill" />}
        onClick={handleConnectFacebook}
      >
        Kết nối Fanpage
      </LoadingButton>
      <LoadingButton
        variant="outlined"
        loading={busy}
        disabled={!threadsConfigured}
        startIcon={<Iconify icon="ri:threads-fill" />}
        onClick={handleConnect}
      >
        {hasThreads ? 'Thêm tài khoản Threads' : 'Kết nối Threads'}
      </LoadingButton>
    </Stack>
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

      {!loading && !facebookConfigured && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" component={RouterLink} href={paths.dashboard.social.settings}>
              Mở Cấu hình
            </Button>
          }
        >
          Chưa có Meta app cho fanpage (App ID và App secret). Nhập ở trang Cấu hình để bật nút Kết nối Fanpage.
        </Alert>
      )}

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
          <li>
            Fanpage: bấm Kết nối Fanpage, đăng nhập Facebook bằng tài khoản quản trị page và chọn page trong màn đồng ý.
            Token page không hết hạn; đổi mật khẩu Facebook hoặc gỡ quyền app thì kênh báo "Cần kết nối lại".
          </li>
        </Stack>
      </Alert>

      {hasFacebook && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <LoadingButton
              color="inherit"
              size="small"
              loading={busy}
              disabled={!facebookConfigured}
              onClick={handleConnectFacebook}
            >
              Kết nối lại
            </LoadingButton>
          }
        >
          Để Hộp thư khách nhận và trả lời bình luận, bấm <strong>Kết nối lại</strong> fanpage một lần (chọn đủ các page) để token
          có thêm quyền đọc / trả lời bình luận (<code>pages_read_user_content</code>, <code>pages_manage_engagement</code>).
        </Alert>
      )}

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
          description="Kết nối fanpage Facebook hoặc tài khoản Threads của cửa hàng để đăng bài bán hàng từ đây."
          action={threadsConfigured || facebookConfigured ? <Stack sx={{ mt: 2 }}>{connectButton}</Stack> : undefined}
          sx={{ py: 8 }}
        />
      )}

      <Stack spacing={2}>
        {channels.map((channel) => {
          const status = STATUS[channel.status] ?? STATUS.connected;
          return (
            <Card key={channel.id} sx={{ p: 2.5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                <Avatar src={channel.avatarUrl ?? undefined} alt={channelLabel(channel)} sx={{ width: 48, height: 48 }}>
                  {channelLabel(channel).replace('@', '').charAt(0).toUpperCase()}
                </Avatar>
                <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Iconify icon={PLATFORM_ICON[channel.platform] ?? 'eva:globe-2-fill'} width={18} />
                    <Typography variant="subtitle1" noWrap>
                      {channelLabel(channel)}
                    </Typography>
                    <Label color={status.color}>{status.label}</Label>
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {channel.platform !== 'facebook' && channel.displayName ? `${channel.displayName} · ` : ''}
                    {PLATFORM_LABEL[channel.platform] ?? channel.platform} · kết nối {fDateTime(channel.connectedAt)}
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
                    href={channelUrl(channel)}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<Iconify icon="eva:external-link-fill" />}
                  >
                    Xem trang
                  </Button>
                  {channel.status === 'expired' && (
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      onClick={channel.platform === 'facebook' ? handleConnectFacebook : handleConnect}
                      disabled={busy}
                    >
                      Kết nối lại
                    </Button>
                  )}
                  <Button size="small" color="error" onClick={() => handleDisconnect(channel)}>
                    Ngắt
                  </Button>
                </Stack>
              </Stack>

              {channel.platform === 'facebook' && channel.status !== 'disconnected' && (
                <FacebookInboxControls channel={channel} onChange={handleInboxChange} />
              )}
            </Card>
          );
        })}
      </Stack>

      {confirmDialog}
    </Container>
  );
}

// ----------------------------------------------------------------------
// Fanpage: nhận tin + bình luận vào Hộp thư khách, Agent CSKH trả lời (chỉ khi hộp thư bật), đăng ký lại nhận tin.

type InboxControlsProps = {
  channel: SocialChannel;
  /** Ném lỗi = công tắc về như cũ (nơi gọi đã báo). */
  onChange: (channel: SocialChannel, input: { inboxEnabled: boolean; agentEnabled: boolean }) => Promise<void>;
};

function FacebookInboxControls({ channel, onChange }: InboxControlsProps) {
  const [saving, setSaving] = useState<'inbox' | 'agent' | null>(null);
  const [resubscribing, setResubscribing] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof subscriptionSummary> | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const inboxEnabled = channel.inboxEnabled ?? true;
  const agentEnabled = inboxEnabled && (channel.agentEnabled ?? false);

  const save = async (which: 'inbox' | 'agent', input: { inboxEnabled: boolean; agentEnabled: boolean }) => {
    setSaving(which);
    try {
      await onChange(channel, input);
    } catch {
      // đã báo
    } finally {
      setSaving(null);
    }
  };

  const handleResubscribe = async () => {
    setResubscribing(true);
    setResult(null);
    try {
      const summary = subscriptionSummary(await resubscribeSocialChannel(channel.id));
      setResult(summary);
      enqueueSnackbar(summary.message, { variant: summary.severity });
    } catch (err) {
      const message = apiErrorMessage(err, 'Không đăng ký lại được nhận tin');
      setResult({ severity: 'error', message });
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setResubscribing(false);
    }
  };

  return (
    <>
      <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1, md: 2 }}
        alignItems={{ md: 'center' }}
        flexWrap="wrap"
        useFlexGap
      >
        <FormControlLabel
          control={
            <Switch
              checked={inboxEnabled}
              disabled={!!saving}
              onChange={(_, checked) =>
                save('inbox', { inboxEnabled: checked, agentEnabled: checked ? agentEnabled : false })
              }
            />
          }
          label={<Typography variant="body2">Nhận tin &amp; bình luận vào hộp thư</Typography>}
          sx={{ mx: 0 }}
        />
        <FormControlLabel
          control={
            <Switch
              color="info"
              checked={agentEnabled}
              disabled={!inboxEnabled || !!saving}
              onChange={(_, checked) => save('agent', { inboxEnabled: true, agentEnabled: checked })}
            />
          }
          label={<Typography variant="body2">Agent CSKH trả lời</Typography>}
          sx={{ mx: 0 }}
        />
        <Stack direction="row" sx={{ flex: 1 }} />
        <LoadingButton
          size="small"
          variant="soft"
          loading={resubscribing}
          disabled={!inboxEnabled || channel.status !== 'connected'}
          onClick={handleResubscribe}
          startIcon={<Iconify icon="solar:refresh-bold" />}
        >
          Đăng ký lại nhận tin
        </LoadingButton>
      </Stack>

      <Typography variant="caption" component="div" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {inboxEnabled
          ? 'Tin nhắn Messenger và bình luận trên bài của page vào Hộp thư khách.'
          : 'Đang tắt — page chỉ dùng để đăng bài, tin nhắn và bình luận không vào hộp thư.'}
        {channel.lastWebhookAt ? ` Webhook gần nhất: ${fDateTime(channel.lastWebhookAt)}.` : ''}
        {!channel.lastWebhookAt && channel.webhookSubscribedAt
          ? ` Đã đăng ký nhận tin ${fDateTime(channel.webhookSubscribedAt)}, chưa có sự kiện nào.`
          : ''}
      </Typography>

      {result && (
        <Alert severity={result.severity} onClose={() => setResult(null)} sx={{ mt: 1.5 }}>
          {result.message}
        </Alert>
      )}
    </>
  );
}
