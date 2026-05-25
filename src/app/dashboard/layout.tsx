'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { AuthGuard, RoleBasedGuard } from 'src/auth/guard';
import { GOOGLE_CLIENT_ID } from 'src/config-global';
import DashboardLayout from 'src/layouts/dashboard';

// ----------------------------------------------------------------------

const DASHBOARD_ROLES = ['Admin', 'Manager', 'Staff'];

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthGuard>
        <RoleBasedGuard hasContent roles={DASHBOARD_ROLES}>
          <DashboardLayout>{children}</DashboardLayout>
        </RoleBasedGuard>
      </AuthGuard>
    </GoogleOAuthProvider>
  );
}
