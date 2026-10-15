import type { IProductChild, IProductListItem } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Tiện ích thuần của màn bán hàng (POS bán lẻ): quét mã vạch / gõ mã rồi Enter, ô số lượng.
// ----------------------------------------------------------------------

export type ScannedProduct = { product: IProductListItem; child?: IProductChild };

const same = (a: string | null | undefined, code: string) => !!a && a.trim().toLowerCase() === code;

/**
 * Mã quét / gõ + Enter khớp ĐÚNG mã hàng, SKU hoặc mã vạch của một sản phẩm (hoặc một phiên bản con — thêm thẳng phiên
 * bản đó). Không khớp đúng mà kết quả tìm chỉ có một sản phẩm → lấy sản phẩm đó. Còn lại: null (để thu ngân chọn).
 */
export function findScannedProduct(
  items: IProductListItem[],
  rawCode: string
): ScannedProduct | null {
  const code = rawCode.trim().toLowerCase();
  if (!code) return null;

  const matchesCode = (p: { code?: string; sku?: string; barCode?: string; barcode?: string }) =>
    same(p.code, code) || same(p.sku, code) || same(p.barCode, code) || same(p.barcode, code);

  const childMatches: ScannedProduct[] = [];
  for (const product of items) {
    for (const child of product.childProducts ?? []) {
      if (matchesCode(child)) childMatches.push({ product, child });
    }
  }
  // Mã của phiên bản con cụ thể hơn mã sản phẩm cha.
  if (childMatches.length === 1) return childMatches[0];

  const exact = items.filter(matchesCode);
  if (exact.length === 1) return { product: exact[0] };

  if (childMatches.length === 0 && exact.length === 0 && items.length === 1)
    return { product: items[0] };
  return null;
}

/** Ô số lượng: chỉ nhận số nguyên ≥ 1; ô trống / 0 trong lúc gõ không xoá dòng hàng (xoá bằng nút thùng rác). */
export function parseQuantityInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n >= 1 ? n : null;
}
