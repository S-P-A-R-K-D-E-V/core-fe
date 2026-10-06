import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalReceipt } from 'src/sections/pos/receipt-print/__tests__/receipt-fixtures';

// ----------------------------------------------------------------------
// Hợp đồng với core-be: GET /sales-orders/{id}/receipt[?bankAccountId=<guid>] trả dữ liệu phiếu thanh
// toán. Core-be cũ chưa có endpoint này → 404 không có body → báo "Máy chủ chưa hỗ trợ in hoá đơn".
// Interceptor của axios chỉ giữ lại body nên lời gọi này tự nhận 404 (validateStatus) để còn biết mã
// trạng thái.
// ----------------------------------------------------------------------

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

// Imported after the mock above so the module under test picks up the mocked axios.
import { getSalesOrderReceipt, RECEIPT_UNSUPPORTED_MESSAGE } from 'src/api/sales-orders';

const ORDER_ID = '3f0c1c1e-6c0d-4a53-9d0e-2a5b8a1f4c11';
const ACCOUNT_ID = '9b2d7a40-1c3e-4f5a-8b6d-0e1f2a3b4c5d';

afterEach(() => {
  vi.clearAllMocks();
});

describe('getSalesOrderReceipt', () => {
  it('gọi GET /sales-orders/{id}/receipt, không kèm bankAccountId khi không chọn tài khoản', async () => {
    const receipt = normalReceipt();
    http.get.mockResolvedValue({ status: 200, data: receipt });

    await expect(getSalesOrderReceipt(ORDER_ID)).resolves.toBe(receipt);

    expect(http.get).toHaveBeenCalledTimes(1);
    const [url, config] = http.get.mock.calls[0];
    expect(url).toBe(`/sales-orders/${ORDER_ID}/receipt`);
    expect(config.params).toBeUndefined();
  });

  it('có chọn tài khoản nhận thì gửi ?bankAccountId=<id>; null / chuỗi rỗng coi như không chọn', async () => {
    http.get.mockResolvedValue({ status: 200, data: normalReceipt() });

    await getSalesOrderReceipt(ORDER_ID, ACCOUNT_ID);
    expect(http.get.mock.calls[0][1].params).toEqual({ bankAccountId: ACCOUNT_ID });

    await getSalesOrderReceipt(ORDER_ID, null);
    await getSalesOrderReceipt(ORDER_ID, '');
    expect(http.get.mock.calls[1][1].params).toBeUndefined();
    expect(http.get.mock.calls[2][1].params).toBeUndefined();
  });

  it('tự nhận 404 (không để interceptor nuốt mã trạng thái); các mã lỗi khác vẫn là lỗi', async () => {
    http.get.mockResolvedValue({ status: 200, data: normalReceipt() });
    await getSalesOrderReceipt(ORDER_ID);

    const { validateStatus } = http.get.mock.calls[0][1];
    expect(validateStatus(200)).toBe(true);
    expect(validateStatus(204)).toBe(true);
    expect(validateStatus(404)).toBe(true);
    expect(validateStatus(400)).toBe(false);
    expect(validateStatus(401)).toBe(false);
    expect(validateStatus(403)).toBe(false);
    expect(validateStatus(500)).toBe(false);
  });

  it.each([
    ['body rỗng', ''],
    ['không có body', undefined],
    ['body null', null],
    ['trang HTML của proxy', '<html><body>404 Not Found</body></html>'],
    [
      'Problem chung của route không tồn tại',
      { type: 'about:blank', title: 'Not Found', status: 404 },
    ],
    ['Problem không có title', { status: 404 }],
  ])(
    '404 vì core-be cũ chưa có endpoint (%s) → "Máy chủ chưa hỗ trợ in hoá đơn"',
    async (_name, body) => {
      http.get.mockResolvedValue({ status: 404, data: body });

      const error = await getSalesOrderReceipt(ORDER_ID).catch((caught) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Máy chủ chưa hỗ trợ in hoá đơn');
      expect(RECEIPT_UNSUPPORTED_MESSAGE).toBe('Máy chủ chưa hỗ trợ in hoá đơn');
    }
  );

  it('404 của chính endpoint: hoá đơn không tồn tại / nhân viên xem hoá đơn không phải của mình hôm nay', async () => {
    http.get.mockResolvedValue({
      status: 404,
      data: { title: 'Đơn bán hàng không tồn tại.', status: 404 },
    });

    const error = await getSalesOrderReceipt(ORDER_ID).catch((caught) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      'Không tìm thấy hoá đơn này. Nhân viên chỉ in được hoá đơn do chính mình tạo trong ngày.'
    );
  });

  it('404 có title khác (cửa hàng chưa có tenant) → hiện đúng câu của core-be', async () => {
    http.get.mockResolvedValue({ status: 404, data: { title: 'Tenant not found.', status: 404 } });

    await expect(getSalesOrderReceipt(ORDER_ID)).rejects.toThrow('Tenant not found.');
  });

  it('200 nhưng không phải dữ liệu phiếu (vd. trang HTML) → coi như máy chủ chưa hỗ trợ', async () => {
    http.get.mockResolvedValue({ status: 200, data: '<!DOCTYPE html><html></html>' });
    await expect(getSalesOrderReceipt(ORDER_ID)).rejects.toThrow('Máy chủ chưa hỗ trợ in hoá đơn');

    http.get.mockResolvedValue({ status: 200, data: { id: ORDER_ID, orderNumber: 'HD-1' } });
    await expect(getSalesOrderReceipt(ORDER_ID)).rejects.toThrow('Máy chủ chưa hỗ trợ in hoá đơn');
  });

  it('lỗi khác (400, 403 tắt tính năng…) giữ nguyên body mà interceptor reject', async () => {
    const disabled = {
      error: 'feature_disabled',
      message: 'Cửa hàng chưa bật tính năng bán hàng tại quầy.',
      featureKey: 'commerce.retail.pos',
    };
    http.get.mockRejectedValue(disabled);

    await expect(getSalesOrderReceipt(ORDER_ID)).rejects.toBe(disabled);
  });
});
