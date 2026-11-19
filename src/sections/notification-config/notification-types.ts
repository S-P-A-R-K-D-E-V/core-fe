import type { LabelColor } from 'src/components/label/types';

import type { IZaloBotChat } from 'src/api/zalo-bot';

// ----------------------------------------------------------------------
// Loại cấu hình thông báo (NotificationConfig.Type ở core-be): nhãn ô chọn, nhãn trong bảng, gợi ý ô nhập.
// ----------------------------------------------------------------------

export type NotificationTypeMeta = {
  value: string;
  /** Nhãn trong ô chọn Loại. */
  label: string;
  /** Nhãn ngắn trong bảng danh sách. */
  listLabel: string;
  color: LabelColor;
  tokenPlaceholder: string;
  chatIdPlaceholder: string;
};

export const NOTIFICATION_TYPES: readonly NotificationTypeMeta[] = [
  {
    value: 'telegram',
    label: 'Telegram (nhóm thông báo)',
    listLabel: '🤖 Telegram',
    color: 'info',
    tokenPlaceholder: 'VD: 123456:ABC-DEF...',
    chatIdPlaceholder: 'VD: -1001234567890',
  },
  {
    value: 'telegram-report',
    label: 'Telegram – báo cáo riêng (doanh thu, báo cáo sáng)',
    listLabel: '🔒 Telegram báo cáo',
    color: 'warning',
    tokenPlaceholder: 'VD: 123456:ABC-DEF...',
    chatIdPlaceholder: 'VD: -1001234567890',
  },
  {
    value: 'zalo',
    label: 'Zalo OA',
    listLabel: '💬 Zalo',
    color: 'primary',
    tokenPlaceholder: 'Zalo OA Token',
    chatIdPlaceholder: 'Zalo User ID',
  },
  {
    value: 'zalo-bot',
    label: 'Zalo Bot – báo việc agent cần quyết',
    listLabel: '🔔 Zalo Bot – báo agent',
    color: 'success',
    tokenPlaceholder: 'VD: 123456789:abcXYZ…',
    chatIdPlaceholder: "Bấm 'Lấy chat id' sau khi nhắn bot",
  },
];

/** Loại lạ (dữ liệu cũ / loại mới chưa có ở web) → hiện đúng mã loại, màu mặc định. */
export function getNotificationTypeMeta(type: string | null | undefined): NotificationTypeMeta {
  const found = NOTIFICATION_TYPES.find((t) => t.value === type);
  if (found) return found;
  return {
    value: type ?? '',
    label: type || '—',
    listLabel: type || '—',
    color: 'default',
    tokenPlaceholder: '',
    chatIdPlaceholder: '',
  };
}

// ----------------------------------------------------------------------
// Zalo Bot: chọn người nhận từ danh sách "Lấy chat id".
// ----------------------------------------------------------------------

/** Mỗi chat một dòng (getUpdates có thể trả nhiều tin của cùng một người) — giữ tin mới nhất, theo thứ tự xuất hiện. */
export function uniqueZaloChats(chats: readonly IZaloBotChat[] | null | undefined): IZaloBotChat[] {
  const byId = new Map<string, IZaloBotChat>();
  (chats ?? []).forEach((chat) => {
    if (!chat?.chatId) return;
    const prev = byId.get(chat.chatId);
    byId.set(chat.chatId, {
      ...prev,
      ...chat,
      name: chat.name || prev?.name || null,
      text: chat.text ?? prev?.text ?? null,
    });
  });
  return [...byId.values()];
}

/** Bấm một chat: điền chat id; tên gợi nhớ chỉ điền khi đang trống. */
export function applyZaloChat(
  chat: IZaloBotChat,
  currentName: string
): { chatId: string; name: string } {
  const keepName = currentName.trim().length > 0;
  return { chatId: chat.chatId, name: keepName ? currentName : (chat.name ?? '').trim() };
}

export function zaloChatTypeLabel(chatType: string | null | undefined): string {
  switch ((chatType ?? '').toUpperCase()) {
    case 'PRIVATE':
      return 'Cá nhân';
    case 'GROUP':
      return 'Nhóm';
    case '':
      return '';
    default:
      return chatType ?? '';
  }
}
