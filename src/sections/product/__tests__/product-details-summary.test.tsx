import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import type { IProductItem } from 'src/types/product';

// ----------------------------------------------------------------------
// Trang chi tiết sản phẩm của cửa hàng online: giá "15.000 ₫" (không có "0" thừa phía trước), chữ tiếng Việt,
// không hiện màu / size / so sánh / chia sẻ / sao khi không có dữ liệu, "Mua ngay" thêm vào giỏ rồi sang đặt hàng.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'x' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const push = vi.hoisted(() => vi.fn());
vi.mock('src/routes/hooks', () => ({ useRouter: () => ({ push }) }));
vi.mock('src/components/iconify', () => ({ default: () => null }));

// eslint-disable-next-line import/first
import ProductDetailsSummary from '../product-details-summary';

// Đúng dạng mapDetailItem (src/api/product.ts) trả cho một mặt hàng KiotViet.
function makeProduct(overrides: Partial<IProductItem> = {}): IProductItem {
  return {
    id: 'a57b8e74-3123-47ca-878f-9fdc81f87df3',
    name: 'Ghim tăm - GT15',
    code: 'CC003065',
    sku: 'CC003065',
    price: 15000,
    priceSale: 0,
    coverUrl: '/assets/placeholder.svg',
    images: [],
    category: 'PHỤ KIỆN TÓC',
    available: 49,
    quantity: 49,
    inventoryType: 'in_stock',
    publish: 'published',
    description: '',
    subDescription: '',
    createdAt: new Date('2022-06-05T22:23:36Z'),
    gender: 'Men',
    tags: [],
    colors: [],
    sizes: [],
    taxes: 0,
    totalSold: 0,
    totalRatings: 0,
    totalReviews: 0,
    ratings: [],
    reviews: [],
    saleLabel: { enabled: false, content: '' },
    newLabel: { enabled: false, content: '' },
    ...overrides,
  } as IProductItem;
}

const plain = (s: string | null) => (s ?? '').replace(/ /g, ' ');

describe('ProductDetailsSummary (cửa hàng online)', () => {
  beforeEach(() => push.mockClear());

  it('shows the price without a leading zero', () => {
    const { container } = render(<ProductDetailsSummary product={makeProduct()} />);
    const text = plain(container.textContent);
    expect(text).toContain('15.000 ₫');
    expect(text).not.toContain('015.000');
  });

  it('shows Vietnamese labels and the name as the page heading', () => {
    render(<ProductDetailsSummary product={makeProduct()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ghim tăm - GT15' })).toBeTruthy();
    expect(screen.getByText('Còn hàng')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mua ngay' })).toBeTruthy();
  });

  it('hides controls that have no data behind them', () => {
    const { container } = render(<ProductDetailsSummary product={makeProduct()} />);
    const text = container.textContent ?? '';
    // Không lộ số tồn (API công khai chỉ có còn/hết).
    ['Còn 49', 'Màu sắc', 'Kích cỡ', 'Size Chart', 'Compare', 'Favorite', 'Share', 'reviews', 'đánh giá'].forEach((s) =>
      expect(text).not.toContain(s)
    );
    expect(container.querySelector('.MuiRating-root')).toBeNull();
  });

  it('shows the rating once the product has reviews', () => {
    const { container } = render(
      <ProductDetailsSummary product={makeProduct({ totalRatings: 4.5, totalReviews: 12 })} />
    );
    expect(container.querySelector('.MuiRating-root')).not.toBeNull();
    expect(container.textContent).toContain('(12 đánh giá)');
  });

  it('"Mua ngay" adds the item to the cart and opens checkout', async () => {
    const onAddCart = vi.fn();
    const onGotoStep = vi.fn();
    render(
      <ProductDetailsSummary
        product={makeProduct()}
        items={[]}
        onAddCart={onAddCart}
        onGotoStep={onGotoStep}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mua ngay' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/product/checkout'));
    expect(onAddCart).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a57b8e74-3123-47ca-878f-9fdc81f87df3',
        quantity: 1,
        colors: [],
        subTotal: 15000,
      })
    );
    expect(onGotoStep).toHaveBeenCalledWith(0);
  });

  it('keeps the chosen quantity when the same product is reloaded, and adds that many', () => {
    const onAddCart = vi.fn();
    const { rerender } = render(<ProductDetailsSummary product={makeProduct()} items={[]} onAddCart={onAddCart} />);
    const increase = () =>
      screen
        .getAllByRole('button')
        .filter((b) => !['Thêm vào giỏ', 'Mua ngay'].includes(b.textContent ?? ''))
        .at(-1)!;

    fireEvent.click(increase());
    fireEvent.click(increase());
    // SWR tải lại: object mới, cùng nội dung.
    rerender(<ProductDetailsSummary product={makeProduct()} items={[]} onAddCart={onAddCart} />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }));

    expect(onAddCart).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3, subTotal: 45000 }));
  });

  it('blocks buying when the product is out of stock', () => {
    render(
      <ProductDetailsSummary
        product={makeProduct({ available: 0, quantity: 0, inventoryType: 'out_of_stock' })}
      />
    );
    expect(screen.getByText('Hết hàng')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mua ngay' })).toBeDisabled();
  });
});
