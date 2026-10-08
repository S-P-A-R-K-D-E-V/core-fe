import type { IKitchenTicket } from 'src/types/fnb';

import { vi, describe, expect, it } from 'vitest';

import { stationQueue, printTicketFlow } from '../lib/ticket-print';

// ----------------------------------------------------------------------

const ticket = (id: string, p: Partial<IKitchenTicket> = {}): IKitchenTicket =>
  ({
    id,
    kind: 'Order',
    displayNo: '1',
    createdAt: '2026-10-08T08:00:00.000Z',
    printStatus: 'Pending',
    claimedByDeviceId: null,
    claimExpiresAt: null,
    lines: [],
    ...p,
  }) as IKitchenTicket;

const deps = (claim: () => Promise<IKitchenTicket>, print: () => Promise<void> = async () => {}) => {
  const report = vi.fn(async () => ({}));
  return { claim: vi.fn(claim), print: vi.fn(print), report };
};

describe('printTicketFlow', () => {
  it('giữ quyền → in → báo Printed', async () => {
    const d = deps(async () => ticket('a'));
    expect(await printTicketFlow(ticket('a'), d)).toEqual({ outcome: 'printed' });
    expect(d.claim).toHaveBeenCalledWith('a', false);
    expect(d.report).toHaveBeenCalledWith('a', 'Printed', null, false);
  });

  it('máy khác đang giữ quyền / đã in → không in, không báo', async () => {
    const busy = deps(async () => Promise.reject({ errorCodes: ['KitchenTicket.PrintInProgress'] }));
    const done = deps(async () => Promise.reject({ errorCodes: ['KitchenTicket.AlreadyPrinted'] }));
    expect((await printTicketFlow(ticket('a'), busy)).outcome).toBe('busy');
    expect((await printTicketFlow(ticket('a'), done)).outcome).toBe('done');
    expect(busy.print).not.toHaveBeenCalled();
    expect(done.report).not.toHaveBeenCalled();
  });

  it('in lỗi → báo Failed kèm lỗi', async () => {
    const d = deps(
      async () => ticket('a'),
      async () => {
        throw new Error('Hết giấy');
      }
    );
    expect(await printTicketFlow(ticket('a'), d)).toEqual({ outcome: 'failed', error: 'Hết giấy' });
    expect(d.report).toHaveBeenCalledWith('a', 'Failed', 'Hết giấy', false);
  });

  it('in lại: ghi nhật ký in lại và báo kết quả in lại', async () => {
    const d = deps(async () => ticket('a', { printStatus: 'Printed' }));
    await printTicketFlow(ticket('a', { printStatus: 'Printed' }), d, true);
    expect(d.claim).toHaveBeenCalledWith('a', true);
    expect(d.report).toHaveBeenCalledWith('a', 'Printed', null, true);
  });
});

describe('stationQueue', () => {
  const now = Date.parse('2026-10-08T08:01:00.000Z');

  it('nhận phiếu chưa in / in lỗi / máy gửi bỏ qua, cũ trước; bỏ phiếu đã in và phiếu đã xử lý', () => {
    const list = [
      ticket('new', { createdAt: '2026-10-08T08:00:30.000Z' }),
      ticket('skipped', { printStatus: 'Skipped', createdAt: '2026-10-08T08:00:10.000Z' }),
      ticket('failed', { printStatus: 'Failed', createdAt: '2026-10-08T08:00:20.000Z' }),
      ticket('printed', { printStatus: 'Printed' }),
      ticket('mine-done'),
    ];
    expect(stationQueue(list, now, 'station', new Set(['mine-done'])).map((t) => t.id)).toEqual([
      'skipped',
      'failed',
      'new',
    ]);
  });

  it('phiếu máy khác vừa tạo còn giữ quyền in thì chờ; hết hạn thì nhận', () => {
    const held = ticket('held', { claimedByDeviceId: 'pos', claimExpiresAt: '2026-10-08T08:01:20.000Z' });
    const expired = ticket('expired', { claimedByDeviceId: 'pos', claimExpiresAt: '2026-10-08T08:00:50.000Z' });
    const mine = ticket('mine', { claimedByDeviceId: 'station', claimExpiresAt: '2026-10-08T08:01:20.000Z' });
    expect(stationQueue([held, expired, mine], now, 'station', new Set()).map((t) => t.id)).toEqual(['expired', 'mine']);
  });
});
