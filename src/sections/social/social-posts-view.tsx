'use client';

import type { SocialPost, SocialPostStatus } from 'src/lib/social';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { isEditable, SOCIAL_POST_STATUS, SOCIAL_TARGET_STATUS } from 'src/lib/social';
import { useSocialPosts, deleteSocialPost, retrySocialPost, useSocialChannels } from 'src/api/social';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------
// Bài đăng bán hàng: lọc theo trạng thái, xem bài trên từng kênh (link bài / lỗi), sửa bài chưa đăng, đăng lại kênh lỗi.

const TABS: { value: 'all' | SocialPostStatus; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'scheduled', label: 'Hẹn giờ' },
  { value: 'published', label: 'Đã đăng' },
  { value: 'failed', label: 'Lỗi' },
  { value: 'draft', label: 'Nháp' },
];

export function SocialPostsView() {
  const settings = useSettingsContext();
  const [status, setStatus] = useState<'all' | SocialPostStatus>('all');
  const [page, setPage] = useState(1);
  const { page: data, loading, error, refresh } = useSocialPosts(status, page);
  const { channels, loading: channelsLoading } = useSocialChannels();

  const counts = data?.counts ?? {};
  const totalAll = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Bài đăng bán hàng"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Bán hàng online' }]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.social.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            Soạn bài
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {!channelsLoading && channels.length === 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" component={RouterLink} href={paths.dashboard.social.channels}>
              Kết nối kênh
            </Button>
          }
        >
          Chưa có kênh nào được kết nối — bài chỉ lưu nháp được cho tới khi kết nối Threads.
        </Alert>
      )}

      <Tabs
        value={status}
        onChange={(_, v) => {
          setStatus(v);
          setPage(1);
        }}
        sx={{ mb: 3 }}
      >
        {TABS.map((tab) => {
          const count =
            tab.value === 'all'
              ? totalAll
              : tab.value === 'failed'
                ? (counts.failed ?? 0) + (counts.partial ?? 0)
                : (counts[tab.value] ?? 0);
          return (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              iconPosition="end"
              icon={
                <Label variant={tab.value === status ? 'filled' : 'soft'} color={tab.value === 'failed' && count ? 'error' : 'default'}>
                  {count}
                </Label>
              }
            />
          );
        })}
      </Tabs>

      {error && <Alert severity="error">{apiErrorMessage(error, 'Không tải được bài đăng')}</Alert>}

      {loading && (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={160} />
          <Skeleton variant="rounded" height={160} />
        </Stack>
      )}

      {!loading && !error && data?.items.length === 0 && (
        <EmptyContent
          filled
          title="Chưa có bài nào"
          description="Soạn bài bán hàng (AI viết giúp từ sản phẩm), chọn kênh rồi đăng ngay hoặc hẹn giờ."
          sx={{ py: 8 }}
        />
      )}

      <Stack spacing={2}>
        {data?.items.map((post) => (
          <SocialPostCard key={post.id} post={post} onChanged={() => refresh()} />
        ))}
      </Stack>

      {pageCount > 1 && (
        <Pagination page={page} count={pageCount} onChange={(_, p) => setPage(p)} sx={{ mt: 4, mx: 'auto', display: 'flex', justifyContent: 'center' }} />
      )}
    </Container>
  );
}

// ----------------------------------------------------------------------

function SocialPostCard({ post, onChanged }: { post: SocialPost; onChanged: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const popover = usePopover();
  const status = SOCIAL_POST_STATUS[post.status];
  const editable = isEditable(post);
  const hasFailed = post.targets.some((t) => t.status === 'failed');

  const when =
    post.status === 'draft'
      ? `Nháp · sửa ${fDateTime(post.updatedAt)}`
      : post.publishedAt
        ? `Đăng ${fDateTime(post.publishedAt)}`
        : post.scheduledAt
          ? `Hẹn ${fDateTime(post.scheduledAt)}`
          : '';

  const handleDelete = async () => {
    popover.onClose();
    const ok = await confirm({
      title: 'Xoá bài khỏi danh sách?',
      content:
        post.targets.some((t) => t.status === 'published')
          ? 'Bài đã đăng trên Threads vẫn còn — muốn gỡ thì xoá trên Threads.'
          : 'Bài chưa đăng sẽ bị huỷ.',
      confirmText: 'Xoá',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteSocialPost(post.id);
      enqueueSnackbar('Đã xoá bài');
      onChanged();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Xoá thất bại'), { variant: 'error' });
    }
  };

  const handleRetry = async () => {
    try {
      await retrySocialPost(post.id);
      enqueueSnackbar('Đang đăng lại các kênh lỗi');
      onChanged();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Chưa đăng lại được'), { variant: 'error' });
    }
  };

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Label color={status.color}>{status.label}</Label>
        <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
          {when}
          {post.createdByName ? ` · ${post.createdByName}` : ''}
        </Typography>
        {hasFailed && (
          <Button size="small" color="warning" startIcon={<Iconify icon="solar:restart-bold" />} onClick={handleRetry}>
            Đăng lại
          </Button>
        )}
        {editable && (
          <Button
            size="small"
            component={RouterLink}
            href={paths.dashboard.social.edit(post.id)}
            startIcon={<Iconify icon="solar:pen-bold" />}
          >
            Sửa
          </Button>
        )}
        <IconButton size="small" onClick={popover.onOpen} aria-label="Thêm">
          <Iconify icon="eva:more-horizontal-fill" />
        </IconButton>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {post.imageUrls.length > 0 && (
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Box
              component="img"
              src={post.imageUrls[0]}
              alt=""
              sx={{ width: { xs: '100%', sm: 120 }, height: 120, objectFit: 'cover', borderRadius: 1 }}
            />
            {post.imageUrls.length > 1 && (
              <Label sx={{ position: 'absolute', right: 6, bottom: 6 }} variant="filled">
                +{post.imageUrls.length - 1}
              </Label>
            )}
          </Box>
        )}
        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word', flex: 1 }}>
          {post.text || <em>(chỉ có ảnh)</em>}
        </Typography>
      </Stack>

      {post.targets.length > 0 && (
        <>
          <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
          <Stack spacing={1}>
            {post.targets.map((t) => {
              const ts = SOCIAL_TARGET_STATUS[t.status];
              return (
                <Stack key={t.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Iconify icon="ri:threads-fill" width={16} />
                  <Typography variant="body2">@{t.channelUsername}</Typography>
                  <Label color={ts.color} variant="soft">
                    {ts.label}
                  </Label>
                  {t.permalink && (
                    <Link href={t.permalink} target="_blank" rel="noopener noreferrer" variant="body2">
                      Xem bài
                    </Link>
                  )}
                  {t.lastError && (
                    <Typography variant="caption" sx={{ color: t.status === 'failed' ? 'error.main' : 'warning.main' }}>
                      {t.lastError}
                    </Typography>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </>
      )}

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 160 }}>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:trash-bin-trash-bold" />
          Xoá
        </MenuItem>
      </CustomPopover>
      {confirmDialog}
    </Card>
  );
}
