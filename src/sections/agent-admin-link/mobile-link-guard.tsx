'use client';

import { STORE_STAFF_ROLES } from 'src/auth/roles';
import { AuthGuard, RoleBasedGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------
// Trang /m/* (link ngắn mở từ tin nhắn ngoài, vd Zalo Bot): cần đăng nhập như dashboard — chưa đăng nhập thì sang trang
// đăng nhập kèm returnTo rồi quay lại — nhưng không có khung dashboard.
// ----------------------------------------------------------------------

export default function MobileLinkGuard({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RoleBasedGuard hasContent roles={STORE_STAFF_ROLES}>
        {children}
      </RoleBasedGuard>
    </AuthGuard>
  );
}
