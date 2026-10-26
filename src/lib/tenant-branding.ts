import { headers } from 'next/headers';

import { getStorageUrl } from 'src/utils/storage';

import { storefrontProductListKey } from 'src/api/product-keys';

export interface TenantBranding {
  tenantCode: string;
  storeName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  shortDescription: string | null;
  address: string | null;
  messengerLink: string | null;
  zaloLink: string | null;
  contactInfoJson: string | null;
  // core-be cũ không trả các trường dưới.
  /** Loại hình mặc định của cửa hàng: "retail" | "fnb". */
  businessType?: string | null;
  phone?: string | null;
  /** Tiêu đề / mô tả SEO chủ cửa hàng tự đặt — trống thì src/lib/store-seo.ts tự dựng. */
  seoTitle?: string | null;
  seoDescription?: string | null;
  /** Ngành hàng (src/lib/store-industry.ts) — trang chủ đổi câu chữ, màu, biểu tượng theo ngành. */
  industry?: string | null;
  /** Giao diện theo mùa lễ (Giáng Sinh…) trên trang chủ — core-be mặc định true; core-be cũ không trả. */
  seasonalTheme?: boolean;
}

/** Sản phẩm đang bán của cửa hàng (GET /public/storefront/products — không cần đăng nhập). */
export interface StorefrontProduct {
  id: string;
  code: string;
  name: string;
  price: number;
  imageUrl: string | null;
  unit: string | null;
  categoryName: string | null;
  inStock: boolean;
}

export interface StorefrontProductPage {
  items: StorefrontProduct[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface StorefrontProductDetail extends Omit<StorefrontProduct, 'imageUrl'> {
  imageUrls: string[];
  description: string | null;
}

function requestHost(): string {
  return headers().get('host') ?? '';
}

/**
 * Gọi thẳng core-api phía server (không qua rewrites()/browser) với X-Tenant-Domain = Host của request — core-api
 * tự xác định cửa hàng theo tên miền. Lỗi / không có cửa hàng → null.
 */
async function fetchPublic<T>(path: string): Promise<T | null> {
  const backendUrl = process.env.BACKEND_URL || 'http://core-api:5000';

  try {
    const res = await fetch(`${backendUrl}${path}`, {
      headers: { 'X-Tenant-Domain': requestHost() },
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Branding đúng cửa hàng của tên miền đang mở (layout, trang chủ, robots, sitemap, manifest). */
export async function getTenantBranding(): Promise<TenantBranding | null> {
  return fetchPublic<TenantBranding>('/public/storefront/branding');
}

/** Sản phẩm đang bán (có giá) — trang chủ render sẵn phía server để công cụ tìm kiếm đọc được. */
export async function getStorefrontProducts(page = 1, pageSize = 24): Promise<StorefrontProductPage> {
  const data = await fetchPublic<StorefrontProductPage>(`/public/storefront/products?page=${page}&pageSize=${pageSize}`);
  return {
    items: (data?.items ?? []).map((p) => ({ ...p, imageUrl: p.imageUrl ? getStorageUrl(p.imageUrl) : null })),
    total: data?.total ?? 0,
  };
}

/**
 * Trang đầu danh sách /product (GET /public/storefront/products — cùng khoá SWR với useGetStorefrontProducts) để trang
 * render sẵn phía server: công cụ tìm kiếm thấy tên, giá, link từng sản phẩm.
 */
export async function getShopFirstPage(): Promise<StorefrontProductPage | null> {
  return fetchPublic<StorefrontProductPage>(storefrontProductListKey());
}

/** Phương thức thanh toán online cửa hàng đang bật (GET /public/storefront/checkout-config) — lỗi → null. */
export async function getStorefrontPaymentMethods(): Promise<string[] | null> {
  const data = await fetchPublic<{ payments?: { method: string }[] }>('/public/storefront/checkout-config');
  return data ? (data.payments ?? []).map((p) => p.method) : null;
}

export async function getStorefrontProduct(id: string): Promise<StorefrontProductDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const data = await fetchPublic<StorefrontProductDetail>(`/public/storefront/products/${id}`);
  return data && { ...data, imageUrls: (data.imageUrls ?? []).map((u) => getStorageUrl(u)) };
}

/**
 * https://<tên miền đang mở> — gốc cho canonical, og:url, sitemap. Bỏ "www." (middleware đã chuyển www về tên miền gốc;
 * phòng khi request vẫn tới đây). Máy dev (localhost) dùng http.
 */
export function getRequestOrigin(): string {
  const host = (requestHost() || 'localhost:3000').replace(/^www\./i, '');
  const proto = headers().get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https');
  return `${proto.split(',')[0].trim()}://${host}`;
}

export function getRequestHost(): string {
  return requestHost();
}
