import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { HomeView } from 'src/sections/home/view';
import { isAuthHost } from 'src/auth/utils/saas-host';
import HubLoginPage from 'src/sections/auth/hub/hub-login-page';
import { getRequestOrigin, getTenantBranding, getStorefrontProducts } from 'src/lib/tenant-branding';
import {
  absoluteUrl,
  storeJsonLd,
  jsonLdString,
  topCategories,
  storeHomeTitle,
  storeDisplayName,
  storeHomeDescription,
} from 'src/lib/store-seo';

/** Trang đăng nhập chung (auth.devbyspark.com): không phải cửa hàng nào — hiện đăng nhập Spark Store. */
function onAuthHost(): boolean {
  return isAuthHost((headers().get('host') ?? '').toLowerCase());
}

/**
 * Dữ liệu của trang chủ, đọc phía server để HTML trả về đã có sẵn tên cửa hàng, nhóm hàng và sản phẩm thật (công cụ
 * tìm kiếm đọc được, không chờ JavaScript). fetch() trong generateMetadata và trang dùng chung bộ nhớ đệm của Next.
 */
async function loadHome() {
  const [branding, products] = await Promise.all([getTenantBranding(), getStorefrontProducts(1, 60)]);
  const categories = topCategories(products.items, 6);
  return {
    branding,
    products,
    categories,
    title: storeHomeTitle(branding, categories),
    description: storeHomeDescription(branding, categories, products.total),
  };
}

// ----------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  if (onAuthHost()) return { title: { absolute: 'Đăng nhập — Spark Store' } };

  const { branding, products, title, description } = await loadHome();
  if (!branding) return {};

  const origin = getRequestOrigin();
  const image =
    absoluteUrl(branding.logoUrl, origin) ?? absoluteUrl(products.items.find((p) => p.imageUrl)?.imageUrl, origin);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      url: '/',
      locale: 'vi_VN',
      siteName: storeDisplayName(branding),
      title,
      description,
      ...(image && { images: [{ url: image }] }),
    },
    twitter: { card: 'summary', title, description, ...(image && { images: [image] }) },
  };
}

export default async function HomePage() {
  if (onAuthHost()) return <HubLoginPage />;

  const { branding, products, categories, description } = await loadHome();
  const jsonLd = branding && storeJsonLd({ branding, origin: getRequestOrigin(), description, products: products.items });

  return (
    <>
      {jsonLd && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      )}
      <HomeView
        branding={branding}
        products={products.items}
        productTotal={products.total}
        categories={categories}
        description={description}
      />
    </>
  );
}
