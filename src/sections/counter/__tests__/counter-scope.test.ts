import { describe, it, expect, vi } from 'vitest';

vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user: null }) }));

import { paths } from 'src/routes/paths';

import { groupRoster } from '../counter-lock-view';
import { counterHome, counterSaleHome, isCounterPathAllowed } from '../counter-scope';

// Máy quầy chỉ phục vụ bán hàng: trang ngoài phạm vi bị đưa về bán hàng (server cũng chặn API).

describe('isCounterPathAllowed', () => {
  it.each([
    paths.dashboard.pos.sale.root,
    paths.dashboard.fnb.pos,
    paths.dashboard.pos.salesOrder.list,
    `${paths.dashboard.pos.salesOrder.root}/abc/`,
    paths.dashboard.pos.product.list,
    paths.dashboard.pos.customer.list,
    paths.dashboard.shiftCash.root,
  ])('cho phép %s', (path) => expect(isCounterPathAllowed(path)).toBe(true));

  it.each([
    paths.dashboard.root,
    paths.dashboard.attendance.checkin,
    paths.dashboard.payroll.myPayroll,
    paths.dashboard.messenger,
    paths.dashboard.storeSettings.root,
    paths.dashboard.pos.product.new,
    `${paths.dashboard.pos.salesOrder.root}/abc/edit`,
  ])('chặn %s', (path) => expect(isCounterPathAllowed(path)).toBe(false));
});

describe('counterSaleHome', () => {
  it('bán lẻ nếu cửa hàng bật, không thì F&B', () => {
    expect(counterSaleHome(['commerce.retail.pos', 'commerce.fnb.pos'])).toBe(paths.dashboard.pos.sale.root);
    expect(counterSaleHome(['commerce.fnb.pos'])).toBe(paths.dashboard.fnb.pos);
    expect(counterSaleHome(null)).toBe(paths.dashboard.pos.sale.root);
  });
});

describe('counterHome', () => {
  it('mặc định vào Kiểm tiền quầy — cả khi chưa nạp người dùng (vừa đăng nhập ở màn khoá)', () => {
    expect(counterHome(null)).toBe(paths.dashboard.shiftCash.root);
    expect(counterHome({ enabledFeatures: ['commerce.fnb.pos'], blockedFeatures: [] })).toBe(paths.dashboard.shiftCash.root);
  });

  it('Kiểm quầy bị tắt trên nền tảng này → về trang bán hàng', () => {
    expect(counterHome({ enabledFeatures: ['commerce.retail.pos'], blockedFeatures: ['shift-cash.counter'] })).toBe(
      paths.dashboard.pos.sale.root
    );
    expect(counterHome({ enabledFeatures: ['commerce.fnb.pos'], blockedFeatures: ['shift-cash.counter'] })).toBe(
      paths.dashboard.fnb.pos
    );
  });
});

describe('groupRoster', () => {
  const p = (userId: string, status: string, atThisBranch?: boolean) =>
    ({ userId, fullName: userId, role: 'Staff', status, canSignIn: true, hasApp: true, atThisBranch }) as any;

  it('ca chưa gắn chi nhánh ngay sau người của chi nhánh, trước quản lý', () => {
    const groups = groupRoster([p('a', 'ended'), p('b', 'working', false), p('c', 'working'), p('d', 'manager')]);
    expect(groups.map((g) => [g.key, g.people.map((x) => x.userId)])).toEqual([
      ['working', ['c']],
      ['otherBranch', ['b']],
      ['manager', ['d']],
      ['ended', ['a']],
    ]);
  });
});
