'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { isEditable } from 'src/lib/social';
import { useSocialPost } from 'src/api/social';

import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { SocialPostForm } from './social-post-form';

// ----------------------------------------------------------------------

export function SocialPostEditView({ id }: { id: string | null }) {
  const settings = useSettingsContext();
  const { post, loading, error } = useSocialPost(id);
  const heading = id ? 'Sửa bài' : 'Soạn bài bán hàng';

  let body: React.ReactNode;
  if (id && loading) body = <Skeleton variant="rounded" height={420} />;
  else if (id && (error || !post))
    body = <EmptyContent filled title="Không tìm thấy bài" sx={{ py: 8 }} />;
  else if (post && !isEditable(post))
    body = (
      <Alert
        severity="info"
        action={
          <Button color="inherit" size="small" component={RouterLink} href={paths.dashboard.social.root}>
            Về danh sách
          </Button>
        }
      >
        Bài đã bắt đầu đăng — không sửa được nữa.
      </Alert>
    );
  else body = <SocialPostForm post={post ?? null} />;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'md'}>
      <CustomBreadcrumbs
        heading={heading}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Bán hàng online', href: paths.dashboard.social.root },
          { name: heading },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      {body}
    </Container>
  );
}
