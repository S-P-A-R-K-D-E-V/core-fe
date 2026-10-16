import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

// Trang cũ — đã gộp vào Cài đặt cửa hàng → Thiết bị cửa hàng (máy quầy, kiosk, camera).
export default function KioskDevicesPage() {
  redirect(paths.dashboard.storeSettings.devices);
}
