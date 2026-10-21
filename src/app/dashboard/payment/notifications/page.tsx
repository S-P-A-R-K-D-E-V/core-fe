'use client';

import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import PaymentConnectionsTab from 'src/sections/store-settings/payment-connections-tab';

// ----------------------------------------------------------------------
// Thanh toán → Báo có & kết nối (chủ cửa hàng): đăng ký báo có qua S Payment, kết nối đang dùng.

export default function PaymentNotificationsPage() {
  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <PaymentConnectionsTab />
    </RoleBasedGuard>
  );
}
