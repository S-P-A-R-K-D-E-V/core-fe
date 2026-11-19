import { it, expect, describe } from 'vitest';

import { subscriptionSummary } from '../social';

// ----------------------------------------------------------------------
// Kênh kết nối: câu báo sau khi "Đăng ký lại nhận tin" của fanpage.

describe('subscriptionSummary', () => {
  it('đang nhận đủ → thành công, liệt kê trường', () => {
    expect(
      subscriptionSummary({ fields: ['messages', 'feed'], appWebhookError: null, subscribedAt: null, lastError: null })
    ).toEqual({ severity: 'success', message: 'Đang nhận: messages, feed' });
  });

  it('có trường nhưng app webhook lỗi → cảnh báo kèm lỗi', () => {
    const r = subscriptionSummary({
      fields: ['messages'],
      appWebhookError: 'App chưa cấu hình webhook',
      subscribedAt: '2026-11-19T08:00:00Z',
      lastError: null,
    });
    expect(r.severity).toBe('warning');
    expect(r.message).toBe('Đang nhận: messages. Lưu ý: App chưa cấu hình webhook');
  });

  it('không có trường nào → lỗi, ưu tiên appWebhookError rồi lastError', () => {
    expect(
      subscriptionSummary({ fields: [], appWebhookError: null, subscribedAt: null, lastError: 'Token thiếu quyền' })
    ).toEqual({ severity: 'error', message: 'Token thiếu quyền' });
    expect(subscriptionSummary({ fields: [], appWebhookError: null, subscribedAt: null, lastError: null }).severity).toBe(
      'error'
    );
  });
});
