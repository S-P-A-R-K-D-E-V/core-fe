import { useMemo } from 'react';

import { useAuthContext } from 'src/auth/hooks';
import { getUserRoles } from 'src/auth/roles';
import { PERMISSIONS, hasAllPermissions } from 'src/auth/permissions';

// ----------------------------------------------------------------------
// Quyền ở trang Nhân viên — khớp Core-be UsersController (user.*). Tài khoản chủ cửa hàng (Admin) chỉ Admin sửa / khoá /
// đặt lại mật khẩu / xoá được, gán vai trò chỉ Admin — luật theo vai trò, không theo quyền. Quyền thật do API quyết định.
// ----------------------------------------------------------------------

type AccessSource = Parameters<typeof hasAllPermissions>[0];

const U = PERMISSIONS.user;

export type UserAccess = {
  canCreate: boolean;
  canUpdate: boolean;
  canChangeStatus: boolean;
  canResetPassword: boolean;
  canDelete: boolean;
  /** Chủ cửa hàng — gán vai trò, đụng tài khoản Admin, thêm quản lý. */
  isOwner: boolean;
};

export function userAccessFor(user: AccessSource): UserAccess {
  const can = (code: string) => hasAllPermissions(user, [U.read, code]);
  return {
    canCreate: can(U.create),
    canUpdate: can(U.update),
    canChangeStatus: can(U.status),
    canResetPassword: can(U.passwordReset),
    canDelete: can(U.delete),
    isOwner: getUserRoles(user).includes('Admin'),
  };
}

export function useUserAccess(): UserAccess {
  const { user } = useAuthContext();
  return useMemo(() => userAccessFor(user), [user]);
}

/** Thao tác trên tài khoản người khác: có quyền, và tài khoản Admin thì chỉ Admin. */
export function canActOn(access: UserAccess, allowed: boolean, targetRoles: readonly string[] | null | undefined): boolean {
  return allowed && (access.isOwner || !(targetRoles ?? []).includes('Admin'));
}
