'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { STORE_STAFF_ROLES } from 'src/auth/roles';
import { AuthGuard, RouteRoleGuard, RoleBasedGuard } from 'src/auth/guard';
import { GOOGLE_CLIENT_ID } from 'src/config-global';
import DashboardLayout from 'src/layouts/dashboard';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthGuard>
        <RoleBasedGuard hasContent roles={STORE_STAFF_ROLES}>
          <DashboardLayout>
            <RouteRoleGuard>{children}</RouteRoleGuard>
          </DashboardLayout>
        </RoleBasedGuard>
      </AuthGuard>
    </GoogleOAuthProvider>
  );
}
