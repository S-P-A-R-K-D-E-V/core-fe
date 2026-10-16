'use client';

import { usePathname } from 'next/navigation';

import RoleBasedGuard from './role-based-guard';
import { requiredRolesFor, requiredPermissionsFor } from '../route-roles';

// ----------------------------------------------------------------------

/** Chặn theo vai trò / quyền ở cấp route cho các trang quản trị (xem ROUTE_ROLE_RULES). */
export default function RouteRoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const roles = requiredRolesFor(pathname);
  const permissions = requiredPermissionsFor(pathname);

  if (!roles && !permissions) return <>{children}</>;

  return (
    <RoleBasedGuard hasContent roles={roles ?? undefined} permissions={permissions ?? undefined} sx={{ py: 10 }}>
      {children}
    </RoleBasedGuard>
  );
}
