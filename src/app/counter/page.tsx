'use client';

import { useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';
import { SplashScreen } from 'src/components/loading-screen';

import CounterLockView from 'src/sections/counter/counter-lock-view';
import CounterPairPanel from 'src/sections/counter/counter-pair-panel';
import { useCounterDevice } from 'src/sections/counter/counter-device';
import { counterHome, useCounterSession } from 'src/sections/counter/counter-scope';

// ----------------------------------------------------------------------
// Máy quầy trên web: màn chọn nhân viên có ca. Trình duyệt chưa đặt làm máy quầy → hiện mã ghép nối; đã có người đăng nhập ở
// máy quầy → vào thẳng trang bán hàng.
// ----------------------------------------------------------------------

export default function CounterPage() {
  const router = useRouter();
  const device = useCounterDevice();
  const { loading, authenticated, user, logout } = useAuthContext();
  const counterSession = useCounterSession();

  const home = counterHome(user?.enabledFeatures);

  useEffect(() => {
    if (loading || !device || !authenticated) return;
    // Đã đăng nhập ở máy quầy → bán hàng. Phiên thường còn sót trong tab (quản lý vừa đặt máy) → đăng xuất.
    if (counterSession) router.replace(home);
    else logout?.();
  }, [loading, device, authenticated, counterSession, home, router, logout]);

  if (loading || (device && authenticated)) return <SplashScreen />;

  // Chưa là máy quầy: hiện mã để chủ cửa hàng / quản lý duyệt từ web hoặc app; đang ở máy thì đăng nhập đặt nhanh.
  if (!device) {
    const loginThenSetUp = `${paths.auth.jwt.login}?returnTo=${encodeURIComponent(paths.dashboard.storeSettings.devices)}`;
    return <CounterPairPanel onLogin={() => router.replace(loginThenSetUp)} />;
  }

  return <CounterLockView device={device} onSignedIn={() => router.replace(home)} />;
}
