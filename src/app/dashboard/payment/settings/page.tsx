'use client';

import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import PaymentSettingsView from 'src/sections/payment/view/payment-settings-view';

// ----------------------------------------------------------------------
// Thanh toán → Cài đặt (chủ cửa hàng): phương thức theo kênh POS / Online, bán online & giao hàng, tài khoản ngân hàng,
// báo có & kết nối S Payment — một chỗ cho mọi cấu hình thanh toán.

export default function PaymentSettingsPage() {
  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <PaymentSettingsView />
    </RoleBasedGuard>
  );
}
