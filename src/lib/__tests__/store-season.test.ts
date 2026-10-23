import { it, expect, describe } from 'vitest';

import { activeSeason, seasonOnDate } from '../store-season';

// Giờ Việt Nam = UTC+7: 30/11 17:00 UTC đã là 1/12 ở Việt Nam.
const utc = (iso: string) => new Date(`${iso}Z`);

describe('seasonOnDate', () => {
  it('Giáng Sinh từ 1/12 đến hết 26/12 theo giờ Việt Nam', () => {
    expect(seasonOnDate(utc('2026-11-30T16:59:00'))).toBeNull();
    expect(seasonOnDate(utc('2026-11-30T17:00:00'))).toBe('christmas');
    expect(seasonOnDate(utc('2026-12-24T12:00:00'))).toBe('christmas');
    expect(seasonOnDate(utc('2026-12-26T16:59:00'))).toBe('christmas');
    expect(seasonOnDate(utc('2026-12-26T17:00:00'))).toBeNull();
    expect(seasonOnDate(utc('2026-10-23T08:00:00'))).toBeNull();
  });
});

describe('activeSeason', () => {
  const christmas = utc('2026-12-20T03:00:00');
  const october = utc('2026-10-23T03:00:00');

  it('bật theo ngày khi cửa hàng chưa tắt (kể cả chưa có branding)', () => {
    expect(activeSeason({ branding: null, now: christmas })).toBe('christmas');
    expect(activeSeason({ branding: { seasonalTheme: true }, now: christmas })).toBe('christmas');
    expect(activeSeason({ branding: {}, now: christmas })).toBe('christmas');
    expect(activeSeason({ branding: null, now: october })).toBeNull();
  });

  it('cửa hàng tắt thì không hiện', () => {
    expect(activeSeason({ branding: { seasonalTheme: false }, now: christmas })).toBeNull();
  });

  it('?season=christmas xem trước bất kể ngày và công tắc; ?season=off tắt; giá trị lạ bỏ qua', () => {
    expect(
      activeSeason({ branding: { seasonalTheme: false }, now: october, preview: 'christmas' })
    ).toBe('christmas');
    expect(activeSeason({ branding: null, now: christmas, preview: 'off' })).toBeNull();
    expect(activeSeason({ branding: null, now: october, preview: ['christmas', 'x'] })).toBe(
      'christmas'
    );
    expect(activeSeason({ branding: null, now: october, preview: 'toString' })).toBeNull();
    expect(activeSeason({ branding: null, now: christmas, preview: 'tet' })).toBe('christmas');
  });
});
