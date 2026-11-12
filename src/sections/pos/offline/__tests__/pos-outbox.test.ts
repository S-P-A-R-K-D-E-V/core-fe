import { describe, expect, it, vi } from 'vitest';

import type { ICreateSalesOrderRequest } from 'src/types/corecms-api';

import { memoryStore } from '../pos-store';
import {
  isDue,
  backoffMs,
  createOutbox,
  processOutbox,
  retryPayload,
  STALE_SENDING_MS,
  SENT_RETENTION_MS,
  type OutboxEntry,
} from '../pos-outbox';

// ----------------------------------------------------------------------
// Hàng chờ hoá đơn của màn bán hàng (GĐ1): gửi lại cùng mã chống trùng + giờ bán, lùi dần khi mất mạng, lỗi nghiệp vụ
// thì giữ lại cho thu ngân xử lý.
// ----------------------------------------------------------------------

const NOW = Date.parse('2026-11-12T10:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

const payload = (id: string): ICreateSalesOrderRequest => ({
  clientRequestId: id,
  totalPayment: 35000,
  warehouseId: 'wh-1',
  invoiceDetails: [{ productId: 'p-1', productCode: 'SP1', productName: 'Kẹp', quantity: 1, price: 35000 }],
  payments: [{ method: 'Cash', amount: 35000 }],
});

const entry = (id: string, over: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id,
  payload: payload(id),
  label: 'Hóa đơn 1',
  total: 35000,
  itemCount: 1,
  createdAt: iso(NOW - 10 * 60 * 1000),
  status: 'pending',
  attempts: 1,
  ...over,
});

const makeOutbox = (rows: OutboxEntry[]) => createOutbox(Promise.resolve(memoryStore<OutboxEntry>(rows)));

describe('isDue / backoff', () => {
  it('chờ gửi: tới giờ thử lại mới gửi; bấm tay thì gửi ngay', () => {
    expect(isDue(entry('a'), NOW, false)).toBe(true);
    const later = entry('b', { nextAttemptAt: iso(NOW + 5000) });
    expect(isDue(later, NOW, false)).toBe(false);
    expect(isDue(later, NOW, true)).toBe(true);
  });

  it('"đang gửi" quá lâu (trang tắt giữa chừng) thì gửi lại; đã gửi / lỗi thì không', () => {
    expect(isDue(entry('a', { status: 'sending', lastAttemptAt: iso(NOW - 1000) }), NOW, true)).toBe(false);
    expect(isDue(entry('a', { status: 'sending', lastAttemptAt: iso(NOW - STALE_SENDING_MS) }), NOW, false)).toBe(true);
    expect(isDue(entry('a', { status: 'sent' }), NOW, true)).toBe(false);
    expect(isDue(entry('a', { status: 'failed' }), NOW, true)).toBe(false);
  });

  it('lùi 5 s, 10 s, 20 s… tối đa 5 phút', () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([5000, 10000, 20000]);
    expect(backoffMs(20)).toBe(5 * 60 * 1000);
  });

  it('gửi lại kèm giờ bán thật và cờ offline', () => {
    const e = entry('a');
    expect(retryPayload(e)).toEqual({ ...e.payload, purchaseDate: e.createdAt, offline: true });
  });
});

describe('processOutbox', () => {
  it('gửi lần lượt theo giờ bán, đánh dấu đã gửi + id hoá đơn', async () => {
    const outbox = makeOutbox([entry('b', { createdAt: iso(NOW - 1000) }), entry('a', { createdAt: iso(NOW - 2000) })]);
    const send = vi.fn(async (p: ICreateSalesOrderRequest) => ({ id: `so-${p.clientRequestId}` }));

    const result = await processOutbox(outbox, send, { now: () => NOW });

    expect(send.mock.calls.map(([p]) => p.clientRequestId)).toEqual(['a', 'b']);
    expect(send.mock.calls[0][0]).toMatchObject({ offline: true, purchaseDate: iso(NOW - 2000) });
    expect(result.sent.map((e) => e.serverId)).toEqual(['so-a', 'so-b']);
    expect((await outbox.list()).every((e) => e.status === 'sent' && e.sentAt === iso(NOW))).toBe(true);
  });

  it('mất mạng: giữ chờ gửi, lùi thời gian, dừng không gửi các hoá đơn sau', async () => {
    const outbox = makeOutbox([entry('a', { createdAt: iso(NOW - 2000) }), entry('b', { createdAt: iso(NOW - 1000) })]);
    const send = vi.fn().mockRejectedValue('Something went wrong');

    const result = await processOutbox(outbox, send, { now: () => NOW });

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.networkDown).toBe(true);
    const [a, b] = await outbox.list();
    expect(a).toMatchObject({ status: 'pending', attempts: 2, nextAttemptAt: iso(NOW + backoffMs(2)) });
    expect(b).toMatchObject({ status: 'pending', attempts: 1 });
  });

  it('hết phiên đăng nhập (401) không phải lỗi của hoá đơn — vẫn chờ gửi', async () => {
    const outbox = makeOutbox([entry('a')]);
    await processOutbox(outbox, vi.fn().mockRejectedValue({ status: 401 }), { now: () => NOW });
    expect((await outbox.list())[0].status).toBe('pending');
  });

  it('máy chủ từ chối (4xx nghiệp vụ): đánh dấu lỗi kèm lý do, gửi tiếp hoá đơn sau', async () => {
    const outbox = makeOutbox([entry('a', { createdAt: iso(NOW - 2000) }), entry('b', { createdAt: iso(NOW - 1000) })]);
    const send = vi
      .fn()
      .mockRejectedValueOnce({ status: 400, title: 'Giá bán phải đúng giá niêm yết' })
      .mockResolvedValueOnce({ id: 'so-b' });

    const result = await processOutbox(outbox, send, { now: () => NOW });

    expect(result.failed.map((e) => e.id)).toEqual(['a']);
    expect(result.sent.map((e) => e.id)).toEqual(['b']);
    expect((await outbox.list())[0]).toMatchObject({ status: 'failed', lastError: 'Giá bán phải đúng giá niêm yết' });
  });

  it('chưa tới giờ thử lại thì tự động bỏ qua, bấm tay thì gửi', async () => {
    const outbox = makeOutbox([entry('a', { nextAttemptAt: iso(NOW + 60_000) })]);
    const send = vi.fn().mockResolvedValue({ id: 'so-a' });

    await processOutbox(outbox, send, { now: () => NOW });
    expect(send).not.toHaveBeenCalled();

    await processOutbox(outbox, send, { manual: true, now: () => NOW });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('outbox', () => {
  it('báo thay đổi cho nơi đang nghe; bỏ hoá đơn đã gửi quá 7 ngày', async () => {
    const outbox = makeOutbox([
      entry('old', { status: 'sent', sentAt: iso(NOW - SENT_RETENTION_MS - 1) }),
      entry('new', { status: 'sent', sentAt: iso(NOW - 1000) }),
      entry('wait', { status: 'pending' }),
    ]);
    const listener = vi.fn();
    outbox.subscribe(listener);

    await outbox.prune(NOW);

    expect((await outbox.list()).map((e) => e.id).sort()).toEqual(['new', 'wait']);
    expect(listener).toHaveBeenCalled();
  });

  it('kho bộ nhớ không phải kho bền', async () => {
    expect(await makeOutbox([]).durable()).toBe(false);
  });
});
