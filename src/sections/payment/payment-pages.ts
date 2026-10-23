import { paths } from 'src/routes/paths';

import { ADMIN_ROLES, MANAGER_ROLES, STORE_STAFF_ROLES } from 'src/auth/roles';

// ----------------------------------------------------------------------
// Mục "Thanh toán" (/dashboard/payment/*) — gom mọi tính năng thanh toán về một chỗ: đối soát (chủ + quản lý), đơn online
// (mọi nhân viên — người đang làm nhận thông báo "đơn đã thanh toán" và gói hàng từ đây), Cài đặt (chủ cửa hàng: phương
// thức theo kênh POS / Online, bán online & giao hàng, tài khoản ngân hàng, báo có & kết nối S Payment).
// Dùng chung cho thanh tab của mục, menu bên trái và luật chặn route.
// ----------------------------------------------------------------------

export type PaymentPage = {
  value: 'reconciliation' | 'online-orders' | 'settings';
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
    roles: STORE_STAFF_ROLES,
  },
  {
    value: 'settings',
    path: paths.dashboard.payment.settings,
    title: 'Cài đặt',
    icon: 'solar:settings-bold',
    roles: ADMIN_ROLES,
  },
];

/** Tab trong trang Cài đặt (?tab=...). */
export type PaymentSettingsTab = 'channels' | 'online' | 'accounts' | 'connections';

export const PAYMENT_SETTINGS_TABS: readonly { value: PaymentSettingsTab; label: string; icon: string }[] = [
  { value: 'channels', label: 'Phương thức theo kênh', icon: 'solar:checklist-bold' },
  { value: 'online', label: 'Bán online & giao hàng', icon: 'solar:delivery-bold' },
  { value: 'accounts', label: 'Tài khoản ngân hàng', icon: 'solar:wallet-money-bold' },
  { value: 'connections', label: 'Báo có & kết nối', icon: 'solar:card-transfer-bold' },
];

export function paymentSettingsTabOf(value: string | null | undefined): PaymentSettingsTab {
  return PAYMENT_SETTINGS_TABS.find((t) => t.value === value)?.value ?? 'channels';
}

export function paymentSettingsHref(tab: PaymentSettingsTab): string {
  return `${paths.dashboard.payment.settings}?tab=${tab}`;
}

/** Trang của mục chứa `pathname` (khớp tiền tố). */
export function paymentPageOf(pathname: string | null | undefined): PaymentPage | undefined {
  if (!pathname) return undefined;
  return PAYMENT_PAGES.find((p) => pathname === p.path || pathname.startsWith(`${p.path}/`));
}
