import type { InternalUser } from 'src/api/messenger';

import { apiErrorMessage } from './api-error';

// ----------------------------------------------------------------------
// Người gửi hệ thống + kênh "Cảnh báo hệ thống" của Messenger nội bộ (core-be: SystemUser, SystemConversations).
//
// Tin cảnh báo tự động do MỘT tài khoản hệ thống cố định gửi vào nhóm có systemKey của từng cửa hàng. Tài khoản
// đó không phải người để nhắn tin: không mở chat riêng, không thêm vào nhóm, không bao giờ online — nên phải
// hiện bằng tên + avatar riêng và bị loại khỏi mọi danh sách chọn người.
// ----------------------------------------------------------------------

/** Id cố định của tài khoản hệ thống (SystemUser.Id ở core-be) — senderId của mọi tin cảnh báo tự động. */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

export const SYSTEM_USER_NAME = 'Trợ lý hệ thống';

/** Avatar kiểu "bot" của người gửi hệ thống và avatar "chuông" của kênh cảnh báo (icon, không phải chữ cái đầu). */
export const SYSTEM_USER_ICON = 'mdi:robot';
export const SYSTEM_CHANNEL_ICON = 'solar:bell-bold';

/** core-be so id theo Guid nên hoa/thường đều là một. */
export function isSystemUserId(userId: string | null | undefined): boolean {
  return !!userId && userId.toLowerCase() === SYSTEM_USER_ID;
}

/** Mục danh bạ có isSystem = true (GET messenger/users), hoặc chính id hệ thống đã biết. */
export function isSystemUser(
  user: Pick<InternalUser, 'id' | 'isSystem'> | null | undefined
): boolean {
  return !!user && (user.isSystem === true || isSystemUserId(user.id));
}

/** Hội thoại do hệ thống quản lý (có systemKey, vd "admin-alerts" — kênh "Cảnh báo hệ thống"). */
export function isSystemConversation(
  conversation: { systemKey?: string | null } | null | undefined
): boolean {
  return !!conversation?.systemKey;
}

/** Bỏ người gửi hệ thống khỏi danh sách người để chọn (nhắn tin mới, thêm thành viên, đang online…). */
export function excludeSystemUsers<T extends Pick<InternalUser, 'id' | 'isSystem'>>(
  users: T[]
): T[] {
  return users.filter((user) => !isSystemUser(user));
}

export type MessengerIdentity = {
  /** Tên hiển thị: họ tên trong danh bạ; người gửi hệ thống luôn có tên; người lạ còn lại hiện id như trước. */
  name: string;
  avatarUrl: string | null;
  isSystem: boolean;
};

/**
 * Tên + avatar của một người trong messenger. `user` là mục danh bạ nếu đã có. Người gửi hệ thống vẫn ra đúng
 * tên khi danh bạ KHÔNG có mục của nó (người không phải Admin được thêm vào kênh, hoặc danh bạ chưa tải xong)
 * — không bao giờ hiện id trần.
 */
export function resolveMessengerUser(
  userId: string,
  user: InternalUser | null | undefined
): MessengerIdentity {
  if (isSystemUserId(userId) || user?.isSystem) {
    return { name: user?.fullName?.trim() || SYSTEM_USER_NAME, avatarUrl: null, isSystem: true };
  }

  return { name: user?.fullName ?? userId, avatarUrl: user?.avatarUrl ?? null, isSystem: false };
}

/** Nội dung của toast trong app / thông báo desktop khi có tin mới của người khác. */
export function incomingMessageNotice(
  message: { senderId: string; content?: string | null },
  userCache: Record<string, InternalUser>
): { senderName: string; preview: string; system: boolean } {
  const known = userCache[message.senderId];
  const sender = resolveMessengerUser(message.senderId, known);

  return {
    senderName: sender.isSystem ? sender.name : (known?.fullName ?? 'Tin nhắn mới'),
    preview: (message.content ?? '').slice(0, 80),
    system: sender.isSystem,
  };
}

/**
 * Lời báo lỗi của API messenger. Thao tác bị từ chối trả 400 { error, code } với `error` là câu tiếng Việt
 * (vd code "system_sender": không nhắn riêng / thêm / gỡ Trợ lý hệ thống; "not_store_member"). Interceptor của
 * axios reject bằng chính body đó.
 */
export function messengerErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err === 'string') return fallback;

  const { error } = err as { error?: unknown };
  if (typeof error === 'string' && error.trim()) return error;

  return apiErrorMessage(err, fallback);
}
