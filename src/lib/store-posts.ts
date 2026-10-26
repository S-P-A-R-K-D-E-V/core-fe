import { fetchPublic } from './tenant-branding';

// ----------------------------------------------------------------------
// Tin tức của cửa hàng (core-be StorePostService): kiểu dữ liệu dùng chung cho trang công khai /tin-tuc và trang quản
// trị, cùng các hàm đọc bài đã đăng phía server (render sẵn HTML cho công cụ tìm kiếm).
// ----------------------------------------------------------------------

export type StorePostStatus = 'draft' | 'published';

export type StorePostListItem = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  coverUrl: string | null;
  tags: string[];
  status: StorePostStatus;
  publishedAt: string | null;
  updatedAt: string;
  authorName: string | null;
  viewCount: number;
  readingMinutes: number;
};

export type StorePostDetail = StorePostListItem & {
  contentHtml: string;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  createdAt: string;
};

export type StorePostPage = {
  items: StorePostListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type StorePostPublic = { post: StorePostDetail; related: StorePostListItem[] };

export const NEWS_PAGE_SIZE = 12;

/** Bài đã đăng (mới nhất trước) — trang /tin-tuc và mục "Tin tức mới" của trang chủ. Lỗi → danh sách rỗng. */
export async function getPublishedPosts({
  page = 1,
  pageSize = NEWS_PAGE_SIZE,
  q,
  tag,
}: { page?: number; pageSize?: number; q?: string; tag?: string } = {}): Promise<StorePostPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q) params.set('q', q);
  if (tag) params.set('tag', tag);
  const data = await fetchPublic<StorePostPage>(`/public/storefront/posts?${params}`);
  return data ?? { items: [], total: 0, page, pageSize };
}

/**
 * Một bài đã đăng theo slug, kèm bài liên quan — không đếm lượt xem (kết quả được cache 60 giây; lượt xem do trình
 * duyệt của người đọc báo riêng). Không có / chưa đăng → null.
 */
export async function getPublishedPost(slug: string): Promise<StorePostPublic | null> {
  if (!/^[a-z0-9-]{1,220}$/.test(slug)) return null;
  return fetchPublic<StorePostPublic>(`/public/storefront/posts/${slug}?view=false`);
}
