import PlatformFeatureGuard from 'src/auth/guard/platform-feature-guard';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import QrDeviceSetupView from 'src/sections/pos/qr-device/qr-device-setup-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'POS - Máy hiện QR',
};

export default function PosQrDevicePage() {
  return (
    <PlatformFeatureGuard feature={PLATFORM_FEATURES.posSale} label="Bán hàng">
      <QrDeviceSetupView />
    </PlatformFeatureGuard>
  );
}
