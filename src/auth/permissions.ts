import { getUserRoles } from './roles';

// ----------------------------------------------------------------------
// Mã quyền — trùng Core-be (CoreCms.Domain/Common/PermissionCatalog.cs, kiểm bằng [RequirePermission]). Quyền thật do API
// quyết định; web chỉ ẩn / hiện cho khớp. Danh mục đầy đủ kèm tên tiếng Việt lấy từ GET /permissions/catalog.
// ----------------------------------------------------------------------

export const PERMISSIONS = {
  analytics: {
    dashboard: 'analytics.dashboard.read',
    revenue: 'analytics.revenue.read',
    productSales: 'analytics.product-sales.read',
    customer: 'analytics.customer.read',
    inventory: 'analytics.inventory.read',
    paymentMethod: 'analytics.payment-method.read',
    tax: 'analytics.tax.read',
    expense: 'analytics.expense.read',
    debt: 'analytics.debt.read',
    breakEven: 'analytics.break-even.read',
    financial: 'analytics.financial.read',
    employeeSales: 'analytics.employee-sales.read',
    saleChannel: 'analytics.sale-channel.read',
    /** Xuất Excel — cần thêm quyền xem báo cáo tương ứng. */
    export: 'analytics.export',
  },
} as const;

type PermissionSource = { role?: unknown; roles?: unknown; permissions?: unknown } | null | undefined;

/** Admin (chủ cửa hàng) có mọi quyền — như API (quyền mặc định của Admin là "*"). */
function isOwner(user: PermissionSource): boolean {
  return getUserRoles(user).includes('Admin');
}

/**
 * Quyền đã biết chưa: chủ cửa hàng luôn biết (mọi quyền); người khác cần GET /users/me xong (token không mang quyền).
 * Chưa biết thì màn hình nên chờ thay vì báo "không có quyền".
 */
export function permissionsKnown(user: PermissionSource): boolean {
  return isOwner(user) || Array.isArray(user?.permissions);
}

export function getUserPermissions(user: PermissionSource): string[] {
  return Array.isArray(user?.permissions) ? (user!.permissions as string[]) : [];
}

export function hasPermission(user: PermissionSource, code: string): boolean {
  return isOwner(user) || getUserPermissions(user).includes(code);
}

/** Có MỘT trong các quyền; không khai báo = không giới hạn. */
export function hasAnyPermission(user: PermissionSource, codes: readonly string[] | null | undefined): boolean {
  if (!codes || codes.length === 0) return true;
  return codes.some((code) => hasPermission(user, code));
}

/** Có ĐỦ các quyền; không khai báo = không giới hạn. */
export function hasAllPermissions(user: PermissionSource, codes: readonly string[] | null | undefined): boolean {
  if (!codes || codes.length === 0) return true;
  return codes.every((code) => hasPermission(user, code));
}
