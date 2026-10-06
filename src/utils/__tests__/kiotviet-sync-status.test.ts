import { it, expect, describe } from 'vitest';

import {
  isFromKiotViet,
  kiotVietRetryError,
  kiotVietSyncDisplay,
  canRetryKiotVietPush,
  salesOrderCreatedMessage,
} from '../kiotviet-sync-status';

// ----------------------------------------------------------------------
// Nhãn cột KiotViet của hoá đơn + lời báo sau khi bán + lời từ chối đẩy lại. Dữ liệu mẫu đúng dạng core-be trả:
// GET sales-orders (SalesOrderResponse), POST sales-orders ({ id, kiotVietSyncStatus }) và thân từ chối của
// POST kiotviet/push/sales-orders/{id}/retry ({ message, code, title, errorCodes }).
// ----------------------------------------------------------------------

// Hoá đơn kéo về từ KiotViet: số hoá đơn của KiotViet, chưa từng đẩy
const PULLED = { orderNumber: 'HD012345', kiotVietSyncStatus: 'None', kiotVietSyncAttempts: 0 };
// Hoá đơn tạo trong hệ thống: số do core-be sinh (HD-yyyyMMdd-0001)
const SYSTEM_NUMBER = 'HD-20261006-0001';

describe('kiotVietSyncDisplay', () => {
  it('NotPushed là trạng thái bình thường: nhãn trung tính, không màu lỗi/cảnh báo', () => {
    const display = kiotVietSyncDisplay({
      orderNumber: SYSTEM_NUMBER,
      kiotVietSyncStatus: 'NotPushed',
      // Dòng do sweeper chuyển từ Failed giữ nguyên số lần đã đẩy
      kiotVietSyncAttempts: 3,
    });

    expect(display.label).toBe('Không đẩy KiotViet');
    expect(display.color).toBe('default');
    expect(display.hint).toBe('Hoá đơn chỉ lưu trong hệ thống, không gửi sang KiotViet');
  });

  it('giữ nhãn và màu của các trạng thái đẩy đã có', () => {
    const of = (kiotVietSyncStatus: string) => {
      const { label, color } = kiotVietSyncDisplay({
        orderNumber: SYSTEM_NUMBER,
        kiotVietSyncStatus,
      });
      return [label, color];
    };

    expect(of('Pending')).toEqual(['Chờ đồng bộ', 'warning']);
    expect(of('Pushing')).toEqual(['Đang đồng bộ', 'info']);
    expect(of('Synced')).toEqual(['Đã đồng bộ', 'success']);
    expect(of('Failed')).toEqual(['Lỗi đồng bộ', 'error']);
  });

  it('chú thích: lỗi đẩy chỉ hiện ở Failed, mã đơn KiotViet ở Synced', () => {
    expect(
      kiotVietSyncDisplay({
        kiotVietSyncStatus: 'Failed',
        kiotVietSyncError: 'Sản phẩm chưa liên kết',
      }).hint
    ).toBe('Sản phẩm chưa liên kết');
    expect(
      kiotVietSyncDisplay({ kiotVietSyncStatus: 'Synced', kiotVietOrderCode: 'DH005001' }).hint
    ).toBe('Mã đơn KiotViet: DH005001');
    expect(kiotVietSyncDisplay({ kiotVietSyncStatus: 'Pending' }).hint).toBe('');
  });

  it('trạng thái lạ (core-be mới hơn) hiện trung tính, không bao giờ thành lỗi', () => {
    const display = kiotVietSyncDisplay({
      orderNumber: SYSTEM_NUMBER,
      kiotVietSyncStatus: 'Queued',
    });

    expect(display).toEqual({ label: 'Queued', color: 'default', hint: '' });
  });

  it('"Từ KiotViet" chỉ dành cho hoá đơn None không có dấu vết tạo trong hệ thống', () => {
    expect(kiotVietSyncDisplay(PULLED)).toEqual({
      label: 'Từ KiotViet',
      color: 'default',
      hint: '',
    });
    // Core-be cũ không trả trạng thái → coi như None
    expect(kiotVietSyncDisplay({ orderNumber: 'HD012345' }).label).toBe('Từ KiotViet');
  });

  it('hoá đơn tạo trong hệ thống bị huỷ lúc Pending/Failed (về None) KHÔNG mang nhãn "Từ KiotViet"', () => {
    // Huỷ lúc Pending: chưa đẩy lần nào, chỉ còn số hoá đơn của hệ thống làm dấu vết
    const cancelledPending = kiotVietSyncDisplay({
      orderNumber: SYSTEM_NUMBER,
      kiotVietSyncStatus: 'None',
      kiotVietSyncAttempts: 0,
    });
    // Huỷ lúc Failed: còn số lần đẩy + lỗi đẩy; lỗi cũ không hiện lại trên nhãn trung tính
    const cancelledFailed = kiotVietSyncDisplay({
      orderNumber: SYSTEM_NUMBER,
      kiotVietSyncStatus: 'None',
      kiotVietSyncAttempts: 2,
      kiotVietSyncError: 'Sản phẩm chưa liên kết',
    });

    expect(cancelledPending.label).toBe('Không đẩy KiotViet');
    expect(cancelledPending.color).toBe('default');
    expect(cancelledFailed.label).toBe('Không đẩy KiotViet');
    expect(cancelledFailed.hint).not.toContain('Sản phẩm chưa liên kết');
  });
});

describe('isFromKiotViet', () => {
  it('core-be trả kiotVietId: có id là từ KiotViet, id null là hoá đơn của hệ thống — không suy đoán theo số hoá đơn', () => {
    // Số hoá đơn giống của hệ thống nhưng có id KiotViet → vẫn là hoá đơn kéo về
    expect(isFromKiotViet({ orderNumber: SYSTEM_NUMBER, kiotVietId: 123 })).toBe(true);
    // Hoá đơn cửa hàng mẫu: None, số kiểu khác, không có id KiotViet → không phải từ KiotViet
    expect(isFromKiotViet({ orderNumber: 'HD261006001', kiotVietId: null })).toBe(false);
    expect(kiotVietSyncDisplay({ orderNumber: 'HD261006001', kiotVietId: null }).label).toBe(
      'Không đẩy KiotViet'
    );
    // Trạng thái khác None không bao giờ là hoá đơn kéo về, kể cả khi có id (đã đẩy lên)
    expect(isFromKiotViet({ kiotVietSyncStatus: 'Synced', kiotVietId: 123 })).toBe(false);
  });

  it('None + số hoá đơn KiotViet + chưa từng đẩy → kéo về từ KiotViet', () => {
    expect(isFromKiotViet(PULLED)).toBe(true);
    // Số hoá đơn KiotViet của bản đã sửa (đuôi .01)
    expect(isFromKiotViet({ ...PULLED, orderNumber: 'HD012345.01' })).toBe(true);
  });

  it('từng dấu vết của hoá đơn tạo trong hệ thống đều đủ để loại', () => {
    expect(isFromKiotViet({ ...PULLED, orderNumber: SYSTEM_NUMBER })).toBe(false);
    expect(isFromKiotViet({ ...PULLED, kiotVietSyncAttempts: 1 })).toBe(false);
    expect(isFromKiotViet({ ...PULLED, kiotVietSyncError: 'timeout' })).toBe(false);
  });

  it('trạng thái khác None luôn là hoá đơn tạo trong hệ thống', () => {
    ['Pending', 'Pushing', 'Synced', 'Failed', 'NotPushed', 'Queued'].forEach((status) => {
      expect(isFromKiotViet({ orderNumber: 'HD012345', kiotVietSyncStatus: status })).toBe(false);
    });
  });
});

describe('canRetryKiotVietPush', () => {
  it('chỉ Failed có nút đẩy lại — NotPushed, Pending và trạng thái lạ thì không', () => {
    expect(canRetryKiotVietPush('Failed')).toBe(true);

    ['NotPushed', 'Pending', 'Pushing', 'Synced', 'None', 'Queued', '', undefined, null].forEach(
      (status) => expect(canRetryKiotVietPush(status)).toBe(false)
    );
  });
});

describe('salesOrderCreatedMessage', () => {
  it('chỉ nhắc đồng bộ KiotViet khi hoá đơn được xếp hàng đẩy (Pending)', () => {
    expect(salesOrderCreatedMessage('Pending')).toBe('Đã tạo đơn — đang đồng bộ KiotViet');
  });

  it('NotPushed, core-be cũ (không trả trạng thái) hay trạng thái lạ: chỉ "Đã tạo đơn"', () => {
    ['NotPushed', 'None', 'Queued', '', undefined, null].forEach((status) => {
      expect(salesOrderCreatedMessage(status)).toBe('Đã tạo đơn');
    });
  });
});

describe('kiotVietRetryError', () => {
  const rejection = (code: string, message: string) => ({
    message,
    code,
    title: message,
    errorCodes: [code],
  });

  it('409 PushDisabled: hiện câu của core-be và báo cửa hàng không đẩy hoá đơn', () => {
    const message = 'Cửa hàng không đẩy hoá đơn sang KiotViet — hoá đơn chỉ lưu trong hệ thống.';

    expect(kiotVietRetryError(rejection('KiotVietSalesOrder.PushDisabled', message))).toEqual({
      message,
      pushDisabled: true,
      fromServer: true,
    });
  });

  it('400 theo trạng thái của đơn: hiện câu của core-be, không coi là "không đẩy"', () => {
    const cases: [string, string][] = [
      ['KiotVietSalesOrder.PushAlreadySynced', 'Đơn đã đồng bộ KiotViet rồi'],
      [
        'KiotVietSalesOrder.PushQueued',
        'Hoá đơn đang chờ đẩy sang KiotViet — hệ thống tự đẩy, không cần đẩy lại.',
      ],
      [
        'KiotVietSalesOrder.PushNotApplicable',
        'Hoá đơn này chỉ lưu trong hệ thống, không đẩy sang KiotViet.',
      ],
      ['KiotVietSalesOrder.NotFound', 'Không tìm thấy đơn bán'],
    ];

    cases.forEach(([code, message]) => {
      expect(kiotVietRetryError(rejection(code, message))).toEqual({
        message,
        pushDisabled: false,
        fromServer: true,
      });
    });
  });

  it('thân kiểu ProblemDetails (không có message) vẫn đọc được câu và mã lỗi', () => {
    expect(
      kiotVietRetryError({
        title: 'Cửa hàng không đẩy hoá đơn sang KiotViet',
        status: 409,
        errorCodes: ['KiotVietSalesOrder.PushDisabled'],
      })
    ).toEqual({
      message: 'Cửa hàng không đẩy hoá đơn sang KiotViet',
      pushDisabled: true,
      fromServer: true,
    });
  });

  it('mất mạng (axios reject bằng chuỗi) hoặc lỗi rỗng: câu mặc định, không phải lời từ chối của core-be', () => {
    const fallback = { message: 'Không thể đồng bộ lại', pushDisabled: false, fromServer: false };

    expect(kiotVietRetryError('Something went wrong')).toEqual(fallback);
    expect(kiotVietRetryError(undefined)).toEqual(fallback);
    expect(kiotVietRetryError({})).toEqual({ ...fallback, fromServer: true });
  });
});
