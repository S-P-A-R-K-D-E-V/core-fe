'use client';

import type { BoxProps } from '@mui/material/Box';
import type { StorePostListItem } from 'src/lib/store-posts';
import type { TenantBranding } from 'src/lib/tenant-branding';

import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import Iconify from 'src/components/iconify';
import { varFade, MotionViewport } from 'src/components/animate';

import { storeIndustry } from 'src/lib/store-industry';

import { SectionTitle } from './components/section-title';
import { NewsPostCard } from '../news/news-post-card';

// ----------------------------------------------------------------------

type Props = BoxProps & {
  posts: StorePostListItem[];
  branding?: TenantBranding | null;
};

/** "Tin tức mới" — 3 bài mới nhất đã đăng; cửa hàng chưa có bài thì không hiện. */
export default function HomeNews({ posts, branding, sx, ...other }: Props) {
  const { palette } = storeIndustry(branding);
  if (posts.length === 0) return null;

  return (
    <Box
      component="section"
      id="tin-tuc"
      sx={[{ py: { xs: 10, md: 15 } }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <Container component={MotionViewport}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'center', md: 'flex-end' }}
          justifyContent="space-between"
          spacing={3}
          sx={{ mb: { xs: 5, md: 8 } }}
        >
          <SectionTitle
            caption="Tin tức"
            title="Bài viết"
            txtGradient="mới nhất"
            gradientColors={palette.headline}
            sx={{
              textAlign: { xs: 'center', md: 'left' },
              alignItems: { xs: 'center', md: 'flex-start' },
            }}
          />
          <m.div variants={varFade({ distance: 24 }).inUp}>
            <Button
              component={RouterLink}
              href={paths.news.root}
              color="inherit"
              endIcon={<Iconify icon="eva:arrow-ios-forward-fill" />}
            >
              Xem tất cả
            </Button>
          </m.div>
        </Stack>

        <Box
          sx={{
            gap: 3,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(1, 1fr)',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
          }}
        >
          {posts.map((post) => (
            <m.div key={post.id} variants={varFade({ distance: 24 }).inUp}>
              <NewsPostCard
                post={post}
                logoUrl={branding?.logoUrl}
                storeName={branding?.storeName ?? ''}
              />
            </m.div>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
