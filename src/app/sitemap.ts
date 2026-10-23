import type { MetadataRoute } from 'next';

import { isAuthHost } from 'src/auth/utils/saas-host';
import { getRequestHost, getRequestOrigin, getStorefrontProducts } from 'src/lib/tenant-branding';

// ----------------------------------------------------------------------
// sitemap.xml theo tên miền đang mở: trang chủ, trang sản phẩm và từng sản phẩm đang bán của chính cửa hàng đó.
// URL có dấu "/" cuối (next.config.mjs trailingSlash: true) để không phải chuyển hướng.
// ----------------------------------------------------------------------

const PAGE_SIZE = 60;
const MAX_PAGES = 10;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isAuthHost(getRequestHost())) return [];

  const origin = getRequestOrigin();
  const first = await getStorefrontProducts(1, PAGE_SIZE);
  const pages = Math.min(Math.ceil(first.total / PAGE_SIZE), MAX_PAGES);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => getStorefrontProducts(i + 2, PAGE_SIZE))
  );
  const products = [first, ...rest].flatMap((p) => p.items);

  return [
    { url: `${origin}/`, changeFrequency: 'daily', priority: 1 },
    ...(products.length
      ? [
          { url: `${origin}/product/`, changeFrequency: 'daily' as const, priority: 0.8 },
          ...products.map((p) => ({
            url: `${origin}/product/${p.id}/`,
            changeFrequency: 'weekly' as const,
            priority: 0.6,
          })),
        ]
      : []),
  ];
}
