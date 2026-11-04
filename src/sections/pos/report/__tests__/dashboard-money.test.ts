import { describe, expect, it } from 'vitest';

import { dashboardMoney } from '../dashboard-money';

describe('dashboardMoney', () => {
  it('trừ cả lương: lợi nhuận ròng = lãi gộp − chi phí vận hành của bộ ước tính', () => {
    expect(dashboardMoney(85_000_000, { total: 62_600_000, laborCost: 23_800_000 })).toEqual({
      operatingCost: 62_600_000,
      laborCost: 23_800_000,
      netProfit: 22_400_000,
    });
  });

  it('chưa tải xong chi phí thì chi phí bằng 0, không lỗi', () => {
    expect(dashboardMoney(1_000_000, null)).toEqual({ operatingCost: 0, laborCost: 0, netProfit: 1_000_000 });
    expect(dashboardMoney(undefined, undefined)).toEqual({ operatingCost: 0, laborCost: 0, netProfit: 0 });
  });
});
