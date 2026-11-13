import type { IPaymentChannels } from 'src/types/online-shop';
import type { IKiotVietBankAccount, IPosAccountCapability } from 'src/types/corecms-api';

import { it, expect, describe } from 'vitest';

import { offlineTransferChoice } from 'src/sections/pos/offline/offline-transfer-choice';

import {
  routingSummary,
  setScope,
  payloadOf,
  moveAccount,
  scopeConfig,
  draftProblem,
  routingDraft,
  isOtherHolder,
  toggleAccount,
  primaryHolder,
  initialConfig,
  branchesPayload,
} from '../transfer-routing-utils';

const acc = (id: string, number: string, holder = 'VU XUAN BINH', isDefault = false): IKiotVietBankAccount => ({
  id,
  shortName: 'MB',
  bin: '970422',
  accountNumber: number,
  accountHolder: holder,
  isDefault,
});
const A = acc('a', '2510199966668', 'VU XUAN BINH', true);
const B = acc('b', '0020184539005');
const D = acc('d', '681809200068', 'PHAM THUY MAI');
const F = acc('f', 'VQRQAMUXX7318');
const cap = (confirmation: IPosAccountCapability['confirmation']) =>
  ({ bankAccountId: '', confirmation, kind: null, provider: null, quota: null, reason: null }) as IPosAccountCapability;

const channels = (over: Partial<IPaymentChannels> = {}): IPaymentChannels => ({
  paymentServiceEnabled: true,
  options: [],
  pos: { configured: true, enabled: ['cash', 'transfer:account'], transfer: null, branches: null },
  online: { configured: false, enabled: [], transfer: null },
  ...over,
});

describe('tài khoản nhận theo kênh — bản nháp', () => {
  it('khởi đầu: tài khoản tự xác nhận vào danh sách, tài khoản tay làm dự phòng; online không có dự phòng tay', () => {
    const caps = { a: cap('auto'), b: cap('auto'), d: cap('auto'), f: cap('manual') };
    const pos = initialConfig('priority', [A, B, D, F], caps, false);
    expect(pos.accounts.map((x) => x.id)).toEqual(['a', 'b', 'd']);
    expect(pos.fallbackId).toBe('f');
    expect(pos.cashierOverride).toBe('pool');
    const online = initialConfig('round_robin', [A, B, F], caps, true);
    expect(online.accounts.map((x) => x.id)).toEqual(['a', 'b']);
    expect(online.fallbackId).toBeNull();
  });

  it('tích / bỏ / đổi thứ tự / chi nhánh riêng', () => {
    let draft = routingDraft(channels());
    expect(scopeConfig(draft, 'pos')).toBeNull();
    const cfg = toggleAccount({ strategy: 'priority', accounts: [{ id: 'a' }], fallbackId: 'f' }, 'b');
    expect(cfg.accounts.map((x) => x.id)).toEqual(['a', 'b']);
    expect(moveAccount(cfg, 1, 0).accounts.map((x) => x.id)).toEqual(['b', 'a']);
    expect(toggleAccount(cfg, 'a').accounts.map((x) => x.id)).toEqual(['b']);

    draft = setScope(draft, 'branch:br1', cfg);
    expect(branchesPayload(draft)).toEqual({ br1: { transfer: cfg } });
    draft = setScope(draft, 'branch:br1', null);
    expect(branchesPayload(draft)).toBeNull();
  });

  it('kiểm trước khi lưu và "thu ngân chọn" rỗng = bỏ cấu hình', () => {
    expect(draftProblem({ strategy: 'priority', accounts: [{ id: 'a' }] }, false)).toMatch(/dự phòng/);
    expect(draftProblem({ strategy: 'priority', accounts: [{ id: 'a' }] }, true)).toBeNull();
    expect(draftProblem({ strategy: 'weighted', accounts: [{ id: 'a', weight: 0 }], fallbackId: 'f' }, false)).toMatch(/tỷ lệ/);
    expect(payloadOf({ strategy: 'cashier', accounts: [] })).toBeNull();
  });

  it('cảnh báo tài khoản đứng tên người khác', () => {
    const primary = primaryHolder([A, B, D]);
    expect(primary).toBe('VU XUAN BINH');
    expect(isOtherHolder(D, primary)).toBe(true);
    expect(isOtherHolder(B, primary)).toBe(false);
  });

  it('tóm tắt ở bảng phương thức', () => {
    expect(routingSummary(channels())).toBe('Quầy: thu ngân chọn · Online: mọi tài khoản tự xác nhận');
    const data = channels({
      pos: {
        configured: true,
        enabled: [],
        transfer: { strategy: 'priority', accounts: [{ id: 'a' }, { id: 'b' }], fallbackId: 'f', rules: [{ id: 'r', accounts: [{ id: 'd' }], thenDefault: true }] },
        branches: { br1: { transfer: { strategy: 'priority', accounts: [{ id: 'b' }], fallbackId: 'f' } } },
      },
    });
    expect(routingSummary(data)).toBe('Quầy: ưu tiên theo thứ tự · 2 TK + dự phòng · 1 quy tắc (+1 chi nhánh riêng) · Online: mọi tài khoản tự xác nhận');
  });
});

describe('QR tĩnh lúc mất mạng theo cùng quy tắc', () => {
  const routing = {
    transfer: {
      strategy: 'priority' as const,
      accounts: [{ id: 'a' }, { id: 'b' }],
      rules: [{ id: 'big', name: 'Hoá đơn lớn', when: { amountMin: 5_000_000 }, accounts: [{ id: 'd' }], thenDefault: true }],
      fallbackId: 'f',
      cashierOverride: 'pool' as const,
    },
    branches: null,
  };
  const now = new Date('2026-11-11T03:00:00Z');

  it('hoá đơn lớn vào tài khoản của quy tắc, thu ngân chỉ đổi trong danh sách', () => {
    const other = acc('x', '1111');
    const big = offlineTransferChoice([A, B, D, F, other], routing, null, 6_000_000, now);
    expect(big.accountId).toBe('d');
    expect(big.pool.map((x) => x.id)).toEqual(['a', 'b', 'd', 'f']);
    expect(offlineTransferChoice([A, B, D, F], routing, null, 100_000, now).accountId).toBe('a');
  });

  it('chưa cấu hình: tài khoản mặc định như trước; luân phiên theo lần dùng trên máy', () => {
    expect(offlineTransferChoice([B, A], null, null, 100_000, now).accountId).toBe('a');
    const rr = { ...routing, transfer: { ...routing.transfer, strategy: 'round_robin' as const, rules: [] } };
    expect(offlineTransferChoice([A, B, F], rr, null, 100_000, now, { lastUsed: { a: 2000, b: 1000 } }).accountId).toBe('b');
  });
});
