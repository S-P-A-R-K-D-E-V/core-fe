import type { Metadata } from 'next';

import { SWRConfig } from 'swr';

import ProductShopView from 'src/sections/product/view/product-shop-view';
import { storefrontProductListKey } from 'src/api/product-keys';
import { getShopFirstPage, getTenantBranding, getStorefrontProducts } from 'src/lib/tenant-branding';
import { storeIndustry } from 'src/lib/store-industry';
import { topCategories, storeDisplayName } from 'src/lib/store-seo';

// ----------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  const [branding, products] = await Promise.all([getTenantBranding(), getStorefrontProducts(1, 60)]);
  const { words } = storeIndustry(branding);
  const name = storeDisplayName(branding);
  const categories = topCategories(products.items, 4);

  return {
    title: words.items,
    description: categories.length
      ? `${words.items} của ${name}: ${categories.join(', ')}. Xem giá và tình trạng còn hàng.`
      : `${words.items} của ${name} — xem giá và tình trạng còn hàng.`,
    alternates: { canonical: '/product/' },
  };
}

// Trang đầu danh sách đọc sẵn phía server làm dữ liệu ban đầu của SWR (cùng khoá với useGetStorefrontProducts): HTML trả về đã có
// tiêu đề h1, tên, giá và link từng sản phẩm — công cụ tìm kiếm không chạy JavaScript vẫn đọc được.
export default async function ShopPage() {
  const [branding, firstPage] = await Promise.all([getTenantBranding(), getShopFirstPage()]);
  const { words } = storeIndustry(branding);

  return (
    <SWRConfig value={{ fallback: firstPage ? { [storefrontProductListKey()]: firstPage } : {} }}>
      <ProductShopView title={`${words.items} của ${storeDisplayName(branding)}`} />
    </SWRConfig>
  );
}
