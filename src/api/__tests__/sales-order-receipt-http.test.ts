import { afterEach, describe, expect, it } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import axiosInstance from 'src/utils/axios';

import { getSalesOrderReceipt } from 'src/api/sales-orders';

import { normalReceipt } from 'src/sections/pos/receipt-print/__tests__/receipt-fixtures';

// ----------------------------------------------------------------------
// getSalesOrderReceipt qua axios THẬT của app (kèm interceptor), chỉ thay tầng mạng: 404 phải tới được
// hàm gọi kèm mã trạng thái — interceptor vốn đổi mọi lỗi không có body thành chuỗi "Something went wrong".
// ----------------------------------------------------------------------

const ORDER_ID = '3f0c1c1e-6c0d-4a53-9d0e-2a5b8a1f4c11';

const originalAdapter = axiosInstance.defaults.adapter;
const requests: InternalAxiosRequestConfig[] = [];

// Tầng mạng giả, xử lý mã trạng thái đúng như adapter thật của axios (settle): validateStatus từ chối
// thì reject bằng AxiosError mang response.
function respondWith(status: number, data: unknown) {
  axiosInstance.defaults.adapter = async (config) => {
    requests.push(config);
    const response = { status, statusText: '', data, headers: {}, config };
    if (!config.validateStatus || config.validateStatus(status)) return response;
    throw new AxiosError(
      `Request failed with status code ${status}`,
      AxiosError.ERR_BAD_REQUEST,
      config,
      null,
      response
    );
  };
}

afterEach(() => {
  axiosInstance.defaults.adapter = originalAdapter;
  requests.length = 0;
});

describe('getSalesOrderReceipt qua axios của app', () => {
  it('200: trả dữ liệu phiếu; gọi đúng đường dẫn và tham số', async () => {
    const receipt = normalReceipt();
    respondWith(200, receipt);

    await expect(getSalesOrderReceipt(ORDER_ID, 'acc-1')).resolves.toEqual(receipt);

    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('get');
    expect(requests[0].url).toBe(`/sales-orders/${ORDER_ID}/receipt`);
    expect(requests[0].params).toEqual({ bankAccountId: 'acc-1' });
  });

  it('404 không có body (core-be cũ) → Error "Máy chủ chưa hỗ trợ in hoá đơn", không phải "Something went wrong"', async () => {
    respondWith(404, '');

    const error = await getSalesOrderReceipt(ORDER_ID).catch((caught) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(AxiosError);
    expect(error.message).toBe('Máy chủ chưa hỗ trợ in hoá đơn');
  });

  it('404 Problem của endpoint → câu báo không tìm thấy hoá đơn', async () => {
    respondWith(404, { title: 'Đơn bán hàng không tồn tại.', status: 404 });

    await expect(getSalesOrderReceipt(ORDER_ID)).rejects.toThrow(/^Không tìm thấy hoá đơn này\./);
  });

  it('403 tắt tính năng vẫn đi qua interceptor: reject bằng body của core-be', async () => {
    const body = {
      error: 'feature_disabled',
      message: 'Cửa hàng chưa bật tính năng bán hàng tại quầy.',
      featureKey: 'commerce.retail.pos',
    };
    respondWith(403, body);

    await expect(getSalesOrderReceipt(ORDER_ID)).rejects.toEqual(body);
  });

  it('500 không có body vẫn như các lời gọi khác: reject bằng "Something went wrong"', async () => {
    respondWith(500, '');

    await expect(getSalesOrderReceipt(ORDER_ID)).rejects.toBe('Something went wrong');
  });
});
