'use client';

import type { StorePostStatus, StorePostListItem } from 'src/lib/store-posts';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useDebounce } from 'src/hooks/use-debounce';
import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { apiErrorMessage } from 'src/utils/api-error';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { useStorePosts, deleteStorePost } from 'src/api/store-posts';

import { formatPostDate } from 'src/sections/news/news-utils';

// ----------------------------------------------------------------------

type TabValue = StorePostStatus | 'all';

function PostRow({
  post,
  onDelete,
}: {
  post: StorePostListItem;
  onDelete: (post: StorePostListItem) => void;
}) {
  const popover = usePopover();
  const published = post.status === 'published';

  return (
    <Card sx={{ display: 'flex', alignItems: 'stretch' }}>
      <Box
        component={RouterLink}
        href={paths.dashboard.news.edit(post.id)}
        sx={{
          width: { xs: 96, sm: 180 },
          flexShrink: 0,
          bgcolor: 'background.neutral',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.disabled',
        }}
      >
        {post.coverUrl ? (
          <Box
            component="img"
            src={post.coverUrl}
            alt=""
            loading="lazy"
            sx={{ width: 1, height: 1, objectFit: 'cover' }}
          />
        ) : (
          <Iconify icon="solar:document-text-bold-duotone" width={40} />
        )}
      </Box>

      <Stack spacing={1} sx={{ p: { xs: 2, sm: 2.5 }, flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Label variant="soft" color={published ? 'success' : 'default'}>
            {published ? 'Đã đăng' : 'Nháp'}
          </Label>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {published ? formatPostDate(post.publishedAt) : `Sửa ${formatPostDate(post.updatedAt)}`}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton size="small" onClick={popover.onOpen} aria-label="Thao tác">
            <Iconify icon="eva:more-horizontal-fill" />
          </IconButton>
        </Stack>

        <Typography
          variant="subtitle1"
          component={RouterLink}
          href={paths.dashboard.news.edit(post.id)}
          sx={{
            color: 'inherit',
            textDecoration: 'none',
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {post.title}
        </Typography>
        {post.summary && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              display: { xs: 'none', sm: '-webkit-box' },
              overflow: 'hidden',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {post.summary}
          </Typography>
        )}
        <Stack
          direction="row"
          spacing={2}
          sx={{ typography: 'caption', color: 'text.disabled', mt: 'auto !important' }}
        >
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Iconify icon="solar:eye-bold" width={16} />
            {post.viewCount.toLocaleString('vi-VN')} lượt xem
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Iconify icon="solar:clock-circle-outline" width={16} />
            {post.readingMinutes} phút đọc
          </Stack>
        </Stack>
      </Stack>

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top">
        <MenuItem
          component={RouterLink}
          href={paths.dashboard.news.edit(post.id)}
          onClick={popover.onClose}
        >
          <Iconify icon="solar:pen-bold" />
          Sửa
        </MenuItem>
        {published && (
          <MenuItem
            component="a"
            href={paths.news.details(post.slug)}
            target="_blank"
            rel="noopener"
            onClick={popover.onClose}
          >
            <Iconify icon="solar:eye-bold" />
            Xem trên trang
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            popover.onClose();
            onDelete(post);
          }}
          sx={{ color: 'error.main' }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" />
          Xoá
        </MenuItem>
      </CustomPopover>
    </Card>
  );
}

/** /dashboard/tin-tuc — danh sách bài tin tức của cửa hàng. */
export function StoreNewsListView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [tab, setTab] = useState<TabValue>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search, 400);
  const { page: data, loading, refresh } = useStorePosts(tab, q, page);

  const tabs: {
    value: TabValue;
    label: string;
    count?: number;
    color: 'default' | 'success' | 'warning';
  }[] = [
    { value: 'all', label: 'Tất cả', count: data?.allCount, color: 'default' },
    { value: 'published', label: 'Đã đăng', count: data?.publishedCount, color: 'success' },
    { value: 'draft', label: 'Nháp', count: data?.draftCount, color: 'warning' },
  ];

  const handleDelete = async (post: StorePostListItem) => {
    const ok = await confirm({
      title: 'Xoá bài viết?',
      content: `"${post.title}" sẽ bị xoá hẳn${post.status === 'published' ? ' và gỡ khỏi trang của cửa hàng' : ''}.`,
      confirmText: 'Xoá',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteStorePost(post.id);
      enqueueSnackbar('Đã xoá bài viết');
      refresh();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Xoá thất bại'), { variant: 'error' });
    }
  };

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Tin tức"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Tin tức' }]}
        action={
          <Button
            component={RouterLink}
            href={paths.dashboard.news.new}
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
          >
            Viết bài mới
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Tabs
          value={tab}
          onChange={(_, v: TabValue) => {
            setTab(v);
            setPage(1);
          }}
        >
          {tabs.map((t) => (
            <Tab
              key={t.value}
              value={t.value}
              iconPosition="end"
              label={t.label}
              icon={
                <Label variant={t.value === tab ? 'filled' : 'soft'} color={t.color}>
                  {t.count ?? 0}
                </Label>
              }
            />
          ))}
        </Tabs>
        <TextField
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Tìm theo tiêu đề…"
          size="small"
          sx={{ width: { xs: 1, md: 280 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {!loading && data && data.items.length === 0 ? (
        <EmptyContent
          filled
          title={q ? 'Không có bài nào khớp' : 'Chưa có bài viết'}
          description={
            q ? undefined : 'Viết bài đầu tiên — có trợ lý AI gợi ý chủ đề và viết nháp.'
          }
          action={
            !q && (
              <Button
                component={RouterLink}
                href={paths.dashboard.news.new}
                variant="contained"
                sx={{ mt: 2 }}
              >
                Viết bài mới
              </Button>
            )
          }
          sx={{ py: 10 }}
        />
      ) : (
        <Box
          sx={{ gap: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
        >
          {(data?.items ?? []).map((post) => (
            <PostRow key={post.id} post={post} onDelete={handleDelete} />
          ))}
        </Box>
      )}

      {pageCount > 1 && (
        <Pagination
          page={page}
          count={pageCount}
          onChange={(_, p) => setPage(p)}
          sx={{ mt: 5, '& .MuiPagination-ul': { justifyContent: 'center' } }}
        />
      )}

      {confirmDialog}
    </Container>
  );
}
