'use client';

import type { TenantBranding } from 'src/lib/tenant-branding';
import type { ElementType } from 'react';
import type { StorePostPage } from 'src/lib/store-posts';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';
import PaginationItem from '@mui/material/PaginationItem';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import MainLayout from 'src/layouts/main';

import Iconify from 'src/components/iconify';
import EmptyContent from 'src/components/empty-content';

import { NewsPostCard } from '../news-post-card';

// ----------------------------------------------------------------------

type Props = {
  branding: TenantBranding | null;
  data: StorePostPage;
  q?: string;
  tag?: string;
};

function pageHref(page: number, q?: string, tag?: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tag) params.set('tag', tag);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `${paths.news.root}?${query}` : paths.news.root;
}

/** /tin-tuc — dữ liệu đọc sẵn phía server (app/tin-tuc/page.tsx); tìm kiếm / lọc thẻ / phân trang là link thường. */
export function NewsListView({ branding, data, q, tag }: Props) {
  const storeName = branding?.storeName ?? '';
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  // Bài mới nhất làm bài nổi bật ở trang đầu khi không tìm / lọc.
  const featured = data.page === 1 && !q && !tag ? data.items[0] : undefined;
  const rest = featured ? data.items.slice(1) : data.items;

  return (
    <MainLayout hasPosts logoUrl={branding?.logoUrl} branding={branding}>
      <Container sx={{ pt: { xs: 5, md: 8 }, pb: { xs: 8, md: 12 } }}>
        <Stack spacing={1} sx={{ mb: { xs: 3, md: 5 } }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            {storeName}
          </Typography>
          <Typography variant="h3" component="h1">
            Tin tức
          </Typography>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: { xs: 3, md: 5 } }}
        >
          {/* Form GET thường: tìm được cả khi trang chưa chạy JavaScript. */}
          <Box
            component="form"
            action={paths.news.root}
            method="get"
            sx={{ width: { xs: 1, sm: 320 } }}
          >
            {tag && <input type="hidden" name="tag" value={tag} />}
            <TextField
              fullWidth
              name="q"
              defaultValue={q ?? ''}
              placeholder="Tìm bài viết…"
              inputProps={{ 'aria-label': 'Tìm bài viết' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {tag && (
            // Cả thẻ là link bỏ lọc (nút xoá của Chip chặn click nên không dùng onDelete).
            <Chip
              label={`Thẻ: ${tag}`}
              component={RouterLink}
              href={pageHref(1, q)}
              clickable
              icon={<Iconify icon="solar:close-circle-bold" />}
              aria-label={`Bỏ lọc thẻ ${tag}`}
            />
          )}
        </Stack>

        {data.items.length === 0 ? (
          <EmptyContent
            filled
            title={q || tag ? 'Không có bài nào khớp' : 'Chưa có bài viết'}
            sx={{ py: 10 }}
          />
        ) : (
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
            {featured && (
              <Box sx={{ gridColumn: { sm: 'span 2' } }}>
                <NewsPostCard post={featured} featured headingComponent="h2" />
              </Box>
            )}
            {rest.map((post) => (
              <NewsPostCard
                key={post.id}
                post={post}
                logoUrl={branding?.logoUrl}
                storeName={storeName}
                headingComponent="h2"
              />
            ))}
          </Box>
        )}

        {pageCount > 1 && (
          <Pagination
            page={data.page}
            count={pageCount}
            sx={{ mt: { xs: 5, md: 8 }, '& .MuiPagination-ul': { justifyContent: 'center' } }}
            // Bỏ color / variant: kiểu mở rộng của theme (info, soft) cho Pagination và PaginationItem khác nhau.
            renderItem={({ color: _color, variant: _variant, ...item }) => (
              <PaginationItem
                // Link thật (công cụ tìm kiếm theo được các trang sau).
                component={RouterLink as ElementType}
                href={pageHref(item.page ?? 1, q, tag)}
                {...item}
              />
            )}
          />
        )}
      </Container>
    </MainLayout>
  );
}
