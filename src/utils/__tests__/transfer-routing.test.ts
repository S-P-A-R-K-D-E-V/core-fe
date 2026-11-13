import type { ITransferRouting, IBranchRouting } from 'src/types/online-shop';

import { it, expect, describe } from 'vitest';

import {
  configFor,
  whenText,
  manualPool,
  routingNote,
  planTransfer,
  rankCandidates,
  type RoutingCapability,
} from '../transfer-routing';
import cases from './transfer-routing-cases.json';

// Bộ ca dùng chung với core-be (CoreCms.Tests/Payment/transfer-routing-cases.json) — hai bên phải cho cùng kết quả.

type Case = {
  name: string;
  config: string;
  branchId?: string;
  online?: boolean;
  amount: number;
  nowUtc: string;
  stats?: { lastUsed?: Record<string, string>; received?: Record<string, number> };
  previous?: { accountId: string; ruleId: string | null };
  capabilities?: Record<string, RoutingCapability>;
  plan: string[] | null;
  rule?: string | null;
  ranked?: string[];
};

const id = (s: string) => (s.length === 1 ? `00000000-0000-0000-0000-00000000000${s}` : s);
const mapKeys = <T,>(o: Record<string, T> | undefined) =>
  o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [id(k), v])) : undefined;

const data = cases as unknown as {
  configs: Record<string, ITransferRouting>;
  branches: Record<string, IBranchRouting>;
  cases: Case[];
};

describe('transfer-routing — bộ ca chung với core-be', () => {
  it.each(data.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const { config } = configFor(data.configs[c.config], data.branches, c.branchId);
    const plan = planTransfer(
      config,
      {
        amount: c.amount,
        now: new Date(c.nowUtc),
        previousAccountId: c.previous ? id(c.previous.accountId) : null,
        previousRuleId: c.previous?.ruleId ?? null,
      },
      { lastUsed: mapKeys(c.stats?.lastUsed), received: mapKeys(c.stats?.received) }
    );
    if (c.plan === null) {
      expect(plan).toBeNull();
      return;
    }
    expect(plan?.candidates).toEqual(c.plan.map(id));
    if ('rule' in c) expect(plan?.ruleId ?? null).toBe(c.rule ?? null);
    if (c.ranked) {
      expect(rankCandidates(plan!, mapKeys(c.capabilities), c.online ?? false)).toEqual(c.ranked.map(id));
    }
  });
});

describe('transfer-routing — tiện ích', () => {
  const cfg = data.configs.base;

  it('không có số liệu S Payment: quầy giữ thứ tự, online không có tài khoản', () => {
    const plan = planTransfer(cfg, { amount: 1000, now: new Date('2026-11-11T03:00:00Z') })!;
    expect(rankCandidates(plan, null)).toEqual(plan.candidates);
    expect(rankCandidates(plan, null, true)).toEqual([]);
  });

  it('thu ngân đổi được: danh sách + quy tắc + dự phòng, "any" là mọi tài khoản', () => {
    expect(Array.from(manualPool(cfg)!).sort()).toEqual(['a', 'b', 'c', 'd', 'f'].map(id).sort());
    expect(manualPool({ ...cfg, cashierOverride: 'any' })).toBeNull();
    expect(manualPool(null)).toBeNull();
  });

  it('mô tả điều kiện và ghi chú giống core-be', () => {
    expect(whenText({ amountMin: 5000000 })).toBe('Hoá đơn ≥ 5.000.000đ');
    expect(whenText({ from: '18:00', to: '22:00', days: [6, 0] })).toBe('18:00–22:00 · T7, CN');
    const plan = planTransfer(cfg, { amount: 6000000, now: new Date('2026-11-11T03:00:00Z') })!;
    expect(routingNote(plan, id('d'), 'MB …0068')).toBe('Hoá đơn lớn → MB …0068 · ưu tiên');
  });
});
