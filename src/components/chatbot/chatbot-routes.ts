import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// Nút "mở màn" (khối action kind=navigate) của trợ lý: khoá route của server → trang dashboard web.
//
// Khoá do core-be khai báo trong AssistantRouteCatalog và đặt theo app mobile (schedule, payroll,
// team-schedule…). Web không có đủ từng màn tương ứng, nên ở đây là bảng ánh xạ riêng của web:
//   - chỉ đường dẫn có thật trong src/routes/paths.ts, không bao giờ mở đường dẫn tự do do model viết;
//   - vai trò + tính năng (featureKey) khớp menu (layouts/dashboard/config-navigation) — trang mà menu
//     ẩn với người dùng này thì nút cũng không hiện;
//   - tham số phải đúng khai báo, giá trị chỉ [A-Za-z0-9_-]{1,64} (khớp AssistantBlockPolicy);
//   - khoá không có trang web hợp lý (vd "notifications": web chỉ có chuông ở header) → không có trong
//     bảng → resolveChatbotRoute trả null → không hiện nút.
// Vài màn chi tiết của mobile không có trang chi tiết theo id trên web (phiếu lương, kỳ lương, bảng
// lương một nhân viên): mở trang danh sách chứa nó, tham số vẫn được kiểm nhưng không dùng.
// ----------------------------------------------------------------------

export type ChatbotRouteUser =
  | {
      role?: string | null;
      roles?: string[] | null;
      /** Tính năng đang bật cho cửa hàng (GET /users/me). */
      enabledFeatures?: string[] | null;
    }
  | null
  | undefined;

type WebRouteDef = {
  /** Tham số server khai báo cho khoá này — thiếu / thừa / sai dạng thì không mở. */
  params?: readonly string[];
  /** Vai trò vào được trang đó trên web. */
  roles: readonly string[];
  /** Tính năng của cửa hàng phải đang bật. */
  featureKey?: string;
  path: (params: Record<string, string>) => string;
};

const ALL = ['Admin', 'Manager', 'Staff'] as const;
const MANAGER = ['Admin', 'Manager'] as const;
const ADMIN = ['Admin'] as const;

const SCHEDULING = 'workforce.shift-scheduling';
const ATTENDANCE = 'workforce.attendance';
const PAYROLL = 'payroll.core';
const INVENTORY = 'commerce.retail.inventory';
const POS = 'commerce.retail.pos';

const { dashboard } = paths;

export const CHATBOT_WEB_ROUTES: Readonly<Record<string, WebRouteDef>> = {
  // Mọi nhân viên nội bộ
  schedule: { roles: ALL, featureKey: SCHEDULING, path: () => dashboard.attendance.mySchedule },
  payroll: { roles: ALL, featureKey: PAYROLL, path: () => dashboard.payroll.myPayroll },
  'payroll-detail': {
    params: ['id'],
    roles: ALL,
    featureKey: PAYROLL,
    path: () => dashboard.payroll.myPayroll,
  },
  'shift-register': {
    roles: ALL,
    featureKey: SCHEDULING,
    path: () => dashboard.attendance.shiftRegistration,
  },
  // Web gộp đổi ca + làm hộ vào một trang "Đổi ca & Làm hộ".
  'shift-swap': { roles: ALL, featureKey: SCHEDULING, path: () => dashboard.shiftPool.root },
  'shift-pool': { roles: ALL, featureKey: SCHEDULING, path: () => dashboard.shiftPool.root },
  checkin: { roles: ALL, featureKey: ATTENDANCE, path: () => dashboard.attendance.checkin },
  chat: { roles: ALL, path: () => dashboard.messenger },
  products: { roles: ADMIN, featureKey: INVENTORY, path: () => dashboard.pos.product.list },
  'product-detail': {
    params: ['id'],
    roles: ADMIN,
    featureKey: INVENTORY,
    path: (p) => dashboard.pos.product.edit(p.id),
  },
  pos: { roles: ADMIN, featureKey: POS, path: () => dashboard.pos.sale.root },

  // Quản lý + Admin
  'team-schedule': {
    roles: MANAGER,
    featureKey: ATTENDANCE,
    path: () => dashboard.attendance.assignments,
  },
  // Mobile gom 3 loại yêu cầu vào một màn, tab đầu là chấm công → web mở "Yêu cầu điểm danh".
  approvals: { roles: MANAGER, featureKey: ATTENDANCE, path: () => dashboard.attendance.requests },
  'assign-shift': {
    roles: MANAGER,
    featureKey: ATTENDANCE,
    path: () => dashboard.attendance.assignments,
  },
  'cover-shift': { roles: MANAGER, featureKey: SCHEDULING, path: () => dashboard.shiftPool.root },
  // "Hoá đơn" của mobile là đơn bán hàng (sales-orders) — cùng id với trang chi tiết của web.
  invoices: { roles: ADMIN, featureKey: POS, path: () => dashboard.pos.salesOrder.list },
  'invoice-detail': {
    params: ['id'],
    roles: ADMIN,
    featureKey: POS,
    path: (p) => dashboard.pos.salesOrder.details(p.id),
  },
  'purchase-orders': {
    roles: ADMIN,
    featureKey: INVENTORY,
    path: () => dashboard.pos.purchaseOrder.list,
  },
  'purchase-order-detail': {
    params: ['id'],
    roles: ADMIN,
    featureKey: INVENTORY,
    path: (p) => dashboard.pos.purchaseOrder.details(p.id),
  },

  // Admin
  dashboard: { roles: ADMIN, path: () => dashboard.pos.report.dashboard },
  'revenue-report': { roles: MANAGER, path: () => dashboard.pos.report.revenue },
  'financial-overview': { roles: ADMIN, path: () => dashboard.pos.report.dashboard },
  'break-even-report': { roles: ADMIN, path: () => dashboard.pos.report.breakEven },
  'attendance-report': {
    roles: MANAGER,
    featureKey: ATTENDANCE,
    path: () => dashboard.attendance.report,
  },
  'payroll-cycle': { roles: MANAGER, featureKey: PAYROLL, path: () => dashboard.payroll.cycles },
  // "Bảng lương nhân viên" của web chọn kỳ rồi xem từng nhân viên — chưa mở thẳng theo id được.
  'payroll-cycle-detail': {
    params: ['cycleId'],
    roles: MANAGER,
    featureKey: PAYROLL,
    path: () => dashboard.payroll.batch,
  },
  'payroll-record': {
    params: ['recordId'],
    roles: MANAGER,
    featureKey: PAYROLL,
    path: () => dashboard.payroll.batch,
  },
  users: { roles: MANAGER, path: () => dashboard.user.list },
  'user-detail': {
    params: ['userId'],
    roles: MANAGER,
    path: (p) => dashboard.user.edit(p.userId),
  },
};

const PARAM_VALUE = /^[A-Za-z0-9_-]{1,64}$/;

function hasAnyRole(user: ChatbotRouteUser, roles: readonly string[]): boolean {
  if (!user) return false;
  const mine = [user.role, ...(Array.isArray(user.roles) ? user.roles : [])].filter(
    (r): r is string => typeof r === 'string' && r.length > 0
  );
  return mine.some((r) => roles.includes(r));
}

/** Khoá route + tham số → đường dẫn dashboard nếu người dùng này mở được; không thì null. */
export function resolveChatbotRoute(
  key: unknown,
  params: unknown,
  user: ChatbotRouteUser
): string | null {
  if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(CHATBOT_WEB_ROUTES, key)) {
    return null;
  }
  const def = CHATBOT_WEB_ROUTES[key];
  if (!hasAnyRole(user, def.roles)) return null;
  if (def.featureKey && !(user?.enabledFeatures ?? []).includes(def.featureKey)) return null;

  if (params != null && (typeof params !== 'object' || Array.isArray(params))) return null;
  const given = (params ?? {}) as Record<string, unknown>;
  const declared = def.params ?? [];
  // Tham số lạ → không mở (khớp server: chỉ tham số đã khai báo).
  if (Object.keys(given).some((k) => !declared.includes(k))) return null;

  const values: Record<string, string> = {};
  for (let i = 0; i < declared.length; i += 1) {
    const value = given[declared[i]];
    if (typeof value !== 'string' || !PARAM_VALUE.test(value)) return null;
    values[declared[i]] = value;
  }
  return def.path(values);
}
