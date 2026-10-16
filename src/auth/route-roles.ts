import { paths } from 'src/routes/paths';

import { PERMISSIONS } from './permissions';
import { ADMIN_ROLES, MANAGER_ROLES } from './roles';

// ----------------------------------------------------------------------
// Vai trò cần để mở một trang quản trị trong dashboard — chặn ở cấp route (RouteRoleGuard) cho các trang trước đây chỉ
// được ẩn khỏi menu: gõ thẳng URL vẫn vào được rồi API trả 403 khắp nơi.
//
// Mỗi dòng khớp với menu (config-navigation) VÀ không rộng hơn API (Core-be):
//   - role               : RolesController (sửa danh mục/gán vai trò chỉ Admin)
//   - store-settings     : StoreSettingsController — Admin
//   - notification-config: NotificationConfigController — Admin
//   - shift              : ShiftTemplate/ShiftSchedule — sửa cho Admin, Manager; reminder-rules chỉ Admin
//   - shift-audit        : ShiftAuditController — Admin, Manager
//   - salary, holiday-policy, penalty-policy, payroll/cycles, payroll/batch: theo quyền payroll.* (Core-be Payroll*,
//     mặc định Admin, Manager; vai trò tuỳ chỉnh được cấp thêm) — `permissions`: cần MỘT trong các quyền
//   - user               : UsersController quản trị người khác — Admin, Manager (trừ trang tài khoản của chính mình)
// Trang không có trong danh sách: chỉ cần là nhân viên cửa hàng (guard của app/dashboard/layout.tsx), trang tự chặn
// thêm nếu cần. `roles: null` = mở lại cho mọi nhân viên bên trong một tiền tố đã bị chặn.
// ----------------------------------------------------------------------

export type RouteRoleRule = {
  prefix: string;
  roles: readonly string[] | null;
  /** Cần MỘT trong các quyền (mã Core-be) — trang đã chuyển sang kiểm theo quyền. */
  permissions?: readonly string[];
};

const PAYROLL = PERMISSIONS.payroll;

export const ROUTE_ROLE_RULES: readonly RouteRoleRule[] = [
  { prefix: paths.dashboard.role.root, roles: ADMIN_ROLES },
  { prefix: paths.dashboard.storeSettings.root, roles: ADMIN_ROLES },
  { prefix: paths.dashboard.notificationConfig.root, roles: ADMIN_ROLES },

  { prefix: paths.dashboard.shift.root, roles: MANAGER_ROLES },
  { prefix: paths.dashboard.shift.reminderRules.root, roles: ADMIN_ROLES },
  { prefix: paths.dashboard.shiftAudit.root, roles: MANAGER_ROLES },

  { prefix: paths.dashboard.salary.root, roles: null, permissions: [PAYROLL.salaryConfigRead] },
  { prefix: paths.dashboard.holidayPolicy.root, roles: null, permissions: [PAYROLL.policyManage] },
  { prefix: paths.dashboard.penaltyPolicy.root, roles: null, permissions: [PAYROLL.policyManage] },
  { prefix: paths.dashboard.payroll.cycles, roles: null, permissions: [PAYROLL.recordsRead] },
  { prefix: paths.dashboard.payroll.batch, roles: null, permissions: [PAYROLL.recordsRead] },

  { prefix: paths.dashboard.user.root, roles: MANAGER_ROLES },
  { prefix: paths.dashboard.user.account, roles: null },
  { prefix: paths.dashboard.user.profile, roles: null },
];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Luật khớp `pathname` theo tiền tố dài nhất; null = không có luật. */
export function routeRuleFor(
  pathname: string | null | undefined,
  rules: readonly RouteRoleRule[] = ROUTE_ROLE_RULES
): RouteRoleRule | null {
  if (!pathname) return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  let best: RouteRoleRule | null = null;
  rules.forEach((rule) => {
    if (matches(path, rule.prefix) && (!best || rule.prefix.length > best.prefix.length)) best = rule;
  });
  return best;
}

/** Vai trò cần cho `pathname` theo tiền tố khớp dài nhất; null = không giới hạn thêm. */
export function requiredRolesFor(
  pathname: string | null | undefined,
  rules: readonly RouteRoleRule[] = ROUTE_ROLE_RULES
): readonly string[] | null {
  return routeRuleFor(pathname, rules)?.roles ?? null;
}

/** Quyền cần (MỘT trong các quyền) cho `pathname`; null = không xét quyền. */
export function requiredPermissionsFor(
  pathname: string | null | undefined,
  rules: readonly RouteRoleRule[] = ROUTE_ROLE_RULES
): readonly string[] | null {
  const permissions = routeRuleFor(pathname, rules)?.permissions;
  return permissions?.length ? permissions : null;
}
