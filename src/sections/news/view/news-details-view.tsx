'use client';

import type { TenantBranding } from 'src/lib/tenant-branding';
import type { StorePostPublic } from 'src/lib/store-posts';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import axios from 'src/utils/axios';

import MainLayout from 'src/layouts/main';

import Iconify from 'src/components/iconify';

import { formatPostDate } from '../news-utils';

import { NewsContent } from '../news-content';
import { NewsPostCard } from '../news-post-card';

// ----------------------------------------------------------------------

type Props = {
  branding: TenantBranding | null;
  data: StorePostPublic;
};

/** /tin-tuc/[slug] — bài render sẵn phía server; trình duyệt người đọc báo một lượt xem. */
export function NewsDetailsView({ branding, data }: Props) {
  const { post, related } = data;
  const storeName = branding?.storeName ?? '';
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(window.location.href);
    // Đếm lượt xem từ trình duyệt (bot không chạy JS không được đếm); lỗi bỏ qua.
    axios.get(`/public/storefront/posts/${post.slug}`).catch(() => undefined);
  }, [post.slug]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* trình duyệt chặn clipboard */
    }
  };

  const shareUrl = encodeURIComponent(url);

  return (
    <MainLayout hasPosts logoUrl={branding?.logoUrl} branding={branding}>
      {/* Ảnh bìa phủ đầu bài, tiêu đề chữ trắng trên lớp tối (kiểu trang chi tiết bài của template v6). */}
      <Box
        component="header"
        sx={{
          position: 'relative',
          minHeight: { xs: 360, md: 480 },
          display: 'flex',
          alignItems: 'flex-end',
          bgcolor: 'grey.900',
          color: 'common.white',
          overflow: 'hidden',
        }}
      >
        {post.coverUrl && (
          <Box
            component="img"
            src={post.coverUrl}
            alt=""
            sx={{ inset: 0, width: 1, height: 1, objectFit: 'cover', position: 'absolute' }}
          />
        )}
        <Box
          sx={{
            inset: 0,
            position: 'absolute',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.8) 100%)',
          }}
        />
        <Container sx={{ position: 'relative', pb: { xs: 4, md: 6 }, pt: 12 }}>
          <Breadcrumbs
            sx={{ mb: 2, color: 'rgba(255,255,255,0.72)', typography: 'body2' }}
            separator="›"
          >
            <Link component={RouterLink} href="/" color="inherit">
              Trang chủ
            </Link>
            <Link component={RouterLink} href={paths.news.root} color="inherit">
              Tin tức
            </Link>
          </Breadcrumbs>
          <Typography
            component="h1"
            variant="h2"
            sx={{ maxWidth: 880, mb: 3, typography: { xs: 'h3', md: 'h2' } }}
          >
            {post.title}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ typography: 'body2' }}>
            <Avatar
              src={branding?.logoUrl ?? undefined}
              alt={storeName}
              sx={{ width: 40, height: 40 }}
            >
              {storeName.charAt(0)}
            </Avatar>
            <Stack>
              <Typography variant="subtitle2" component="p">
                {post.authorName || storeName}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {formatPostDate(post.publishedAt)} · {post.readingMinutes} phút đọc
              </Typography>
            </Stack>
          </Stack>
        </Container>
        {post.coverUrl && post.coverCredit && (
          <Typography
            variant="caption"
            sx={{
              right: 16,
              bottom: 8,
              position: 'absolute',
              maxWidth: 'calc(100% - 32px)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              color: 'rgba(255,255,255,0.72)',
              '& a': { color: 'inherit' },
            }}
            // Nguồn ảnh bìa (ảnh lấy từ web) — HTML core-be đã lọc khi lưu bài.
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: post.coverCredit }}
          />
        )}
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        {post.summary && (
          <Typography
            variant="h6"
            component="p"
            sx={{ mb: 4, color: 'text.secondary', fontWeight: 500 }}
          >
            {post.summary}
          </Typography>
        )}

        <NewsContent html={post.contentHtml} />

        <Divider sx={{ my: 5, borderStyle: 'dashed' }} />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
        >
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {post.tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="soft"
                component={RouterLink}
                href={`${paths.news.root}?tag=${encodeURIComponent(tag)}`}
                clickable
              />
            ))}
          </Stack>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
              Chia sẻ
            </Typography>
            <IconButton
              aria-label="Chia sẻ lên Facebook"
              href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
              target="_blank"
              rel="noopener"
            >
              <Iconify icon="eva:facebook-fill" sx={{ color: '#1877F2' }} />
            </IconButton>
            <IconButton
              aria-label="Chia sẻ qua Zalo"
              href={`https://zalo.me/share?url=${shareUrl}`}
              target="_blank"
              rel="noopener"
            >
              <Iconify icon="simple-icons:zalo" sx={{ color: '#0068FF' }} />
            </IconButton>
            <Tooltip title={copied ? 'Đã chép link' : 'Chép link bài'}>
              <IconButton aria-label="Chép link bài" onClick={handleCopy}>
                <Iconify icon={copied ? 'eva:checkmark-fill' : 'solar:link-bold'} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Container>

      {related.length > 0 && (
        <Box sx={{ bgcolor: 'background.neutral', py: { xs: 6, md: 10 } }}>
          <Container>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 4 }}
            >
              <Typography variant="h4" component="h2">
                Bài viết khác
              </Typography>
              <Link
                component={RouterLink}
                href={paths.news.root}
                color="inherit"
                variant="subtitle2"
              >
                Xem tất cả →
              </Link>
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
              {related.map((item) => (
                <NewsPostCard
                  key={item.id}
                  post={item}
                  logoUrl={branding?.logoUrl}
                  storeName={storeName}
                />
              ))}
            </Box>
          </Container>
        </Box>
      )}
    </MainLayout>
  );
}
