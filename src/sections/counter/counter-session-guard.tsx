'use client';

import { useEffect } from 'react';

import { usePathname } from 'next/navigation';

import { useRouter } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';
import { useSnackbar } from 'src/components/snackbar';

import { tokenExpiresAt } from './counter-device';
import { counterHome, COUNTER_LOCK_PATH, isCounterPathAllowed, useCounterSession } from './counter-scope';

// ----------------------------------------------------------------------
// Trong dashboard, khi phiên là phiên máy quầy:
//   - trang ngoài phạm vi bán hàng (gõ URL, link cũ) → về trang bán hàng;
//   - tới giờ phiên hết (hết ca + 30 phút) → đăng xuất về màn chọn tên, kể cả khi trang đang mở yên.
// ----------------------------------------------------------------------

export default function CounterSessionGuard() {
  const counterSession = useCounterSession();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (!counterSession || isCounterPathAllowed(pathname)) return;
    enqueueSnackbar('Máy quầy chỉ dùng cho bán hàng — mở tính năng này trên điện thoại hoặc máy tính cá nhân.', { variant: 'info' });
    router.replace(counterHome(user?.enabledFeatures));
  }, [counterSession, pathname, router, user?.enabledFeatures, enqueueSnackbar]);

  const expiresAt = counterSession ? tokenExpiresAt(user?.accessToken) : null;
  useEffect(() => {
    if (!expiresAt) return undefined;
    const end = async () => {
      enqueueSnackbar('Đã hết phiên trên máy quầy — người tiếp theo chọn tên để đăng nhập.', { variant: 'info' });
      try {
        await logout?.();
      } finally {
        router.replace(COUNTER_LOCK_PATH);
      }
    };
    const left = expiresAt - Date.now();
    if (left <= 0) {
      end();
      return undefined;
    }
    const id = setTimeout(end, Math.min(left, 2 ** 31 - 1));
    return () => clearTimeout(id);
  }, [expiresAt, logout, router, enqueueSnackbar]);

  return null;
}
