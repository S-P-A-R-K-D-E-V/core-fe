'use client';

import { useEffect } from 'react';

import { usePathname } from 'src/routes/hooks';

import { captureSocialRef } from 'src/lib/social-ref';

// ----------------------------------------------------------------------
// Khách mở link từ bài đăng mạng xã hội (…?r=mã) → nhớ mã để gửi kèm khi đặt đơn online.

export function SocialRefCapture() {
  const pathname = usePathname();
  useEffect(() => {
    captureSocialRef(window.location.search);
  }, [pathname]);
  return null;
}
