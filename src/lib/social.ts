// ----------------------------------------------------------------------
// Bán hàng online (core-be /social): kênh mạng xã hội của cửa hàng (Threads) và bài đăng bán hàng.
// ----------------------------------------------------------------------

export type SocialChannelStatus = 'connected' | 'expired' | 'disconnected';

export type SocialChannel = {
  id: string;
  platform: 'threads' | string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: SocialChannelStatus;
  tokenExpiresAt: string | null;
  lastError: string | null;
  connectedAt: string;
};

export type SocialChannelList = { threadsConfigured: boolean; items: SocialChannel[] };

/** Meta app của cửa hàng (không bao giờ có secret). source: store = cửa hàng tự nhập, platform = app dự phòng, none. */
export type SocialAppSettings = {
  platform: 'threads' | string;
  clientId: string | null;
  hasSecret: boolean;
  source: 'store' | 'platform' | 'none';
  callbackUrl: string;
  updatedAt: string | null;
};

/** Threads app ID là dãy số (Use case Threads → Settings). */
export function isValidThreadsAppId(value: string) {
  return /^\d{5,64}$/.test(value.trim());
}

export type SocialPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed';
export type SocialTargetStatus = 'pending' | 'publishing' | 'published' | 'failed';

export type SocialPostTarget = {
  id: string;
  channelId: string;
  channelUsername: string;
  platform: string;
  status: SocialTargetStatus;
  permalink: string | null;
  lastError: string | null;
  attempts: number;
  publishedAt: string | null;
};

export type SocialPost = {
  id: string;
  text: string;
  imageUrls: string[];
  productId: string | null;
  status: SocialPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  targets: SocialPostTarget[];
};

export type SocialPostPage = {
  items: SocialPost[];
  total: number;
  page: number;
  pageSize: number;
  counts: Partial<Record<SocialPostStatus, number>>;
};

export type SocialPostMode = 'draft' | 'schedule' | 'now';

export type SocialPostInput = {
  text: string;
  imageUrls: string[];
  channelIds: string[];
  mode: SocialPostMode;
  /** ISO UTC — chỉ khi mode = schedule. */
  scheduledAt: string | null;
  productId: string | null;
};

export type SocialCaptionResult = { text: string; imageUrls: string[]; productUrl: string | null };

/** Studio ảnh (core-be SocialImageController): "product" = đổi nền / bối cảnh, "hair" = cài lên tóc. */
export type SocialImageStyle = { id: string; label: string; group: 'product' | 'hair'; hint: string };
export type SocialImageBackground = { id: string; label: string; color: string };
export type SocialImageCatalog = { items: SocialImageStyle[]; backgrounds: SocialImageBackground[]; maxNoteLength: number };
/** style "frame" = giữ nguyên ảnh gốc đặt lên nền màu (không qua AI). */
export type SocialImageResult = { url: string; sourceUrl: string; style: string; label: string };

/** Giới hạn của Threads (core-be kiểm lại). */
export const SOCIAL_TEXT_MAX = 500;
export const SOCIAL_MAX_IMAGES = 10;
export const SOCIAL_MAX_LINKS = 5;

export const SOCIAL_POST_STATUS: Record<
  SocialPostStatus,
  { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }
> = {
  draft: { label: 'Nháp', color: 'default' },
  scheduled: { label: 'Hẹn giờ', color: 'info' },
  publishing: { label: 'Đang đăng', color: 'warning' },
  published: { label: 'Đã đăng', color: 'success' },
  partial: { label: 'Đăng một phần', color: 'warning' },
  failed: { label: 'Lỗi', color: 'error' },
};

export const SOCIAL_TARGET_STATUS: Record<
  SocialTargetStatus,
  { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }
> = {
  pending: { label: 'Chờ đăng', color: 'info' },
  publishing: { label: 'Đang đăng', color: 'warning' },
  published: { label: 'Đã đăng', color: 'success' },
  failed: { label: 'Lỗi', color: 'error' },
};

/** Số link http(s) trong bài (Threads cho tối đa 5). */
export function countLinks(text: string): number {
  return (text.match(/https?:\/\//gi) ?? []).length;
}

/** Bài còn sửa được: nháp / hẹn giờ và chưa kênh nào bắt đầu đăng. */
export function isEditable(post: SocialPost): boolean {
  return (
    (post.status === 'draft' || post.status === 'scheduled') &&
    post.targets.every((t) => t.status === 'pending')
  );
}
