import { describe, expect, it, vi } from 'vitest';

// ----------------------------------------------------------------------
// Giá trên cửa hàng online: mặc định tiếng Việt → "15.000 ₫" (giống trang đặt hàng), không có số 0 thừa.
// ----------------------------------------------------------------------

// src/locales kéo theo theme (next/font) — vitest không chạy được loader font của Next.
vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'x' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

// eslint-disable-next-line import/first
import { fCurrency } from '../format-number';

// Intl đặt khoảng trắng không ngắt (U+00A0) trước "₫".
const plain = (s: string) => s.replace(/ /g, ' ');

describe('fCurrency', () => {
  it('formats VND the Vietnamese way by default', () => {
    expect(plain(fCurrency(15000))).toBe('15.000 ₫');
    expect(plain(fCurrency(1250000))).toBe('1.250.000 ₫');
  });

  it('keeps a zero price and leaves missing values empty', () => {
    expect(plain(fCurrency(0))).toBe('0 ₫');
    expect(fCurrency(null)).toBe('');
  });
});
