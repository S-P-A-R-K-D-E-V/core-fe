'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

import { GOOGLE_CLIENT_ID } from 'src/config-global';
import AuthClassicLayout from 'src/layouts/auth/classic';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

/** Trang link mời nhân viên: công khai (không GuestGuard — người đang đăng nhập cũng mở được để nhận lời mời). */
export default function Layout({ children }: Props) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthClassicLayout title="Chào mừng bạn vào đội">{children}</AuthClassicLayout>
    </GoogleOAuthProvider>
  );
}
