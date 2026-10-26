'use client';

import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

import { paths } from 'src/routes/paths';

import { useSettingsContext } from 'src/components/settings';
import EmptyContent from 'src/components/empty-content';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { useStorePost } from 'src/api/store-posts';

import { StoreNewsForm } from './store-news-form';

// ----------------------------------------------------------------------

/** /dashboard/tin-tuc/new và /dashboard/tin-tuc/[id]/edit — id null = bài mới. */
export function StoreNewsEditView({ id }: { id: string | null }) {
  const settings = useSettingsContext();
  const { post, loading, error } = useStorePost(id);
  const heading = id ? 'Sửa bài viết' : 'Viết bài mới';

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={heading}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Tin tức', href: paths.dashboard.news.root },
          { name: id ? (post?.title ?? '…') : 'Bài mới' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {id && loading && (
        <Stack spacing={3} sx={{ mx: 'auto', maxWidth: 720 }}>
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={480} />
        </Stack>
      )}
      {id && !loading && (error || !post) && (
        <EmptyContent filled title="Không tìm thấy bài viết" sx={{ py: 10 }} />
      )}
      {(!id || post) && <StoreNewsForm key={post?.id ?? 'new'} post={post} />}
    </Container>
  );
}
