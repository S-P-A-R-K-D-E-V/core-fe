import type { MetadataRoute } from 'next';

import { isAuthHost, tenantCodeFromHost } from 'src/auth/utils/saas-host';
import { isIndexable, ROBOTS_DISALLOW } from 'src/lib/store-seo';
import { getRequestHost, getRequestOrigin, getTenantBranding } from 'src/lib/tenant-branding';

// ----------------------------------------------------------------------
// robots.txt theo tên miền đang mở (thay public/robots.txt cũ "cho vào tất cả"): cửa hàng cho lập chỉ mục trang
// chủ + sản phẩm, chặn trang quản trị / đăng nhập / API; trang đăng nhập tập trung và cửa hàng mẫu chặn hết.
// Không đọc được branding (core-api lỗi) thì vẫn trả bản cho phép — công cụ tìm kiếm giữ robots.txt cả ngày, không
// được chặn nhầm cửa hàng thật vì một lần lỗi.
// ----------------------------------------------------------------------

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = getRequestHost();
  const branding = await getTenantBranding();
  const tenantCode = branding?.tenantCode ?? tenantCodeFromHost(host);

  if (!isIndexable({ isAuthHost: isAuthHost(host), tenantCode })) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: { userAgent: '*', allow: '/', disallow: ROBOTS_DISALLOW },
    sitemap: `${getRequestOrigin()}/sitemap.xml`,
  };
}
