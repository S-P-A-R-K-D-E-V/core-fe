import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { KioskDevicesView } from 'src/sections/kiosk-devices/view/kiosk-devices-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Thiết bị cửa hàng',
};

// Máy quầy (app / web), kiosk chấm công, camera — chủ cửa hàng + quản lý (quản lý chỉ thiết bị chi nhánh mình).
export default function StoreDevicesPage() {
  return (
    <RoleBasedGuard hasContent roles={['Admin', 'Manager']}>
      <KioskDevicesView />
    </RoleBasedGuard>
  );
}
