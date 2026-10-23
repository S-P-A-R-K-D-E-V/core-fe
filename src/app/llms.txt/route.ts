import { storeLlmsTxt } from 'src/lib/store-seo';
import { isAuthHost } from 'src/auth/utils/saas-host';
import { getRequestHost, getRequestOrigin, getTenantBranding, getStorefrontProducts } from 'src/lib/tenant-branding';

// ----------------------------------------------------------------------
// /llms.txt theo tên miền đang mở (llmstxt.org) — bản tóm tắt cửa hàng cho trợ lý / công cụ tìm kiếm AI. Trang đăng nhập
// tập trung và tên miền không đọc được cửa hàng: 404.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export async function GET() {
  if (isAuthHost(getRequestHost())) return new Response('Not found', { status: 404 });

  const [branding, products] = await Promise.all([getTenantBranding(), getStorefrontProducts(1, 60)]);
  if (!branding) return new Response('Not found', { status: 404 });

  const body = storeLlmsTxt({ branding, origin: getRequestOrigin(), products: products.items, total: products.total });
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
