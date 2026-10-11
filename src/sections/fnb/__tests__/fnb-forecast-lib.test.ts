import type { IFnbForecastRow } from 'src/types/fnb';

import { describe, expect, it } from 'vitest';

import { trendOf, draftLines, weekdayText, daysLeftText, needsAttention, groupBySupplier } from '../lib/forecast';

// ----------------------------------------------------------------------

const row = (patch: Partial<IFnbForecastRow>): IFnbForecastRow => ({
  id: 'milk',
  code: 'NL01',
  name: 'Sữa tươi',
  unit: 'ml',
  kind: 'Ingredient',
  onHand: 800,
  usable: 800,
  waste: 0,
  avgDaily: 500,
  weekday: [600, 500, 500, 500, 500, 500, 600],
  last7Daily: 500,
  trend: 1,
  dataDays: 21,
  confidence: 'high',
  daysLeft: 1.6,
  runOutDate: '2026-10-08',
  reorderPoint: 1000,
  onOrder: 0,
  status: 'order',
  suggestedQuantity: 4000,
  purchase: { unitId: 'box', unitName: 'hộp', factor: 1000, quantity: 4, unitPrice: 36_000 },
  makeInHouse: false,
  supplierId: 'mp',
  supplierName: 'Minh Phát',
  estimatedCost: 144_000,
  units: [],
  ...patch,
});

describe('dự báo nhập', () => {
  it('chữ số ngày còn đủ và lượng dùng theo thứ (T2 → CN)', () => {
    expect(daysLeftText(row({}))).toBe('~1,6 ngày');
    expect(daysLeftText(row({ status: 'out', daysLeft: 0 }))).toBe('Đã hết');
    expect(daysLeftText(row({ status: 'idle', daysLeft: null }))).toBe('—');
    expect(weekdayText(row({}))).toBe('T2 500 · T3 500 · T4 500 · T5 500 · T6 500 · T7 600 · CN 600');
  });

  it('xu hướng và dòng cần chú ý', () => {
    expect([trendOf(row({ trend: 1.6 })), trendOf(row({ trend: 0.5 })), trendOf(row({ trend: 1 })), trendOf(row({ trend: null }))]).toEqual([
      'up',
      'down',
      null,
      null,
    ]);
    expect(needsAttention(row({ status: 'ok' }))).toBe(false);
    expect(needsAttention(row({ status: 'ok', waste: 50 }))).toBe(true);
    expect(needsAttention(row({ status: 'ordered' }))).toBe(true);
  });

  it('phiếu nháp: bỏ hàng pha tại quán / không có gợi ý, gom theo nhà cung cấp', () => {
    const lines = draftLines([
      row({}),
      row({ id: 'bean', name: 'Cà phê', supplierId: null, supplierName: null, purchase: { unitId: null, unitName: null, factor: 1, quantity: 2000, unitPrice: 300 } }),
      row({ id: 'brew', makeInHouse: true, purchase: null }),
      row({ id: 'tea', status: 'ok', purchase: null }),
    ]);
    expect(lines.map((l) => [l.productId, l.supplierId, l.quantity, l.unitId, l.unitName])).toEqual([
      ['milk', 'mp', 4, 'box', 'hộp'],
      ['bean', '', 2000, null, 'ml'],
    ]);
    const groups = groupBySupplier(lines);
    expect([...groups.keys()]).toEqual(['mp', '']);
  });
});
