import type { IProduct, IProductChild, IProductVariant, IProductListItem } from 'src/types/corecms-api';

import type { LabelSource } from './label-sheet';

// ----------------------------------------------------------------------
// Sản phẩm (dạng của API) → các dòng in tem. Mỗi MÃ HÀNG là một dòng riêng có số tem riêng: hàng có
// biến thể / đơn vị quy đổi thì hàng cha và từng hàng con đều có mã, mã vạch và giá của nó.
// ----------------------------------------------------------------------

type AnyProduct = IProduct | IProductListItem;

const DEFAULT_QUANTITY = 1;

/** Đúng MỘT mã hàng — dùng cho nút "In tem mã" ở dòng chi tiết của một mã. */
export function labelSourceFromProduct(
  product: AnyProduct | IProductChild,
  quantity = DEFAULT_QUANTITY
): LabelSource {
  // Đơn vị tính chỉ có ở chi tiết sản phẩm (IProduct); dòng của danh sách có thì dùng, không thì bỏ trống.
  const extended = product as Partial<IProduct>;
  return {
    key: product.id,
    name: product.fullName || product.name,
    code: product.code,
    barcode: product.barCode || extended.barcode || null,
    price: product.basePrice ?? extended.sellingPrice ?? null,
    unit: extended.unit || extended.unitOfMeasureName || null,
    quantity,
  };
}

function labelSourceFromVariant(variant: IProductVariant, parent: AnyProduct): LabelSource {
  return {
    key: variant.id,
    name: variant.name,
    code: variant.sku,
    barcode: variant.barcode || null,
    price: variant.sellingPrice ?? parent.basePrice ?? null,
    unit: null,
    quantity: DEFAULT_QUANTITY,
  };
}

/**
 * Các dòng in của những sản phẩm đã chọn: hàng cha rồi tới từng hàng con (biến thể, đơn vị quy đổi),
 * mỗi dòng mặc định 1 tem. Hàng con không có mã lẫn mã vạch riêng thì bỏ qua; trùng khoá chỉ lấy một.
 */
export function labelSourcesFromProducts(products: AnyProduct[]): LabelSource[] {
  const sources: LabelSource[] = [];
  const seen = new Set<string>();
  const add = (source: LabelSource) => {
    if (seen.has(source.key)) return;
    seen.add(source.key);
    sources.push(source);
  };

  products.forEach((product) => {
    add(labelSourceFromProduct(product));

    const children = product.childProducts ?? [];
    if (children.length > 0) {
      children
        .filter((child) => child.code || child.barCode)
        .forEach((child) => add(labelSourceFromProduct(child)));
      return;
    }

    // Không có childProducts nhưng API trả thẳng `variants` (schema mới).
    (product.variants ?? [])
      .filter((variant) => variant.sku || variant.barcode)
      .forEach((variant) => add(labelSourceFromVariant(variant, product)));
  });

  return sources;
}
