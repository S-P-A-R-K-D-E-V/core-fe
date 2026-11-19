import { describe, expect, it } from 'vitest';

import {
  applyZaloChat,
  uniqueZaloChats,
  zaloChatTypeLabel,
  NOTIFICATION_TYPES,
  getNotificationTypeMeta,
} from '../notification-types';

// ----------------------------------------------------------------------

describe('getNotificationTypeMeta', () => {
  it('có loại zalo-bot với nhãn, màu và gợi ý ô nhập riêng', () => {
    const meta = getNotificationTypeMeta('zalo-bot');
    expect(meta.label).toBe('Zalo Bot – báo việc agent cần quyết');
    expect(meta.listLabel).toContain('Zalo Bot');
    expect(meta.color).toBe('success');
    expect(meta.tokenPlaceholder).toBe('VD: 123456789:abcXYZ…');
    expect(meta.chatIdPlaceholder).toBe("Bấm 'Lấy chat id' sau khi nhắn bot");
  });

  it('giữ nhãn / màu của các loại cũ', () => {
    expect(getNotificationTypeMeta('telegram')).toMatchObject({
      listLabel: '🤖 Telegram',
      color: 'info',
    });
    expect(getNotificationTypeMeta('telegram-report')).toMatchObject({
      listLabel: '🔒 Telegram báo cáo',
      color: 'warning',
    });
    expect(getNotificationTypeMeta('zalo')).toMatchObject({
      listLabel: '💬 Zalo',
      color: 'primary',
    });
    expect(getNotificationTypeMeta('telegram').tokenPlaceholder).toBe('VD: 123456:ABC-DEF...');
  });

  it('loại lạ hiện đúng mã loại, màu mặc định', () => {
    expect(getNotificationTypeMeta('sms')).toMatchObject({ listLabel: 'sms', color: 'default' });
    expect(getNotificationTypeMeta(undefined).listLabel).toBe('—');
  });

  it('ô chọn Loại có đủ 4 loại, không trùng', () => {
    const values = NOTIFICATION_TYPES.map((t) => t.value);
    expect(values).toEqual(['telegram', 'telegram-report', 'zalo', 'zalo-bot']);
  });
});

describe('Zalo Bot — chọn chat', () => {
  it('gộp nhiều tin của cùng một chat, giữ tin mới nhất và tên đã biết', () => {
    const chats = uniqueZaloChats([
      { chatId: 'a', chatType: 'PRIVATE', name: 'Bình', text: 'chào' },
      { chatId: 'b', chatType: 'GROUP', name: 'Nhóm CiCi', text: 'hi' },
      { chatId: 'a', chatType: 'PRIVATE', name: '', text: 'lần 2' },
      { chatId: '', name: 'rác' },
    ]);
    expect(chats).toHaveLength(2);
    expect(chats[0]).toMatchObject({ chatId: 'a', name: 'Bình', text: 'lần 2' });
    expect(chats[1]).toMatchObject({ chatId: 'b', name: 'Nhóm CiCi' });
  });

  it('danh sách rỗng / null không lỗi', () => {
    expect(uniqueZaloChats(null)).toEqual([]);
    expect(uniqueZaloChats([])).toEqual([]);
  });

  it('bấm chat: điền chat id, tên chỉ điền khi đang trống', () => {
    const chat = { chatId: '9f1c', chatType: 'PRIVATE', name: ' Trà My ', text: 'ok' };
    expect(applyZaloChat(chat, '')).toEqual({ chatId: '9f1c', name: 'Trà My' });
    expect(applyZaloChat(chat, '   ')).toEqual({ chatId: '9f1c', name: 'Trà My' });
    expect(applyZaloChat(chat, 'Chị My')).toEqual({ chatId: '9f1c', name: 'Chị My' });
    expect(applyZaloChat({ chatId: 'x' }, '')).toEqual({ chatId: 'x', name: '' });
  });

  it('nhãn loại chat', () => {
    expect(zaloChatTypeLabel('PRIVATE')).toBe('Cá nhân');
    expect(zaloChatTypeLabel('group')).toBe('Nhóm');
    expect(zaloChatTypeLabel(null)).toBe('');
    expect(zaloChatTypeLabel('CHANNEL')).toBe('CHANNEL');
  });
});
