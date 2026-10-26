import type { StorePostListItem } from 'src/lib/store-posts';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import Iconify from 'src/components/iconify';

import { formatPostDate } from './news-utils';

// ----------------------------------------------------------------------

type Props = {
  post: StorePostListItem;
  /** Bài nổi bật đầu trang: ảnh phủ cả thẻ, chữ trắng trên lớp tối (kiểu danh sách bài của template v6). */
  featured?: boolean;
  logoUrl?: string | null;
  storeName?: string;
  /** Thẻ tiêu đề của bài: h2 ở trang /tin-tuc (ngay dưới h1), h3 trong mục của trang chủ (dưới h2 của mục). */
  headingComponent?: 'h2' | 'h3';
};

function Meta({ post, light }: { post: StorePostListItem; light?: boolean }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ typography: 'caption', color: light ? 'rgba(255,255,255,0.8)' : 'text.secondary' }}
    >
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Iconify icon="solar:clock-circle-outline" width={16} />
        {post.readingMinutes} phút đọc
      </Stack>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Iconify icon="solar:eye-bold" width={16} />
        {post.viewCount.toLocaleString('vi-VN')}
      </Stack>
    </Stack>
  );
}

/** Thẻ bài trong danh sách tin tức (trang /tin-tuc, mục "Tin tức mới" của trang chủ). */
export function NewsPostCard({
  post,
  featured,
  logoUrl,
  storeName,
  headingComponent = 'h3',
}: Props) {
  const href = paths.news.details(post.slug);
  const date = formatPostDate(post.publishedAt);

  if (featured) {
    return (
      <Card
        component={RouterLink}
        href={href}
        sx={{
          height: 1,
          minHeight: { xs: 320, md: 420 },
          display: 'flex',
          position: 'relative',
          textDecoration: 'none',
          color: 'common.white',
          bgcolor: 'grey.800',
          '&:hover img': { transform: 'scale(1.04)' },
        }}
      >
        {post.coverUrl && (
          <Box
            component="img"
            src={post.coverUrl}
            alt=""
            sx={{
              inset: 0,
              width: 1,
              height: 1,
              objectFit: 'cover',
              position: 'absolute',
              transition: 'transform 0.6s ease',
            }}
          />
        )}
        <Box
          sx={{
            inset: 0,
            position: 'absolute',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 20%, rgba(0,0,0,0.78) 100%)',
          }}
        />
        <Stack
          spacing={1.5}
          sx={{ position: 'relative', p: { xs: 3, md: 4 }, mt: 'auto', width: 1 }}
        >
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {date}
          </Typography>
          <Typography component={headingComponent} variant="h4" sx={{ lineHeight: 1.3 }}>
            {post.title}
          </Typography>
          {post.summary && (
            <Typography
              variant="body2"
              sx={{
                opacity: 0.85,
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {post.summary}
            </Typography>
          )}
          <Meta post={post} light />
        </Stack>
      </Card>
    );
  }

  return (
    <Card
      component={RouterLink}
      href={href}
      sx={{
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'inherit',
        transition: (theme) => theme.transitions.create(['transform', 'box-shadow']),
        '&:hover': { transform: 'translateY(-4px)', boxShadow: (theme) => theme.customShadows.z16 },
        '&:hover img': { transform: 'scale(1.05)' },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '4 / 3',
          overflow: 'hidden',
          bgcolor: 'background.neutral',
        }}
      >
        {post.coverUrl ? (
          <Box
            component="img"
            src={post.coverUrl}
            alt=""
            loading="lazy"
            sx={{ width: 1, height: 1, objectFit: 'cover', transition: 'transform 0.6s ease' }}
          />
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ height: 1, color: 'text.disabled' }}
          >
            <Iconify icon="solar:document-text-bold-duotone" width={56} />
          </Stack>
        )}
      </Box>

      {/* Logo cửa hàng gối lên mép ảnh (như ảnh tác giả của template). */}
      <Avatar
        src={logoUrl ?? undefined}
        alt={storeName ?? ''}
        sx={{
          width: 40,
          height: 40,
          ml: 3,
          mt: -2.5,
          border: (theme) => `3px solid ${theme.palette.background.paper}`,
        }}
      >
        {(storeName ?? '?').charAt(0)}
      </Avatar>

      <Stack spacing={1} sx={{ p: 3, pt: 1.5, flexGrow: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {date}
        </Typography>
        <Typography
          component={headingComponent}
          variant="subtitle1"
          sx={{
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {post.title}
        </Typography>
        {post.summary && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              display: '-webkit-box',
              overflow: 'hidden',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {post.summary}
          </Typography>
        )}
        <Box sx={{ mt: 'auto !important', pt: 1 }}>
          <Meta post={post} />
        </Box>
      </Stack>
    </Card>
  );
}
