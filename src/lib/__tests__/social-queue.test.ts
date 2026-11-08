import { it, expect, describe } from 'vitest';

import { addSlot, toDateParam, normalizeSlot, SOCIAL_WEEKDAYS, socialCalendarKey } from '../social';

// ----------------------------------------------------------------------
// Hàng đợi tự rải bài + lịch: chuẩn hoá khung giờ, thứ trong tuần kiểu Việt Nam, tham số ngày của lịch.

describe('social queue helpers', () => {
  it('chuẩn hoá giờ HH:mm, sai dạng thì bỏ', () => {
    expect(normalizeSlot('8:5')).toBe('08:05');
    expect(normalizeSlot(' 20:00 ')).toBe('20:00');
    expect(normalizeSlot('24:00')).toBeNull();
    expect(normalizeSlot('9h')).toBeNull();
  });

  it('thêm khung giờ: bỏ trùng, sắp tăng dần, bỏ giờ sai', () => {
    expect(addSlot(['20:00', '09:00'].sort(), '12:30')).toEqual(['09:00', '12:30', '20:00']);
    expect(addSlot(['09:00'], '9:00')).toEqual(['09:00']);
    expect(addSlot(['09:00'], 'abc')).toEqual(['09:00']);
  });

  it('tuần bắt đầu thứ hai, chủ nhật = 0 như Date.getDay()', () => {
    expect(SOCIAL_WEEKDAYS.map((d) => d.label)).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
    expect(SOCIAL_WEEKDAYS.at(-1)?.value).toBe(0);
  });

  it('tham số ngày của lịch theo giờ máy', () => {
    expect(toDateParam(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(socialCalendarKey('2026-11-09', '2026-11-15')).toBe('/social/calendar?from=2026-11-09&to=2026-11-15');
  });
});
