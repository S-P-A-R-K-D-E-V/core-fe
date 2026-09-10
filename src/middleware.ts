import { NextRequest, NextResponse } from 'next/server';

// ----------------------------------------------------------------------

/**
 * Gắn header X-Tenant-Domain = Host của request gốc TRƯỚC KHI next.config.mjs rewrites()
 * proxy sang core-api — core-api tự resolve tenant qua TenantResolutionMiddleware (đã có sẵn từ
 * Track F). Không đụng gì tới rewrites() hiện có; middleware chạy trước rewrite trong pipeline
 * Next.js, header sẽ theo request khi được proxy tiếp.
 *
 * Nhờ vậy 1 build core-fe duy nhất phục vụ được nhiều domain tenant khác nhau
 * (cici21chualang.vn, cici.shop.devbyspark.com, huang.shop.devbyspark.com, ...).
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('X-Tenant-Domain', request.headers.get('host') ?? '');

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
