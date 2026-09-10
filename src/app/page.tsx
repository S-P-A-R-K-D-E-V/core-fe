import type { Metadata } from 'next';

import { HomeView } from 'src/sections/home/view';
import { getTenantBranding } from 'src/lib/tenant-branding';

// ----------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
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
  const branding = await getTenantBranding();
  return <HomeView branding={branding} />;
}
