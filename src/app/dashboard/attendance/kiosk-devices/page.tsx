import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { KioskDevicesView } from 'src/sections/kiosk-devices/view/kiosk-devices-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Thiết bị cửa hàng',
};

export default function KioskDevicesPage() {
  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <KioskDevicesView />
    </RoleBasedGuard>
  );
}
