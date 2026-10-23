import type { Metadata } from 'next';

import axios, { endpoints } from 'src/utils/axios';

import ProductShopDetailsView from 'src/sections/product/view/product-shop-details-view';
import { getRequestOrigin, getTenantBranding, getStorefrontProduct } from 'src/lib/tenant-branding';
import {
  absoluteUrl,
  jsonLdString,
  productJsonLd,
  storeDisplayName,
  productDescription,
} from 'src/lib/store-seo';

// ----------------------------------------------------------------------

type Props = {
  params: {
    id: string;
  };
};

// Tiêu đề / mô tả / ảnh theo đúng sản phẩm (đọc phía server từ /public/storefront/products/{id}); sản phẩm không
// bán trên trang (ngừng bán, chưa có giá) thì giữ tiêu đề chung và không cho lập chỉ mục.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [branding, product] = await Promise.all([getTenantBranding(), getStorefrontProduct(params.id)]);
  if (!product) return { title: 'Sản phẩm', robots: { index: false, follow: true } };

  const origin = getRequestOrigin();
  const description = productDescription(product, storeDisplayName(branding));
  const images = product.imageUrls.map((u) => absoluteUrl(u, origin)).filter((u): u is string => !!u);

  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${product.id}/` },
    openGraph: {
      type: 'website',
      url: `/product/${product.id}/`,
      locale: 'vi_VN',
      siteName: storeDisplayName(branding),
      title: product.name,
      description,
      ...(images.length && { images: images.slice(0, 4).map((url) => ({ url, alt: product.name })) }),
    },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title: product.name, description },
  };
}

export default async function ProductShopDetailsPage({ params }: Props) {
  const { id } = params;
  const [branding, product] = await Promise.all([getTenantBranding(), getStorefrontProduct(id)]);
  const storeName = storeDisplayName(branding);

  return (
    <>
      {product && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: jsonLdString(
              productJsonLd({
                product,
                origin: getRequestOrigin(),
                storeName,
                description: productDescription(product, storeName),
              })
            ),
          }}
        />
      )}
      <ProductShopDetailsView id={id} />
    </>
  );
}

// Commented out to avoid build-time API call
// export async function generateStaticParams() {
//   const res = await axios.get(endpoints.product.list);
//
//   return res.data.products.map((product: { id: string }) => ({
//     id: product.id,
//   }));
// }
