import type { StorefrontProduct } from 'src/lib/tenant-branding';

/**
 * 4 ô khối đầu trang chủ. Có danh sách bán chạy (core-be đã xếp hạng): món có ảnh hệ thống lên trước theo thứ hạng, thiếu thì
 * món bán chạy kế tiếp với ảnh giữ chỗ (không bao giờ dùng ảnh KiotViet — API công khai không trả). Chưa có (core-be cũ / lỗi):
 * danh sách thường, cũng ưu tiên món có ảnh như trước.
 */
export function pickHeroProducts(
  bestSellers: StorefrontProduct[] | null | undefined,
  products: StorefrontProduct[],
  count = 4
): StorefrontProduct[] {
  const source = bestSellers?.length ? bestSellers : products;
  return [...source.filter((p) => !!p.imageUrl), ...source.filter((p) => !p.imageUrl)].slice(
    0,
    count
  );
}

/** Bán chạy trước, rồi danh sách thường (bỏ trùng) — thẻ nhóm hàng lấy ảnh / tên món tiêu biểu từ hàng bán chạy trước. */
export function bestSellersFirst(
  bestSellers: StorefrontProduct[] | null | undefined,
  products: StorefrontProduct[]
): StorefrontProduct[] {
  if (!bestSellers?.length) return products;
  const seen = new Set(bestSellers.map((p) => p.id));
  return [...bestSellers, ...products.filter((p) => !seen.has(p.id))];
}
