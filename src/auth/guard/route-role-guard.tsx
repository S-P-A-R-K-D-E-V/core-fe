'use client';

import { usePathname } from 'next/navigation';

import RoleBasedGuard from './role-based-guard';
import { requiredRolesFor } from '../route-roles';

// ----------------------------------------------------------------------

/** Chặn theo vai trò ở cấp route cho các trang quản trị (xem ROUTE_ROLE_RULES). */
export default function RouteRoleGuard({ children }: { children: React.ReactNode }) {
  const roles = requiredRolesFor(usePathname());

  if (!roles) return <>{children}</>;

  return (
    <RoleBasedGuard hasContent roles={roles} sx={{ py: 10 }}>
      {children}
    </RoleBasedGuard>
  );
}
