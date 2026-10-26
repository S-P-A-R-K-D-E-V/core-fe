import { describe, expect, it, vi } from 'vitest';

// ----------------------------------------------------------------------
// Header trang công khai: khách mua hàng không thấy "Quản lý cửa hàng"; menu toàn tiếng Việt.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({ default: () => null }));

// eslint-disable-next-line import/first
import { mainNav } from '../config-navigation';

const titles = (hasProducts: boolean, authenticated: boolean) =>
  mainNav({ hasProducts, authenticated }).map((i) => i.title);

describe('mainNav', () => {
  it('shows shoppers only the store pages', () => {
    expect(titles(true, false)).toEqual(['Trang chủ', 'Sản phẩm']);
  });

  it('adds the management link for signed-in staff', () => {
    expect(titles(true, true)).toEqual(['Trang chủ', 'Sản phẩm', 'Quản lý cửa hàng']);
  });

  it('hides "Sản phẩm" while the store has no products', () => {
    expect(titles(false, false)).toEqual(['Trang chủ']);
  });
});
