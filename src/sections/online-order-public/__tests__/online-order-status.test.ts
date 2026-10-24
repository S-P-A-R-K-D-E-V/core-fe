import { describe, it, expect } from 'vitest';

import { canRepay, cancelledText } from '../online-order-status';

describe('canRepay', () => {
  const now = new Date('2026-10-24T03:00:00Z').getTime();

  it('đơn chờ / hết hạn mã còn trong hạn giữ đơn thì tạo lại mã được', () => {
    expect(canRepay({ status: 'pending_payment', payableUntil: '2026-10-25T02:34:00Z' }, now)).toBe(true);
    expect(canRepay({ status: 'expired', payableUntil: '2026-10-25T02:34:00Z' }, now)).toBe(true);
  });

  it('quá hạn giữ đơn, đã trả hoặc đã huỷ thì không', () => {
    expect(canRepay({ status: 'expired', payableUntil: '2026-10-24T02:00:00Z' }, now)).toBe(false);
    expect(canRepay({ status: 'paid', payableUntil: null }, now)).toBe(false);
    expect(canRepay({ status: 'cancelled', payableUntil: null }, now)).toBe(false);
  });
});

describe('cancelledText', () => {
  it('ghi lý do huỷ theo cách khách hiểu', () => {
    expect(cancelledText('Quá hạn thanh toán')).toContain('(quá hạn thanh toán)');
    expect(cancelledText('Khách huỷ')).toContain('(bạn đã huỷ đơn)');
    expect(cancelledText(null)).toMatch(/^Đơn đã huỷ\. /);
  });
});
