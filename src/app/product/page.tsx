import type { Metadata } from 'next';

import { ProductShopView } from 'src/sections/product/view';
import { getTenantBranding, getStorefrontProducts } from 'src/lib/tenant-branding';
import { storeKind, storeWords, topCategories, storeDisplayName } from 'src/lib/store-seo';

// ----------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  const [branding, products] = await Promise.all([getTenantBranding(), getStorefrontProducts(1, 60)]);
  const words = storeWords(storeKind(branding));
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

export default function ShopPage() {
  return <ProductShopView />;
}
