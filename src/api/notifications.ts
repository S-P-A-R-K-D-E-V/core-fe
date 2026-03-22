import axios, { endpoints } from 'src/utils/axios';

import type { NotificationCategory, INotificationListResponse } from 'src/types/notification';

// ----------------------------------------------------------------------

export async function getNotifications(params: {
  page?: number;
  pageSize?: number;
  category?: NotificationCategory;
  isRead?: boolean;
}): Promise<INotificationListResponse> {
  const res = await axios.get(endpoints.notifications.list, { params });
  return res.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await axios.get(endpoints.notifications.unreadCount);
  return res.data.count;
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await axios.put(endpoints.notifications.markAsRead(notificationId));
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await axios.put(endpoints.notifications.markAllAsRead);
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await axios.delete(endpoints.notifications.delete(notificationId));
}
