import { headers } from 'next/headers';

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
}

/**
 * Đọc Host của request hiện tại (đã gắn X-Tenant-Domain bởi src/middleware.ts) và gọi thẳng
 * core-api (server-side, không qua rewrites()/browser) để lấy branding đúng tenant. Dùng cho
 * trang chủ (page.tsx, Server Component) — thay nội dung hardcode "CiCi Accessories" cũ.
 */
export async function getTenantBranding(): Promise<TenantBranding | null> {
  const host = headers().get('host') ?? '';
  const backendUrl = process.env.BACKEND_URL || 'http://core-api:5000';

  try {
    const res = await fetch(`${backendUrl}/public/storefront/branding`, {
      headers: { 'X-Tenant-Domain': host },
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;
    return (await res.json()) as TenantBranding;
  } catch {
    return null;
  }
}
