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
//   - payment            : đối soát / đơn online Admin, Manager; payment/bank-accounts, payment/notifications — Admin
//   - notification-config: NotificationConfigController — Admin
//   - shift, shift-audit, shift-pool/pending, shift-swap/pending, attendance/*: theo quyền shift.* / attendance.*
//     (Core-be; mặc định Admin, Manager — nhắc ca chỉ Admin)
//   - salary, holiday-policy, penalty-policy, payroll/cycles, payroll/batch: theo quyền payroll.* (Core-be Payroll*,
//     mặc định Admin, Manager; vai trò tuỳ chỉnh được cấp thêm) — `permissions`: cần MỘT trong các quyền
//   - pos/product/new, pos/category, pos/warehouse, pos/unit-of-measure: theo quyền products.* / inventory.* (Core-be;
//     mặc định Admin, Manager). Danh sách hàng (pos/product/list) mở cho mọi nhân viên; trang sửa hàng tự chặn.
//   - pos/purchase-order, pos/supplier: theo quyền purchase.* / supplier.* (mặc định Admin, Manager); trang sửa đơn nhập,
//     sửa nhà cung cấp tự chặn.
//   - cleaning/assigned (Giao việc & sửa tận gốc): hr.task.manage, inspection.read hoặc corrective-action.manage;
//     cleaning/tasks, templates,
//     week-builder, review, week-overview: theo quyền cleaning.* (mặc định Admin, Manager);
//     checklist của mình mở cho mọi nhân viên
//   - user               : UsersController quản trị người khác — quyền user.* (mặc định Admin, Manager), trừ trang tài
//     khoản của chính mình; trang sửa nhân viên tự chặn
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
const SHIFT = PERMISSIONS.shift;
const ATTENDANCE = PERMISSIONS.attendance;
const PRODUCTS = PERMISSIONS.products;
const CLEANING = PERMISSIONS.cleaning;

export const ROUTE_ROLE_RULES: readonly RouteRoleRule[] = [
  { prefix: paths.dashboard.role.root, roles: ADMIN_ROLES },
  { prefix: paths.dashboard.storeSettings.root, roles: ADMIN_ROLES },
  { prefix: paths.dashboard.news.root, roles: null, permissions: [PERMISSIONS.posts.manage] },
  // Thiết bị cửa hàng: quản lý xem / ghép / thu hồi máy quầy, kiosk của chi nhánh mình (server lọc theo chi nhánh).
  { prefix: paths.dashboard.storeSettings.devices, roles: MANAGER_ROLES },
  // Mẫu in hoá đơn / tem mã: theo quyền sales.print-template.manage (PrintTemplatesController; mặc định Admin, Manager).
  { prefix: paths.dashboard.storeSettings.printTemplates, roles: null, permissions: [PERMISSIONS.sales.printTemplateManage] },
  { prefix: paths.dashboard.notificationConfig.root, roles: ADMIN_ROLES },
  // Thanh toán: đối soát cho chủ và quản lý; đơn online cho mọi nhân viên (OnlineOrdersController — StoreStaff: người
  // đang làm gói hàng); Cài đặt (+ hai trang cũ chuyển về đó) chỉ chủ cửa hàng (PaymentSettingsController,
  // PaymentChannelSettingsController, ShippingSettingsController — Admin).
  { prefix: paths.dashboard.payment.root, roles: MANAGER_ROLES },
  { prefix: paths.dashboard.payment.onlineOrders, roles: null },
  { prefix: paths.dashboard.payment.settings, roles: ADMIN_ROLES },
  { prefix: paths.dashboard.payment.bankAccounts, roles: ADMIN_ROLES },
  { prefix: paths.dashboard.payment.notifications, roles: ADMIN_ROLES },

  { prefix: paths.dashboard.shift.root, roles: null, permissions: [SHIFT.templateManage, SHIFT.scheduleManage] },
  { prefix: paths.dashboard.shift.templates.root, roles: null, permissions: [SHIFT.templateManage] },
  { prefix: paths.dashboard.shift.schedules.root, roles: null, permissions: [SHIFT.scheduleManage] },
  { prefix: paths.dashboard.shift.reminderRules.root, roles: null, permissions: [SHIFT.reminderManage] },
  { prefix: paths.dashboard.shiftAudit.root, roles: null, permissions: [SHIFT.auditRead] },
  { prefix: paths.dashboard.shiftPool.pending, roles: null, permissions: [SHIFT.requestReview] },
  { prefix: paths.dashboard.shiftSwap.pending, roles: null, permissions: [SHIFT.requestReview] },
  { prefix: paths.dashboard.attendance.assignments, roles: null, permissions: [SHIFT.assignmentRead] },
  { prefix: paths.dashboard.attendance.logs, roles: null, permissions: [ATTENDANCE.read] },
  { prefix: paths.dashboard.attendance.report, roles: null, permissions: [ATTENDANCE.read] },
  { prefix: paths.dashboard.attendance.adjust, roles: null, permissions: [ATTENDANCE.adjust] },

  { prefix: paths.dashboard.salary.root, roles: null, permissions: [PAYROLL.salaryConfigRead] },
  { prefix: paths.dashboard.holidayPolicy.root, roles: null, permissions: [PAYROLL.policyManage] },
  { prefix: paths.dashboard.penaltyPolicy.root, roles: null, permissions: [PAYROLL.policyManage] },
  { prefix: paths.dashboard.payroll.cycles, roles: null, permissions: [PAYROLL.recordsRead] },
  { prefix: paths.dashboard.payroll.batch, roles: null, permissions: [PAYROLL.recordsRead] },
  { prefix: paths.dashboard.payroll.complaints, roles: null, permissions: [PAYROLL.complaintReview] },
  { prefix: paths.dashboard.payroll.bonusPrograms, roles: null, permissions: [PAYROLL.bonusProgramManage] },
  { prefix: paths.dashboard.hr.rules, roles: null, permissions: [PERMISSIONS.hr.ruleManage] },

  { prefix: paths.dashboard.pos.product.new, roles: null, permissions: [PRODUCTS.create] },
  { prefix: paths.dashboard.pos.category.root, roles: null, permissions: [PRODUCTS.catalogManage] },
  { prefix: paths.dashboard.pos.unitOfMeasure.root, roles: null, permissions: [PRODUCTS.catalogManage] },
  { prefix: paths.dashboard.pos.warehouse.root, roles: null, permissions: [PERMISSIONS.inventory.warehouseManage] },
  { prefix: paths.dashboard.pos.purchaseOrder.root, roles: null, permissions: [PERMISSIONS.purchase.read] },
  { prefix: paths.dashboard.pos.purchaseOrder.new, roles: null, permissions: [PERMISSIONS.purchase.create] },
  { prefix: paths.dashboard.pos.purchaseOrder.import, roles: null, permissions: [PERMISSIONS.purchase.create] },
  { prefix: paths.dashboard.pos.supplier.root, roles: null, permissions: [PERMISSIONS.supplier.read] },
  { prefix: paths.dashboard.pos.supplier.new, roles: null, permissions: [PERMISSIONS.supplier.manage] },

  {
    prefix: paths.dashboard.cleaning.assigned,
    roles: null,
    permissions: [PERMISSIONS.hr.taskManage, PERMISSIONS.inspection.read, PERMISSIONS.inspection.correctiveActionManage],
  },
  { prefix: paths.dashboard.cleaning.taskLibrary, roles: null, permissions: [CLEANING.templateManage] },
  { prefix: paths.dashboard.cleaning.templates, roles: null, permissions: [CLEANING.templateManage] },
  { prefix: paths.dashboard.cleaning.weekBuilder, roles: null, permissions: [CLEANING.templateManage] },
  { prefix: paths.dashboard.cleaning.review, roles: null, permissions: [CLEANING.read] },
  { prefix: paths.dashboard.cleaning.weekOverview, roles: null, permissions: [CLEANING.read] },

  { prefix: paths.dashboard.user.root, roles: null, permissions: [PERMISSIONS.user.read] },
  { prefix: paths.dashboard.user.new, roles: null, permissions: [PERMISSIONS.user.create] },
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
