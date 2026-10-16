// ----------------------------------------------------------------------
// Vai trò cửa hàng — trùng tên với Core-be (SystemRoles / StoreRoles, [Authorize(Roles = ...)]). Quyền thật do API
// quyết định theo token; ở đây chỉ để chọn giao diện cho khớp với những gì API cho phép.
//
// Một người có thể mang nhiều vai trò ở cùng cửa hàng (vd Staff kiêm Admin): `role` chỉ là vai trò "chính" để hiển
// thị, còn API xét đủ danh sách `roles`. Mọi kiểm tra quyền trên web phải gộp cả hai — xem getUserRoles.
// ----------------------------------------------------------------------

export const ADMIN_ROLES: readonly string[] = ['Admin'];

/** Chủ và quản lý (StoreRoles.Managers). */
export const MANAGER_ROLES: readonly string[] = ['Admin', 'Manager'];

/** Mọi nhân viên của cửa hàng (StoreRoles.StoreStaff). */
export const STORE_STAFF_ROLES: readonly string[] = ['Admin', 'Manager', 'Staff'];

type RoleSource = { role?: unknown; roles?: unknown } | null | undefined;

/** Chuẩn hoá một vai trò / danh sách vai trò thành mảng không trùng, bỏ giá trị rỗng. */
export function normalizeRoles(roles: string | readonly string[] | null | undefined): string[] {
  const list = typeof roles === 'string' ? [roles] : roles ?? [];
  return Array.from(new Set(list.filter((r): r is string => typeof r === 'string' && r.length > 0)));
}

/** Mọi vai trò của người dùng ở cửa hàng hiện tại: gộp `roles` (token mang) với `role` (vai trò chính). */
export function getUserRoles(user: RoleSource): string[] {
  if (!user) return [];
  const roles = Array.isArray(user.roles) ? (user.roles as string[]) : [];
  return normalizeRoles([...roles, ...(typeof user.role === 'string' ? [user.role] : [])]);
}

/** `allowed` không khai báo = không giới hạn theo vai trò. So khớp phân biệt hoa thường như API. */
export function hasAnyRole(userRoles: readonly string[], allowed: readonly string[] | null | undefined): boolean {
  if (!allowed) return true;
  return allowed.some((role) => userRoles.includes(role));
}
