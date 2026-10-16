'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { GOOGLE_CLIENT_ID } from 'src/config-global';
import AuthClassicLayout from 'src/layouts/auth/classic';

import HubLoginView from './hub-login-view';

// ----------------------------------------------------------------------
// Trang gốc của auth.devbyspark.com (và tên miền auth phụ): đăng nhập chung thay cho trang chủ của CiCi.

export default function HubLoginPage() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthClassicLayout>
        <HubLoginView />
      </AuthClassicLayout>
    </GoogleOAuthProvider>
  );
}
