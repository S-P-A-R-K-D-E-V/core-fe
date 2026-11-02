// ----------------------------------------------------------------------
// Popup thông báo — Core-be /announcements.
// ----------------------------------------------------------------------

export type AnnouncementSeverity = 'Info' | 'Warn' | 'Critical';

export type AnnouncementAudience = 'All' | 'Role' | 'Users';

/** Phần nhân viên thấy trong popup. */
export type IPendingAnnouncement = {
  id: string;
  title: string;
  bodyMarkdown: string;
  severity: AnnouncementSeverity;
  requireAck: boolean;
  startAt: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export type IAnnouncement = {
  id: string;
  title: string;
  bodyMarkdown: string;
  severity: AnnouncementSeverity;
  audience: AnnouncementAudience;
  roles: string[];
  userIds: string[];
  requireAck: boolean;
  startAt: string;
  endAt: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  createdAt: string;
  createdByName: string | null;
  isActive: boolean;
  recipients: number;
  seenCount: number;
  ackCount: number;
};

export type ISaveAnnouncement = {
  title: string;
  bodyMarkdown: string;
  severity: AnnouncementSeverity;
  audience: AnnouncementAudience;
  roles: string[];
  userIds: string[];
  requireAck: boolean;
  /** ISO; null = hiện ngay. */
  startAt: string | null;
  endAt: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

/** Kết quả lưu. devices là số thiết bị đã đăng ký, không chứng minh máy đã hiện thông báo. */
export type IAnnouncementSaved = {
  announcement: IAnnouncement;
  recipients: number;
  devices: number;
  pushed: boolean;
};

export type IAnnouncementStaff = {
  userId: string;
  name: string;
  roles: string[];
};

export type IAnnouncementRecipient = {
  userId: string;
  name: string;
  seenAt: string | null;
  ackAt: string | null;
};

export type IAnnouncementReceipts = {
  id: string;
  title: string;
  requireAck: boolean;
  recipients: number;
  seenCount: number;
  ackCount: number;
  people: IAnnouncementRecipient[];
};

export const ANNOUNCEMENT_SEVERITY_LABEL: Record<AnnouncementSeverity, string> = {
  Info: 'Thông tin',
  Warn: 'Lưu ý',
  Critical: 'Khẩn',
};

export const ANNOUNCEMENT_AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  All: 'Cả cửa hàng',
  Role: 'Theo vai trò',
  Users: 'Chọn từng người',
};

/** Vai trò chọn được làm người nhận, trùng Core-be AnnouncementRules.StoreRoles. */
export const ANNOUNCEMENT_ROLE_LABEL: Record<string, string> = {
  Admin: 'Chủ cửa hàng',
  Manager: 'Quản lý',
  Staff: 'Nhân viên',
};
