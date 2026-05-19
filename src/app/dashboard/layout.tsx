'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { AuthGuard } from 'src/auth/guard';
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
        <DashboardLayout>{children}</DashboardLayout>
      </AuthGuard>
    </GoogleOAuthProvider>
  );
}
