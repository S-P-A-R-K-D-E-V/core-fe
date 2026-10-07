import type { IOrderLine, IOpenOrder, IFnbMenuDish, IFnbMenuVariant } from 'src/types/fnb';

import { describe, expect, it } from 'vitest';

import { tableStatus, moveOptions } from '../lib/floor';
import { discountCmd, checkoutCmd, cancelCmd } from '../lib/commands';
import { changeDue, checkoutPlan, quickCashOptions } from '../lib/checkout';
import { addDraft, itemDraft, draftTotal, setDraftQty, toLineInput, openItemDraft } from '../lib/draft';
import { roundsOf, billOutdated, moveSelection, voidSelection, pendingLines } from '../lib/order-view';

// ----------------------------------------------------------------------

const ctx = { deviceId: 'web-1', now: new Date('2026-10-07T10:00:00Z') };

function line(p: Partial<IOrderLine> & { id: string }): IOrderLine {
  return {
    seq: 1,
    status: 'Sent',
    lineType: 'Item',
    productId: 'p1',
    dishId: 'd1',
    name: 'Cà phê sữa',
    variantName: null,
    quantity: 1,
    orderedQuantity: 1,
    voidedQuantity: 0,
    listPrice: 20000,
    unitPrice: 20000,
    priceOverride: null,
    toppings: [],
    quickNotes: [],
    note: null,
    amount: 20000,
    ticketId: 't1',
    sentAt: '2026-10-07T09:00:00Z',
    movedFromOrderId: null,
    movedFromLineId: null,
    createdAt: '2026-10-07T09:00:00Z',
    createdByName: 'A',
    ...p,
  } as IOrderLine;
}

function order(lines: IOrderLine[], p: Partial<IOpenOrder> = {}): IOpenOrder {
  return {
    id: 'o1',
    version: 7,
    status: 'Open',
    branchId: 'b1',
    tableId: 'tb1',
    tableName: 'Bàn 1',
    areaName: 'Tầng 1',
    displayNo: '001',
    lines,
    discount: null,
    totals: { subtotal: 50000, discountAmount: 0, total: 50000, itemCount: 2 },
    bill: null,
    ...p,
  } as IOpenOrder;
}

const dish = { id: 'd1', name: 'Trà đào' } as IFnbMenuDish;
const sizeM = { productId: 'pM', name: 'M', price: 30000 } as IFnbMenuVariant;
const sizeL = { productId: 'pL', name: 'L', price: 35000 } as IFnbMenuVariant;

// ----------------------------------------------------------------------

describe('checkoutPlan', () => {
  it('tiền mặt vừa đủ → cashTendered null, một khoản bằng tổng', () => {
    expect(checkoutPlan(55000, { method: 'Cash' })).toEqual({
      payments: [{ method: 'Cash', amount: 55000, bankAccountId: null, transactionRef: null }],
      cashTendered: null,
    });
  });

  it('tiền mặt khách đưa dư → cashTendered = tiền đưa', () => {
    expect(checkoutPlan(55000, { method: 'Cash', cashGiven: 100000 }).cashTendered).toBe(100000);
    expect(changeDue(55000, 100000)).toBe(45000);
    expect(changeDue(55000, 50000)).toBe(0);
  });

  it('chuyển khoản mang tài khoản + nội dung, không có cashTendered', () => {
    const plan = checkoutPlan(55000, { method: 'Transfer', bankAccountId: 'acc', transferRef: '  Ban 1 001 ', cashGiven: 999999 });
    expect(plan.payments[0]).toEqual({ method: 'Transfer', amount: 55000, bankAccountId: 'acc', transactionRef: 'Ban 1 001' });
    expect(plan.cashTendered).toBeNull();
  });

  it('tổng 0 → không khoản nào', () => {
    expect(checkoutPlan(0, { method: 'Cash' })).toEqual({ payments: [], cashTendered: null });
  });

  it('gợi ý tiền mặt gồm tổng và tờ tròn lớn hơn', () => {
    expect(quickCashOptions(55000)).toEqual([55000, 60000, 100000, 200000, 500000]);
  });
});

describe('lệnh ghi', () => {
  it('giảm giá gửi thân phẳng theo hợp đồng (type/value/reason + baseVersion)', () => {
    const cmd = discountCmd(ctx, { id: 'o1', version: 7 }, { type: 'Percent', value: 10, reason: ' khách quen ' });
    expect(cmd.method).toBe('PUT');
    expect(cmd.path).toBe('/fnb/orders/o1/discount');
    expect(cmd.body).toMatchObject({ baseVersion: 7, type: 'Percent', value: 10, reason: 'khách quen', deviceId: 'web-1' });
    expect(cmd.body).not.toHaveProperty('discount');
  });

  it('bỏ giảm giá → type/value/reason null', () => {
    const cmd = discountCmd(ctx, { id: 'o1', version: 7 }, { type: null, value: 5, reason: 'x' });
    expect(cmd.body).toMatchObject({ type: null, value: null, reason: null });
  });

  it('thanh toán: sendTicketId chỉ khi còn dòng chưa gửi', () => {
    const base = { expectedTotal: 50000, payments: [], cashTendered: null };
    expect(checkoutCmd(ctx, { id: 'o1', version: 7 }, { ...base, sendPending: false }).body.sendTicketId).toBeNull();
    expect(checkoutCmd(ctx, { id: 'o1', version: 7 }, { ...base, sendPending: true }).body.sendTicketId).toEqual(expect.any(String));
  });

  it('huỷ đơn chưa gửi bar → không có phiếu HỦY, lý do rỗng thành null', () => {
    const cmd = cancelCmd(ctx, { id: 'o1', version: 7 }, { hasSentLines: false, reason: '  ', alreadyMade: false });
    expect(cmd.body).toMatchObject({ ticketId: null, reason: null });
  });
});

describe('món đang chọn', () => {
  it('bấm cùng món cùng size → cộng số lượng; khác size → dòng mới', () => {
    let drafts = addDraft([], itemDraft(dish, sizeM));
    drafts = addDraft(drafts, itemDraft(dish, sizeM));
    drafts = addDraft(drafts, itemDraft(dish, sizeL));
    expect(drafts.map((d) => [d.productId, d.quantity])).toEqual([
      ['pM', 2],
      ['pL', 1],
    ]);
    expect(draftTotal(drafts)).toBe(2 * 30000 + 35000);
  });

  it('khác món thêm / ghi chú → không gộp', () => {
    const plain = itemDraft(dish, sizeM);
    const withTopping = itemDraft(dish, sizeM, { toppings: [{ productId: 'tp', name: 'Trân châu', quantity: 1, unitPrice: 5000 }] });
    const drafts = addDraft([plain], withTopping);
    expect(drafts).toHaveLength(2);
    expect(draftTotal(drafts)).toBe(30000 + 35000);
  });

  it('số lượng về 0 → bỏ dòng', () => {
    const d = itemDraft(dish, sizeM);
    expect(setDraftQty([d], d.id, 0)).toEqual([]);
  });

  it('dòng gửi lên: Item không gửi giá, OpenItem gửi tên + giá', () => {
    const item = toLineInput(itemDraft(dish, sizeM, { note: ' ít đá ' }));
    expect(item).toMatchObject({ lineType: 'Item', productId: 'pM', quantity: 1, note: 'ít đá' });
    expect(item).not.toHaveProperty('unitPrice');
    const open = toLineInput(openItemDraft({ name: ' Bánh ', unitPrice: 15000 }));
    expect(open).toMatchObject({ lineType: 'OpenItem', name: 'Bánh', unitPrice: 15000, quantity: 1 });
  });
});

describe('xem đơn', () => {
  const o = order([
    line({ id: 'a', seq: 1, ticketId: 't1', quantity: 2 }),
    line({ id: 'b', seq: 2, ticketId: 't2' }),
    line({ id: 'c', seq: 3, ticketId: 't1', status: 'Voided', quantity: 0, voidedQuantity: 1 }),
    line({ id: 'd', seq: 4, ticketId: null, status: 'Pending', sentAt: null }),
  ]);

  it('gom lượt theo phiếu, đánh số theo lần gửi', () => {
    expect(roundsOf(o).map((r) => [r.no, r.ticketId, r.lines.map((l) => l.id)])).toEqual([
      [1, 't1', ['a', 'c']],
      [2, 't2', ['b']],
    ]);
    expect(pendingLines(o).map((l) => l.id)).toEqual(['d']);
  });

  it('chuyển một phần sinh id dòng mới; chuyển hết giữ nguyên dòng', () => {
    const sel = moveSelection(o, { a: 1, b: 1, d: 0 }, () => 'new');
    expect(sel).toEqual([
      { lineId: 'a', quantity: 1, newLineId: 'new' },
      { lineId: 'b', quantity: 1, newLineId: null },
    ]);
  });

  it('huỷ món chỉ lấy dòng đã gửi, chặn quá số lượng', () => {
    expect(voidSelection(o, { a: 5, d: 1 })).toEqual([{ lineId: 'a', quantity: 2 }]);
  });

  it('tạm tính lỗi thời khi tổng đổi sau lần in', () => {
    expect(billOutdated(order([], { bill: { lastTotal: 40000 } as IOpenOrder['bill'] }))).toBe(true);
    expect(billOutdated(order([], { bill: { lastTotal: 50000 } as IOpenOrder['bill'] }))).toBe(false);
  });
});

describe('sơ đồ bàn', () => {
  const summary = (id: string, billPrinted = false) => ({ id, displayNo: id, billPrinted }) as never;

  it('trạng thái bàn theo đơn đang mở', () => {
    expect(tableStatus({ orders: [] })).toBe('free');
    expect(tableStatus({ orders: [summary('1')] })).toBe('occupied');
    expect(tableStatus({ orders: [summary('1'), summary('2', true)] })).toBe('billed');
  });

  it('nơi chuyển tới không gồm đơn nguồn, luôn có mang về mới', () => {
    const floor = {
      branchId: 'b1',
      areas: [
        {
          id: 'a1',
          name: 'Tầng 1',
          sortOrder: 0,
          tables: [
            { id: 't1', name: 'Bàn 1', sortOrder: 0, orders: [summary('o1')] },
            { id: 't2', name: 'Bàn 2', sortOrder: 1, orders: [summary('o2')] },
          ],
        },
      ],
      takeawayOrders: [],
    } as never;
    expect(moveOptions(floor, 'o1').map((o) => o.key)).toEqual(['t:t1', 'o:o2', 't:t2', 't:takeaway']);
  });
});
