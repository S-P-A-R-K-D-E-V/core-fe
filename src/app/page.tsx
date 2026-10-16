import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { HomeView } from 'src/sections/home/view';
import { isAuthHost } from 'src/auth/utils/saas-host';
import { getTenantBranding } from 'src/lib/tenant-branding';
import HubLoginPage from 'src/sections/auth/hub/hub-login-page';

/** Trang đăng nhập chung (auth.devbyspark.com): không phải cửa hàng nào — hiện đăng nhập Spark Store. */
function onAuthHost(): boolean {
  return isAuthHost((headers().get('host') ?? '').toLowerCase());
}

// ----------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  if (onAuthHost()) return { title: { absolute: 'Đăng nhập — Spark Store' } };
  const branding = await getTenantBranding();
  const storeName = branding?.storeName ?? 'CiCi Accessories';

  return {
    title: `${storeName} — Hệ thống quản lý nội bộ`,
    description:
      branding?.shortDescription ??
      'Nền tảng quản lý nội bộ dành cho hệ thống cửa hàng. Quản lý ca, chấm công, kiểm tiền ca, bán hàng POS, kho hàng và lương.',
  };
}

export default async function HomePage() {
  if (onAuthHost()) return <HubLoginPage />;
  const branding = await getTenantBranding();
  return <HomeView branding={branding} />;
}
