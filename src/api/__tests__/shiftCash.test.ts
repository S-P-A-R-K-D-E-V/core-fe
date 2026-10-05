import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { shiftCashDenial } from 'src/utils/shift-cash-access';

// ----------------------------------------------------------------------
// Hợp đồng với core-be (ShiftCashAccess): vị trí đã qua cổng đi kèm X-Geo-Latitude / X-Geo-Longitude /
// X-Geo-Accuracy trên MỌI lời gọi /shift-cash/* và các lời gọi KiotViet của trang kiểm quầy
// (daily-summary, invoices/{id}, bank-accounts, export-excel). Chưa có vị trí (Admin / cửa hàng chưa
// có toạ độ) → không gửi header.
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
import * as api from 'src/api/shiftCash';

const GEO = { latitude: 21.0362, longitude: 105.7906, accuracy: 25 };
const GEO_HEADERS = {
  'X-Geo-Latitude': '21.0362',
  'X-Geo-Longitude': '105.7906',
  'X-Geo-Accuracy': '25',
};

// Mỗi lời gọi + vị trí của tham số config trong lời gọi axios tương ứng
const CALLS: Array<{
  name: string;
  run: () => Promise<unknown>;
  method: keyof typeof http;
  url: string;
}> = [
  {
    name: 'summary',
    run: () => api.getShiftCashSummary('2026-10-02'),
    method: 'get',
    url: '/shift-cash/summary',
  },
  {
    name: 'transactions GET',
    run: () => api.getShiftCashTransactions('2026-10-02'),
    method: 'get',
    url: '/shift-cash/transactions',
  },
  {
    name: 'transactions POST',
    run: () =>
      api.addShiftCashTransaction({ date: '2026-10-02', type: 'Thu', amount: 1000 } as any),
    method: 'post',
    url: '/shift-cash/transactions',
  },
  {
    name: 'transactions PUT',
    run: () => api.updateShiftCashTransaction('t1', { amount: 1 } as any),
    method: 'put',
    url: '/shift-cash/transactions/t1',
  },
  {
    name: 'transactions DELETE',
    run: () => api.deleteShiftCashTransaction('t1'),
    method: 'delete',
    url: '/shift-cash/transactions/t1',
  },
  {
    name: 'denominations GET',
    run: () => api.getShiftCashDenominations('2026-10-02'),
    method: 'get',
    url: '/shift-cash/denominations',
  },
  {
    name: 'denominations PUT',
    run: () => api.updateDenomination({} as any),
    method: 'put',
    url: '/shift-cash/denominations',
  },
  {
    name: 'denominations batch',
    run: () => api.updateDenominationBatch({} as any),
    method: 'put',
    url: '/shift-cash/denominations/batch',
  },
  {
    name: 'finalize',
    run: () => api.finalizeShiftCash({ date: '2026-10-02', items: [] }),
    method: 'post',
    url: '/shift-cash/finalize',
  },
  {
    name: 'open',
    run: () => api.openCounter('2026-10-02'),
    method: 'post',
    url: '/shift-cash/open',
  },
  {
    name: 'logs',
    run: () => api.getShiftCashLogs('2026-10-02'),
    method: 'get',
    url: '/shift-cash/logs',
  },
  {
    name: 'audit-logs',
    run: () => api.getShiftCashAuditLogs('2026-10-02'),
    method: 'get',
    url: '/shift-cash/audit-logs',
  },
  {
    name: 'investigation',
    run: () => api.getShiftCashInvestigation('2026-10-02'),
    method: 'get',
    url: '/shift-cash/investigation',
  },
  {
    name: 'kiotviet daily-summary',
    run: () => api.getKiotVietDailySummary('2026-10-02'),
    method: 'get',
    url: '/kiotviet/daily-summary',
  },
  {
    name: 'kiotviet invoice detail',
    run: () => api.getKiotVietInvoiceDetail(42),
    method: 'get',
    url: '/kiotviet/invoices/42',
  },
  {
    name: 'kiotviet bank-accounts',
    run: () => api.getKiotVietBankAccounts(),
    method: 'get',
    url: '/kiotviet/bank-accounts',
  },
];

// get/delete(url, config) — post/put(url, data, config)
function configOf(method: keyof typeof http) {
  const args = http[method].mock.calls[0];
  return method === 'get' || method === 'delete' ? args[1] : args[2];
}

beforeEach(() => {
  Object.values(http).forEach((fn) => fn.mockResolvedValue({ data: {} }));
});

afterEach(() => {
  api.setShiftCashGeo(null);
  vi.clearAllMocks();
});

describe('src/api/shiftCash — header X-Geo-*', () => {
  it.each(CALLS)('$name gửi kèm vị trí đã qua cổng', async ({ run, method, url }) => {
    api.setShiftCashGeo(GEO);
    await run();
    expect(http[method].mock.calls[0][0]).toBe(url);
    expect(configOf(method).headers).toEqual(GEO_HEADERS);
  });

  it.each(CALLS)('$name không gửi header khi chưa có vị trí', async ({ run, method }) => {
    api.setShiftCashGeo(null);
    await run();
    expect(configOf(method).headers).toEqual({});
  });

  it('export-excel gửi kèm vị trí và đọc lỗi 403 dạng Blob ra JSON', async () => {
    api.setShiftCashGeo(GEO);
    const body = { error: 'ShiftCash.OutsideStore', message: 'Bạn đang ở ngoài cửa hàng.' };
    http.get.mockRejectedValueOnce(new Blob([JSON.stringify(body)], { type: 'application/json' }));

    const err = await api.exportKiotVietExcel('2026-10-02').catch((e) => e);

    expect(http.get.mock.calls[0][0]).toBe('/kiotviet/export-excel');
    expect(http.get.mock.calls[0][1]).toMatchObject({ responseType: 'blob', headers: GEO_HEADERS });
    expect(shiftCashDenial(err)).toEqual({
      code: 'ShiftCash.OutsideStore',
      message: 'Bạn đang ở ngoài cửa hàng.',
    });
  });
});

// ----------------------------------------------------------------------
// Hợp đồng GET /shift-cash/investigation (chỉ Admin): 200 = kết quả;
// 404 { error: 'ShiftCash.NotFinalized' } = ngày chưa chốt; 404 khác = BE chưa có endpoint;
// 403 = không phải Admin. Interceptor của axios reject bằng BODY (403 / 404 trơn có body rỗng → mất
// mã HTTP) nên lời gọi này tự giữ 403 / 404 bằng validateStatus.
// ----------------------------------------------------------------------

describe('src/api/shiftCash — getShiftCashInvestigation', () => {
  const DATE = '2026-10-02';

  it('200 → ok kèm kết quả, gửi đúng ngày', async () => {
    const result = { date: DATE, finalized: true, findings: [] };
    http.get.mockResolvedValueOnce({ status: 200, data: result });

    await expect(api.getShiftCashInvestigation(DATE)).resolves.toEqual({ status: 'ok', result });
    expect(http.get.mock.calls[0][0]).toBe('/shift-cash/investigation');
    expect(http.get.mock.calls[0][1]).toMatchObject({ params: { date: DATE } });
  });

  it('404 { error: ShiftCash.NotFinalized } → not-finalized', async () => {
    http.get.mockResolvedValueOnce({
      status: 404,
      data: {
        error: 'ShiftCash.NotFinalized',
        message: 'Ngày 02/10/2026 chưa chốt tiền quầy nên chưa có chênh lệch để kiểm tra.',
      },
    });

    await expect(api.getShiftCashInvestigation(DATE)).resolves.toEqual({ status: 'not-finalized' });
  });

  it.each([
    ['body rỗng', ''],
    ['ProblemDetails không kèm mã lỗi', { title: 'Not Found', status: 404 }],
    ['mã lỗi khác', { error: 'ShiftCash.SomethingElse', message: 'x' }],
  ])('404 %s (BE chưa có endpoint) → unavailable', async (_name, data) => {
    http.get.mockResolvedValueOnce({ status: 404, data });

    await expect(api.getShiftCashInvestigation(DATE)).resolves.toEqual({ status: 'unavailable' });
  });

  it('403 → forbidden', async () => {
    http.get.mockResolvedValueOnce({ status: 403, data: '' });

    await expect(api.getShiftCashInvestigation(DATE)).resolves.toEqual({ status: 'forbidden' });
  });

  it('chỉ giữ lại 2xx / 403 / 404 — 401 và lỗi khác vẫn reject qua interceptor', async () => {
    await api.getShiftCashInvestigation(DATE);

    const { validateStatus } = http.get.mock.calls[0][1];
    expect([200, 204, 403, 404].map((status) => validateStatus(status))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect([302, 400, 401, 409, 500, 503].map((status) => validateStatus(status))).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('lỗi khác (interceptor reject bằng body) → ném tiếp cho nơi gọi', async () => {
    http.get.mockRejectedValueOnce('Something went wrong');

    await expect(api.getShiftCashInvestigation(DATE)).rejects.toBe('Something went wrong');
  });
});
