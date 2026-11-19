// ----------------------------------------------------------------------
// In-App Notification Types
// ----------------------------------------------------------------------

export type NotificationCategory =
  | 'System'
  | 'Sync'
  | 'Attendance'
  | 'Shift'
  | 'Payroll'
  | 'Salary'
  /** Đội agent (core-be NotificationCategory.Agent): chỉ chuông + realtime, không push. */
  | 'Agent'
  /** Hộp thư khách (core-be NotificationCategory.Conversation): tin khách chờ người — có push; actionUrl /dashboard/inbox?c={id}. */
  | 'Conversation';

export interface INotification {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  actionUrl?: string;
  data?: string;
  isRead: boolean;
  readAt?: string;
  createdByName?: string;
  createdAt: string;
}

export interface INotificationListResponse {
  items: INotification[];
  totalCount: number;
  page: number;
  pageSize: number;
  unreadCount: number;
}

export interface IUnreadCountResponse {
  count: number;
}
