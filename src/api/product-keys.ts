// ----------------------------------------------------------------------
// Khoá SWR của danh sách sản phẩm — dùng chung cho hook (src/api/product.ts) và trang server (app/product/page.tsx
// đọc sẵn trang đầu làm fallback). Không import axios để dùng được ở Server Component.
// ----------------------------------------------------------------------

export const SHOP_PAGE_SIZE = 24;

export type ProductListParams = {
  keyword?: string;
  page?: number;
  pageSize?: number;
};

/** "/products?isActive=true&page=1&pageSize=24[&keyword=…]" — danh sách hàng của dashboard (phải đăng nhập). */
export function productListKey(params?: ProductListParams): string {
  const searchParams = new URLSearchParams({
    isActive: 'true',
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? SHOP_PAGE_SIZE),
  });
  if (params?.keyword) searchParams.set('keyword', params.keyword);
  return `/products?${searchParams.toString()}`;
}

/**
 * "/public/storefront/products?page=1&pageSize=24&sort=newest[&q=…]" — trang /product cho khách (không đăng nhập):
 * chỉ giá bán, ảnh, còn/hết hàng; hàng mới trước như trang cũ.
 */
export function storefrontProductListKey(params?: ProductListParams): string {
  const searchParams = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? SHOP_PAGE_SIZE),
    sort: 'newest',
  });
  if (params?.keyword) searchParams.set('q', params.keyword);
  return `/public/storefront/products?${searchParams.toString()}`;
}
