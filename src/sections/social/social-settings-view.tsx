'use client';

import { useState, useEffect } from 'react';

import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';
import { useCopyToClipboard } from 'src/hooks/use-copy-to-clipboard';

import { isValidThreadsAppId } from 'src/lib/social';
import { useThreadsApp, saveThreadsApp, deleteThreadsApp } from 'src/api/social';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------
// Cấu hình bán hàng online: Meta app (Threads app ID + secret) của cửa hàng. Mỗi cửa hàng dùng app riêng của mình;
// secret lưu mã hoá ở máy chủ và không bao giờ gửi lại trình duyệt.

const SOURCE: Record<string, { label: string; color: 'success' | 'info' | 'default' }> = {
  store: { label: 'App của cửa hàng', color: 'success' },
  platform: { label: 'Đang dùng app chung của SPARK', color: 'info' },
  none: { label: 'Chưa cấu hình', color: 'default' },
};

export function SocialSettingsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const { copy } = useCopyToClipboard();
  const { app, loading, error, refresh } = useThreadsApp();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const isStoreApp = app?.source === 'store';
  useEffect(() => {
    if (isStoreApp && app?.clientId) setClientId(app.clientId);
  }, [isStoreApp, app?.clientId]);

  const trimmedId = clientId.trim();
  const sameApp = isStoreApp && app?.clientId === trimmedId && app.hasSecret;
  const idError = trimmedId.length > 0 && !isValidThreadsAppId(trimmedId);
  const needSecret = !sameApp;
  const canSave = isValidThreadsAppId(trimmedId) && (!needSecret || clientSecret.trim().length > 0);

  const handleCopy = async (text: string) => {
    if (await copy(text)) enqueueSnackbar('Đã sao chép');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveThreadsApp({ clientId: trimmedId, clientSecret: clientSecret.trim() || null });
      setClientSecret('');
      setShowSecret(false);
      enqueueSnackbar('Đã lưu Meta app Threads');
      refresh();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Xoá Meta app của cửa hàng?',
      content:
        'Các kênh đã kết nối vẫn đăng bài và tự gia hạn bình thường. Chỉ không kết nối thêm tài khoản mới được cho tới khi nhập lại app.',
      confirmText: 'Xoá',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteThreadsApp();
      setClientId('');
      setClientSecret('');
      enqueueSnackbar('Đã xoá Meta app');
      refresh();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Xoá thất bại'), { variant: 'error' });
    }
  };

  const source = SOURCE[app?.source ?? 'none'] ?? SOURCE.none;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Cấu hình"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Bán hàng online', href: paths.dashboard.social.root },
          { name: 'Cấu hình' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {error && <Alert severity="error">{apiErrorMessage(error, 'Không tải được cấu hình')}</Alert>}

      {loading && <Skeleton variant="rounded" height={360} />}

      {app && (
        <Stack spacing={3}>
          <Card sx={{ p: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <Iconify icon="ri:threads-fill" width={28} />
              <Typography variant="h6" sx={{ flex: 1 }}>
                Threads — Meta app
              </Typography>
              <Label color={source.color}>{source.label}</Label>
            </Stack>

            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Nhập Threads app ID và Threads app secret của Meta app do cửa hàng tạo. Tất cả tài khoản Threads của cửa
              hàng kết nối qua app này. App secret được mã hoá trên máy chủ, sau khi lưu sẽ không hiện lại.
              {app.updatedAt ? ` Cập nhật lần cuối ${fDateTime(app.updatedAt)}.` : ''}
            </Typography>

            {isStoreApp && !app.hasSecret && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                Máy chủ không đọc được App secret đã lưu. Nhập lại App secret rồi bấm Lưu.
              </Alert>
            )}

            <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
              <TextField
                label="Threads app ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
                error={idError}
                helperText={
                  idError
                    ? 'Threads app ID là dãy số'
                    : 'Use case Threads → Settings. App có 2 ID — dùng ID của Threads, không phải App ID ở đầu trang.'
                }
              />
              <TextField
                label="Threads app secret"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                type={showSecret ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={sameApp ? 'Đã lưu — để trống nếu không đổi' : ''}
                helperText={
                  sameApp ? 'Để trống để giữ secret đang dùng.' : 'Use case Threads → Settings → Threads app secret.'
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showSecret ? 'Ẩn secret' : 'Hiện secret'}
                        onClick={() => setShowSecret((v) => !v)}
                        edge="end"
                      >
                        <Iconify icon={showSecret ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="Redirect callback URL (khai trong Meta app)"
                value={app.callbackUrl}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton aria-label="Sao chép" onClick={() => handleCopy(app.callbackUrl)} edge="end">
                        <Iconify icon="solar:copy-bold" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Stack direction="row" spacing={1.5}>
                <LoadingButton variant="contained" loading={saving} disabled={!canSave} onClick={handleSave}>
                  Lưu
                </LoadingButton>
                {isStoreApp && (
                  <Button color="error" onClick={handleDelete}>
                    Xoá app
                  </Button>
                )}
                {app.source !== 'none' && (
                  <Button component={RouterLink} href={paths.dashboard.social.channels} sx={{ ml: 'auto' }}>
                    Tới Kênh kết nối
                  </Button>
                )}
              </Stack>
            </Stack>
          </Card>

          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Cách tạo Meta app cho Threads
            </Typography>
            <Stack component="ol" spacing={1.25} sx={{ pl: 2.5, m: 0, typography: 'body2' }}>
              <li>
                Vào{' '}
                <Link href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">
                  developers.facebook.com/apps
                </Link>{' '}
                → Create app → chọn use case <b>Access the Threads API</b>.
              </li>
              <li>
                Use cases → Threads API → Customize → Permissions: thêm <b>threads_basic</b>,{' '}
                <b>threads_content_publish</b>, <b>threads_manage_insights</b>, <b>threads_read_replies</b>,{' '}
                <b>threads_manage_replies</b>.
              </li>
              <li>
                Use case Threads → Settings → <b>Redirect Callback URLs</b>: dán đúng URL ở trên. Uninstall / Delete
                callback điền tạm trang web của cửa hàng.
              </li>
              <li>
                App roles → Roles → Add People → <b>Threads Tester</b>: thêm từng tài khoản Threads muốn kết nối, rồi
                trên mỗi tài khoản vào Threads → Cài đặt → Tài khoản → Quyền của trang web → Lời mời → Chấp nhận.
              </li>
              <li>Copy Threads app ID và Threads app secret (Use case Threads → Settings) vào ô ở trên, bấm Lưu.</li>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              App ở chế độ phát triển chỉ kết nối được tài khoản đã thêm làm Threads Tester — đủ cho các trang của chính
              cửa hàng, không cần Meta duyệt app.
            </Typography>
          </Card>
        </Stack>
      )}

      {confirmDialog}
    </Container>
  );
}
