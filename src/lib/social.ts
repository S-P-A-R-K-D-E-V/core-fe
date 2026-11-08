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

// ---------- Tổng quan (dashboard) ----------

export const SOCIAL_DASHBOARD_DAYS = [7, 30, 90] as const;
export type SocialDashboardDays = (typeof SOCIAL_DASHBOARD_DAYS)[number];

export type SocialDashboardTotals = {
  posts: number;
  views: number;
  interactions: number;
  /** null = chưa đọc được số liệu Threads của kênh nào. */
  clicks: number | null;
  orders: number;
  revenue: number;
};

/** Followers… clicks: số của cả tài khoản Threads (null = chưa đọc được); posts / postViews…: bài đăng từ đây. */
export type SocialDashboardChannel = {
  channelId: string;
  platform: string;
  username: string;
  avatarUrl: string | null;
  status: SocialChannelStatus;
  followers: number | null;
  profileViews: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  clicks: number | null;
  insightsError: string | null;
  posts: number;
  postViews: number;
  postInteractions: number;
  orders: number;
  revenue: number;
};

export type SocialDashboardDay = { date: string; posts: number; views: number; orders: number; revenue: number };

export type SocialDashboardPost = {
  postId: string;
  targetId: string;
  channelUsername: string;
  text: string;
  permalink: string | null;
  publishedAt: string | null;
  views: number | null;
  interactions: number;
  clicks: number | null;
  orders: number;
  revenue: number;
  insightsAt: string | null;
};

export type SocialDashboard = {
  from: string;
  to: string;
  days: number;
  totals: SocialDashboardTotals;
  channels: SocialDashboardChannel[];
  daily: SocialDashboardDay[];
  topPosts: SocialDashboardPost[];
};

/** Tỉ lệ tương tác trên lượt xem (%), null khi chưa có lượt xem. */
export function engagementRate(interactions: number, views: number | null): number | null {
  if (!views) return null;
  return Math.round((interactions / views) * 1000) / 10;
}

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
  /** Các sản phẩm bài giới thiệu (tối đa SOCIAL_MAX_PRODUCTS). */
  productIds: string[];
  status: SocialPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  /** Giờ đăng do hàng đợi tự chọn. */
  queued: boolean;
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

/** queue = vào hàng đợi, máy chủ chọn khung giờ trống kế tiếp. */
export type SocialPostMode = 'draft' | 'schedule' | 'queue' | 'now';

export type SocialPostInput = {
  text: string;
  imageUrls: string[];
  channelIds: string[];
  mode: SocialPostMode;
  /** ISO UTC — chỉ khi mode = schedule. */
  scheduledAt: string | null;
  productId: string | null;
  productIds: string[];
};

// ---------- Hàng đợi tự rải bài + lịch đăng ----------

/** slots: "HH:mm" giờ Việt Nam; days: 0 = Chủ nhật … 6 = Thứ bảy; nextSlots: ISO UTC các khung trống sắp tới. */
export type SocialQueue = { slots: string[]; days: number[]; isDefault: boolean; nextSlots: string[] };

export type SocialCalendarItem = {
  id: string;
  text: string;
  status: SocialPostStatus;
  /** ISO UTC — giờ đã đăng, hoặc giờ hẹn. */
  at: string;
  queued: boolean;
  imageUrl: string | null;
  imageCount: number;
  channels: string[];
  /** Còn đổi giờ / sửa được (đã hẹn, chưa bắt đầu đăng). */
  editable: boolean;
};

export type SocialCalendar = { from: string; to: string; items: SocialCalendarItem[]; freeSlots: string[] };

/** Thứ trong tuần theo thứ tự Việt Nam (T2 … CN), giá trị theo Date.getDay(). */
export const SOCIAL_WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
];

export const SOCIAL_QUEUE_MAX_SLOTS = 12;

/** "8:5" / "08:05" → "08:05"; sai dạng → null. */
export function normalizeSlot(value: string): string | null {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Thêm khung giờ, bỏ trùng, sắp tăng dần. */
export function addSlot(slots: string[], value: string): string[] {
  const slot = normalizeSlot(value);
  if (!slot) return slots;
  return Array.from(new Set([...slots, slot])).sort();
}

/** yyyy-MM-dd theo giờ máy (người dùng ở Việt Nam) — tham số from / to của lịch. */
export function toDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function socialCalendarKey(from: string, to: string) {
  return `/social/calendar?from=${from}&to=${to}`;
}

/** imageUrls: ảnh đầu của từng sản phẩm trước; productUrls: link đã gắn cuối bài (tối đa 3). */
export type SocialCaptionResult = { text: string; imageUrls: string[]; productUrl: string | null; productUrls: string[] };

/** Một bài giới thiệu tối đa 5 sản phẩm (Threads cho tối đa 5 link). */
export const SOCIAL_MAX_PRODUCTS = 5;

/** Studio ảnh (core-be SocialImageController) — dùng chung lõi AI ảnh với trang ảnh sản phẩm (src/lib/image-ai). */
export type {
  ImageAnalysis as SocialImageAnalysis,
  ImageCatalog as SocialImageCatalog,
  ImageResult as SocialImageResult,
} from './image-ai';

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
