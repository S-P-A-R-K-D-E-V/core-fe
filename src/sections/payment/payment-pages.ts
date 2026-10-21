import { paths } from 'src/routes/paths';

import { ADMIN_ROLES, MANAGER_ROLES } from 'src/auth/roles';

// ----------------------------------------------------------------------
// Mục "Thanh toán" (/dashboard/payment/*) — gom mọi tính năng thanh toán về một chỗ: đối soát, đơn online (chủ + quản
// lý), tài khoản ngân hàng nhận tiền và đăng ký báo có / kết nối S Payment (chủ cửa hàng — Core-be chỉ cho Admin).
// Dùng chung cho thanh tab của mục, menu bên trái và luật chặn route.
// ----------------------------------------------------------------------

export type PaymentPage = {
  value: 'reconciliation' | 'online-orders' | 'bank-accounts' | 'notifications';
  path: string;
  title: string;
  icon: string;
  roles: readonly string[];
};

export const PAYMENT_PAGES: readonly PaymentPage[] = [
  {
    value: 'reconciliation',
    path: paths.dashboard.payment.reconciliation,
    title: 'Đối soát',
    icon: 'solar:checklist-minimalistic-bold',
    roles: MANAGER_ROLES,
  },
  {
    value: 'online-orders',
    path: paths.dashboard.payment.onlineOrders,
    title: 'Đơn online',
    icon: 'solar:cart-large-2-bold',
    roles: MANAGER_ROLES,
  },
  {
    value: 'bank-accounts',
    path: paths.dashboard.payment.bankAccounts,
    title: 'Tài khoản ngân hàng',
    icon: 'solar:wallet-money-bold',
    roles: ADMIN_ROLES,
  },
  {
    value: 'notifications',
    path: paths.dashboard.payment.notifications,
    title: 'Báo có & kết nối',
    icon: 'solar:card-transfer-bold',
    roles: ADMIN_ROLES,
  },
];

/** Trang của mục chứa `pathname` (khớp tiền tố). */
export function paymentPageOf(pathname: string | null | undefined): PaymentPage | undefined {
  if (!pathname) return undefined;
  return PAYMENT_PAGES.find((p) => pathname === p.path || pathname.startsWith(`${p.path}/`));
}
