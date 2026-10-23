'use client';

import { useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';
import { hasAnyRole, getUserRoles, MANAGER_ROLES } from 'src/auth/roles';

// Mở mục Thanh toán: chủ + quản lý vào Đối soát; nhân viên vào Đơn online (trang duy nhất họ xem được).
export default function PaymentPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const manager = hasAnyRole(getUserRoles(user), MANAGER_ROLES);

  useEffect(() => {
    router.replace(manager ? paths.dashboard.payment.reconciliation : paths.dashboard.payment.onlineOrders);
  }, [manager, router]);

  return null;
}
