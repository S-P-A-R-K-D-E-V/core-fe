import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { PosSaleView } from 'src/sections/pos/sale/view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'POS - Bán hàng',
};

export default function PosSalePage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.posSale} label="Bán hàng">
      <PosSaleView />
    </PlatformFeatureGuard>
  );
}
