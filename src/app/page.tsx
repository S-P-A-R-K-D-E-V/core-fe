import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { HomeView } from 'src/sections/home/view';
import { isAuthHost } from 'src/auth/utils/saas-host';
import HubLoginPage from 'src/sections/auth/hub/hub-login-page';
import {
  getRequestOrigin,
  getTenantBranding,
  getStorefrontProducts,
} from 'src/lib/tenant-branding';
import {
  absoluteUrl,
  storeJsonLd,
  jsonLdString,
  topCategories,
  storeHomeTitle,
  storeDisplayName,
  storeHomeDescription,
} from 'src/lib/store-seo';
import { activeSeason } from 'src/lib/store-season';

/** Trang đăng nhập chung (auth.devbyspark.com): không phải cửa hàng nào — hiện đăng nhập Spark Store. */
function onAuthHost(): boolean {
  return isAuthHost((headers().get('host') ?? '').toLowerCase());
}

/**
 * Dữ liệu của trang chủ, đọc phía server để HTML trả về đã có sẵn tên cửa hàng, nhóm hàng và sản phẩm thật (công cụ
 * tìm kiếm đọc được, không chờ JavaScript). fetch() trong generateMetadata và trang dùng chung bộ nhớ đệm của Next.
 */
async function loadHome() {
  const [branding, products] = await Promise.all([
    getTenantBranding(),
    getStorefrontProducts(1, 60),
  ]);
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
    absoluteUrl(branding.logoUrl, origin) ??
    absoluteUrl(products.items.find((p) => p.imageUrl)?.imageUrl, origin);

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

type HomePageProps = { searchParams?: Record<string, string | string[] | undefined> };

export default async function HomePage({ searchParams }: HomePageProps) {
  if (onAuthHost()) return <HubLoginPage />;

  const { branding, products, categories, description } = await loadHome();
  // Giao diện mùa lễ (Halloween 20–31/10, Giáng Sinh 1–26/12) — ?season=halloween|christmas để xem trước, ?season=off để tắt.
  const season = activeSeason({ branding, preview: searchParams?.season });
  const jsonLd =
    branding &&
    storeJsonLd({ branding, origin: getRequestOrigin(), description, products: products.items });

  return (
    <>
      {jsonLd && (
        // eslint-disable-next-line react/no-danger
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
        />
      )}
      <HomeView
        branding={branding}
        products={products.items}
        productTotal={products.total}
        categories={categories}
        description={description}
        season={season}
      />
    </>
  );
}
