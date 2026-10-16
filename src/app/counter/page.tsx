'use client';

import { useEffect } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';
import { SplashScreen } from 'src/components/loading-screen';

import CounterLockView from 'src/sections/counter/counter-lock-view';
import { useCounterDevice } from 'src/sections/counter/counter-device';
import { counterHome, useCounterSession } from 'src/sections/counter/counter-scope';

// ----------------------------------------------------------------------
// Máy quầy trên web: màn chọn nhân viên có ca. Trình duyệt chưa đặt làm máy quầy → hướng dẫn; đã có người đăng nhập ở
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

  if (!device) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, textAlign: 'center' }}>
        <Box sx={{ maxWidth: 480 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Trình duyệt này chưa là máy quầy
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Chủ cửa hàng / quản lý đăng nhập trên chính máy này, vào Cài đặt cửa hàng → Máy quầy → “Đặt trình duyệt này làm
            máy quầy”.
          </Typography>
          <Button variant="contained" onClick={() => router.replace(paths.auth.jwt.login)}>
            Đăng nhập
          </Button>
        </Box>
      </Box>
    );
  }

  return <CounterLockView device={device} onSignedIn={() => router.replace(home)} />;
}
