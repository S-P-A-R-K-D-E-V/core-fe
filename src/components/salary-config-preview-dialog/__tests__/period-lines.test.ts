import { describe, expect, it } from 'vitest';

import { periodLines } from '../period-lines';

const base = { userId: 'u1', userName: 'Lan', hasActiveConfig: true };
const period = (amount: number, from: string, to: string) => ({ id: `${amount}`, salaryType: 'Hourly', amount, from, to });

describe('periodLines', () => {
  it('lists every rate when the cycle has an old and a new rate', () => {
    const item = { ...base, periodConfigs: [period(22000, '2026-10-01', '2026-10-15'), period(25500, '2026-10-16', '2026-10-31')] };
    expect(periodLines(item)?.map((p) => p.amount)).toEqual([22000, 25500]);
  });

  it('keeps the single-rate display when the cycle has one rate or no period data', () => {
    expect(periodLines({ ...base, periodConfigs: [period(22000, '2026-10-01', '2026-10-31')] })).toBeNull();
    expect(periodLines(base)).toBeNull();
  });
});
