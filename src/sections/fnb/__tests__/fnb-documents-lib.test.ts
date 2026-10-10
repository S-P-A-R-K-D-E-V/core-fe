import { describe, expect, it } from 'vitest';

import { factorOf, biggestUnit, countParts, baseQuantity } from '../lib/documents';

// ----------------------------------------------------------------------

const can = { unitId: 'can', name: 'hộp', factor: 380 };
const box = { unitId: 'box', name: 'thùng', factor: 4560 };

describe('quy đổi đơn vị', () => {
  it('đơn vị gốc = 1, đơn vị mua theo hệ số, đơn vị lạ = null', () => {
    expect(factorOf([can], null)).toBe(1);
    expect(factorOf([can], 'can')).toBe(380);
    expect(factorOf([can], 'x')).toBeNull();
  });

  it('2 hộp + 150 ml = 910 ml', () => {
    expect(baseQuantity([can], [{ unitId: 'can', quantity: 2 }, { unitId: null, quantity: 150 }])).toBe(910);
  });

  it('đơn vị lớn nhất cho ô nhập thứ nhất', () => {
    expect(biggestUnit([can, box])).toEqual(box);
    expect(biggestUnit([])).toBeNull();
  });
});

describe('ô nhập số đếm', () => {
  it('hai ô → hai phần; một ô → một phần; số 0 vẫn là đã đếm', () => {
    expect(countParts(can, '2', '150')).toEqual([
      { unitId: 'can', quantity: 2 },
      { unitId: null, quantity: 150 },
    ]);
    expect(countParts(can, '', '1,5')).toEqual([{ unitId: null, quantity: 1.5 }]);
    expect(countParts(null, '', '0')).toEqual([{ unitId: null, quantity: 0 }]);
  });

  it('cả hai trống = chưa đếm (null); số âm / chữ = lỗi (undefined)', () => {
    expect(countParts(can, '', '')).toBeNull();
    expect(countParts(can, '-1', '')).toBeUndefined();
    expect(countParts(null, '', 'abc')).toBeUndefined();
  });
});
