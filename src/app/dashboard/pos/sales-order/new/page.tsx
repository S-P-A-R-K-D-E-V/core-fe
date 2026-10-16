import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { SalesOrderCreateView } from 'src/sections/pos/sales-order/view';

export const metadata = { title: 'Tạo đơn bán hàng' };

export default function SalesOrderCreatePage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.posSale} label="Bán hàng">
      <SalesOrderCreateView />
    </PlatformFeatureGuard>
  );
}
