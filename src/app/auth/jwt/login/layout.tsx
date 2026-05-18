'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { GuestGuard } from 'src/auth/guard';
import { GOOGLE_CLIENT_ID } from 'src/config-global';
import AuthClassicLayout from 'src/layouts/auth/classic';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <GuestGuard>
        <AuthClassicLayout>{children}</AuthClassicLayout>
      </GuestGuard>
    </GoogleOAuthProvider>
  );
}
