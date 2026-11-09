import type {
  SocialPost,
  SocialPostPage,
  SocialPostInput,
  SocialChannelList,
  SocialAppSettings,
  SocialDashboard,
  SocialQueue,
  SocialCalendar,
  SocialImageResult,
  SocialCaptionResult,
  SocialImageCatalog,
} from 'src/lib/social';

import { socialCalendarKey } from 'src/lib/social';

import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Bán hàng online (core-be SocialController, /social/*).

const ROOT = '/social';

export function socialPostListKey(status: string, page: number) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return `${ROOT}/posts${query ? `?${query}` : ''}`;
}

export function useSocialChannels() {
  const { data, isLoading, error, mutate } = useSWR<SocialChannelList>(`${ROOT}/channels`, fetcher, {
    revalidateOnFocus: true,
  });
  return useMemo(
    () => ({
      channels: data?.items ?? [],
      threadsConfigured: data?.threadsConfigured ?? false,
      loading: isLoading && !data,
      error,
      refresh: mutate,
    }),
    [data, isLoading, error, mutate]
  );
}

/** Danh sách bài; tự làm mới mỗi 15 giây khi còn bài đang đăng / hẹn giờ sắp tới. */
export function useSocialPosts(status: string, page: number) {
  const { data, isLoading, error, mutate } = useSWR<SocialPostPage>(socialPostListKey(status, page), fetcher, {
    keepPreviousData: true,
    refreshInterval: (latest) =>
      latest?.items.some((p) => p.status === 'publishing' || p.status === 'scheduled') ? 15000 : 0,
  });
  return useMemo(
    () => ({ page: data, loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

export function useSocialPost(id: string | null) {
  const { data, isLoading, error, mutate } = useSWR<SocialPost>(id ? `${ROOT}/posts/${id}` : null, fetcher, {
    revalidateOnFocus: false,
  });
  return useMemo(
    () => ({ post: data, loading: !!id && isLoading && !data, error, refresh: mutate }),
    [data, id, isLoading, error, mutate]
  );
}

/** Bắt đầu kết nối Threads → URL màn đồng ý của Threads (trình duyệt chuyển sang đó). */
export async function startThreadsConnect(returnPath: string): Promise<string> {
  const res = await axios.post<{ authorizeUrl: string }>(`${ROOT}/channels/threads/connect`, { returnPath });
  return res.data.authorizeUrl;
}

export function useSocialDashboard(days: number) {
  const { data, isLoading, error, mutate } = useSWR<SocialDashboard>(`${ROOT}/dashboard?days=${days}`, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
  return useMemo(
    () => ({ dashboard: data, loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

export function useSocialQueue() {
  const { data, isLoading, error, mutate } = useSWR<SocialQueue>(`${ROOT}/queue`, fetcher, { revalidateOnFocus: true });
  return useMemo(() => ({ queue: data, loading: isLoading && !data, error, refresh: mutate }), [data, isLoading, error, mutate]);
}

export async function saveSocialQueue(input: { slots: string[]; days: number[] }) {
  return (await axios.put<SocialQueue>(`${ROOT}/queue`, input)).data;
}

/** Lịch đăng trong khoảng ngày (yyyy-MM-dd); null = chưa biết khoảng (lịch chưa vẽ). */
export function useSocialCalendar(from: string | null, to: string | null) {
  const { data, isLoading, error, mutate } = useSWR<SocialCalendar>(
    from && to ? socialCalendarKey(from, to) : null,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: true }
  );
  return useMemo(
    () => ({ calendar: data, loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

/** Đổi giờ bài đã hẹn (kéo thả trên lịch). */
export async function rescheduleSocialPost(id: string, scheduledAt: string) {
  return (await axios.post<SocialPost>(`${ROOT}/posts/${id}/schedule`, { scheduledAt })).data;
}

export function useThreadsApp() {
  const { data, isLoading, error, mutate } = useSWR<SocialAppSettings>(`${ROOT}/apps/threads`, fetcher, {
    revalidateOnFocus: false,
  });
  return useMemo(
    () => ({ app: data, loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

/** Lưu Threads app ID / secret của cửa hàng; secret để trống = giữ secret cũ (chỉ khi không đổi app ID). */
export async function saveThreadsApp(input: { clientId: string; clientSecret: string | null }) {
  return (await axios.put<SocialAppSettings>(`${ROOT}/apps/threads`, input)).data;
}

export async function deleteThreadsApp() {
  await axios.delete(`${ROOT}/apps/threads`);
}

export async function disconnectSocialChannel(id: string) {
  await axios.delete(`${ROOT}/channels/${id}`);
}

export async function createSocialPost(input: SocialPostInput) {
  return (await axios.post<SocialPost>(`${ROOT}/posts`, input)).data;
}

export async function updateSocialPost(id: string, input: SocialPostInput) {
  return (await axios.put<SocialPost>(`${ROOT}/posts/${id}`, input)).data;
}

export async function deleteSocialPost(id: string) {
  await axios.delete(`${ROOT}/posts/${id}`);
}

export async function retrySocialPost(id: string) {
  return (await axios.post<SocialPost>(`${ROOT}/posts/${id}/retry`)).data;
}

/** Ảnh bài đăng: xin URL ký sẵn rồi PUT thẳng lên R2 công khai (Threads tự tải ảnh về khi đăng). JPEG / PNG. */
export async function uploadSocialImage(file: File): Promise<string> {
  const { data } = await axios.post<{ uploadUrl: string; publicUrl: string }>(`${ROOT}/posts/images`, {
    fileName: file.name,
    contentType: file.type,
  });
  const res = await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!res.ok) throw new Error('Tải ảnh lên thất bại');
  return data.publicUrl;
}

export function useSocialAi() {
  const { data } = useSWR<{ enabled: boolean; reason: string | null }>(`${ROOT}/posts/ai`, fetcher, {
    revalidateOnFocus: false,
  });
  return data;
}

export async function writeSocialCaption(input: { productIds: string[]; brief: string; includeLink?: boolean }) {
  return (await axios.post<SocialCaptionResult>(`${ROOT}/posts/ai/caption`, input, { timeout: 120000 })).data;
}

// ---------- Studio ảnh: tạo ảnh mới từ ảnh sản phẩm có sẵn ----------

export function useSocialImageCatalog() {
  const { data } = useSWR<SocialImageCatalog>(`${ROOT}/posts/ai/images/styles`, fetcher, { revalidateOnFocus: false });
  return data;
}

/** AI vẽ lại từ ảnh gốc (ảnh gốc gửi kèm cho model) — 10–40 giây. */
export async function generateSocialImage(input: {
  sourceUrl: string;
  style: string;
  productId: string | null;
  note?: string;
}) {
  return (await axios.post<SocialImageResult>(`${ROOT}/posts/ai/images`, input, { timeout: 180000 })).data;
}

/** Giữ nguyên ảnh gốc, đặt lên nền màu (không qua AI). */
export async function frameSocialImage(input: {
  sourceUrl: string;
  productId: string | null;
  background: string;
  aspect: 'square' | 'portrait';
}) {
  return (await axios.post<SocialImageResult>(`${ROOT}/posts/ai/images/frame`, input, { timeout: 60000 })).data;
}
