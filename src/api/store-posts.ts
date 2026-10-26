import type { StorePostDetail, StorePostStatus, StorePostListItem } from 'src/lib/store-posts';

import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Tin tức của cửa hàng — trang quản trị /dashboard/tin-tuc (core-be StorePostsController, quyền posts.manage).
// ----------------------------------------------------------------------

export type StorePostAdminPage = {
  items: StorePostListItem[];
  total: number;
  page: number;
  pageSize: number;
  allCount: number;
  publishedCount: number;
  draftCount: number;
};

export type StorePostInput = {
  title: string;
  slug: string | null;
  summary: string | null;
  contentHtml: string;
  coverUrl: string | null;
  coverCredit: string | null;
  tags: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  publish: boolean;
};

export type StorePostAiStatus = { enabled: boolean; reason: string | null; actions: string[] };
export type StorePostIdea = { title: string; angle: string };
export type StorePostDraft = {
  title: string;
  summary: string;
  contentHtml: string;
  tags: string[];
  metaTitle: string;
  metaDescription: string;
};
export type StorePostSeo = {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  slug: string;
  summary: string;
};

const ROOT = '/store-posts';

export function storePostListKey(status: StorePostStatus | 'all', q: string, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: '12' });
  if (status !== 'all') params.set('status', status);
  if (q.trim()) params.set('q', q.trim());
  return `${ROOT}?${params}`;
}

export function useStorePosts(status: StorePostStatus | 'all', q: string, page: number) {
  const { data, isLoading, error, mutate } = useSWR<StorePostAdminPage>(
    storePostListKey(status, q, page),
    fetcher,
    {
      keepPreviousData: true,
    }
  );
  return useMemo(
    () => ({ page: data, loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

export function useStorePost(id: string | null) {
  const { data, isLoading, error } = useSWR<StorePostDetail>(id ? `${ROOT}/${id}` : null, fetcher, {
    revalidateOnFocus: false,
  });
  return { post: data, loading: isLoading, error };
}

export function useStorePostAi() {
  const { data } = useSWR<StorePostAiStatus>(`${ROOT}/ai`, fetcher, { revalidateOnFocus: false });
  return data;
}

export async function createStorePost(input: StorePostInput) {
  return (await axios.post<StorePostDetail>(ROOT, input)).data;
}

export async function updateStorePost(id: string, input: StorePostInput) {
  return (await axios.put<StorePostDetail>(`${ROOT}/${id}`, input)).data;
}

export async function deleteStorePost(id: string) {
  await axios.delete(`${ROOT}/${id}`);
}

/** Ảnh bìa / ảnh trong bài: xin URL rồi PUT thẳng lên R2 (không đi qua core-be); trả URL công khai của ảnh. */
export async function uploadStorePostImage(file: File): Promise<string> {
  const { data } = await axios.post<{ uploadUrl: string; publicUrl: string }>(`${ROOT}/images`, {
    fileName: file.name,
    contentType: file.type,
  });
  const res = await fetch(data.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!res.ok) throw new Error('Tải ảnh lên thất bại');
  return data.publicUrl;
}

// Lệnh AI (gợi ý chủ đề, viết nháp, viết lại, SEO, tạo ảnh) đi dạng stream — xem src/api/store-posts-stream.ts.

// ---------- Ảnh: tìm trên web (giấy phép dùng thương mại), nhập về kho của cửa hàng kèm dòng ghi nguồn ----------

export type StorePostImageCandidate = {
  provider: 'openverse' | 'pexels';
  id: string;
  thumbnailUrl: string;
  title: string | null;
  creator: string | null;
  sourceUrl: string | null;
  license: string | null;
  width: number | null;
  height: number | null;
};

/** Ảnh đã lưu trên R2 và dòng ghi nguồn (HTML đã lọc) — null với ảnh của chính cửa hàng. */
export type StorePostImage = { url: string; creditHtml: string | null };

export async function searchStorePostImages(q: string) {
  return (
    await axios.get<{ query: string; items: StorePostImageCandidate[]; providers: string[] }>(
      `${ROOT}/images/search`,
      { params: { q } }
    )
  ).data;
}

export async function importStorePostImage(provider: string, id: string) {
  return (await axios.post<StorePostImage>(`${ROOT}/images/import`, { provider, id })).data;
}
