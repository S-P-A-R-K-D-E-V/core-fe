'use client';

import { useMemo } from 'react';

import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';

import { useRouter, usePathname } from 'src/routes/hooks';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';
import { PLATFORM_FEATURES, isPlatformFeatureBlocked } from 'src/auth/platform-features';

import Iconify from 'src/components/iconify';

import { BOTTOM_NAV } from '../config-layout';

// ----------------------------------------------------------------------

type NavBottomItem = { label: string; path: string; icon: string; platformFeature?: string };

const NAV_ITEMS: NavBottomItem[] = [
  {
    label: 'Kiểm tiền',
    path: paths.dashboard.shiftCash.root,
    icon: 'solar:wallet-money-bold-duotone',
  },
  {
    label: 'Check-in',
    path: paths.dashboard.attendance.checkin,
    icon: 'solar:clock-circle-bold-duotone',
    platformFeature: PLATFORM_FEATURES.selfCheckIn,
  },
  {
    label: 'Lịch làm',
    path: paths.dashboard.attendance.mySchedule,
    icon: 'solar:calendar-bold-duotone',
  },
  {
    label: 'Lương',
    path: paths.dashboard.payroll.myPayroll,
    icon: 'solar:money-bag-bold-duotone',
  },
];

// ----------------------------------------------------------------------

type Props = {
  onOpenMenu: VoidFunction;
};

export default function NavBottom({ onOpenMenu }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthContext();

  // Chủ cửa hàng tắt tự chấm công trên web với người này → bỏ nút Check-in (chấm công bằng app).
  const blockedKey = ((user?.blockedFeatures as string[] | undefined) ?? []).join('|');
  const items = useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) => !item.platformFeature || !isPlatformFeatureBlocked({ blockedFeatures: blockedKey.split('|') }, item.platformFeature)
      ),
    [blockedKey]
  );

  const activeIndex = items.findIndex((item) => pathname.startsWith(item.path));

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === items.length) {
      onOpenMenu();
    } else {
      router.push(items[newValue].path);
    }
  };

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        display: { lg: 'none' },
      }}
    >
      <BottomNavigation
        value={activeIndex !== -1 ? activeIndex : false}
        onChange={handleChange}
        showLabels
        sx={{
          height: BOTTOM_NAV.H,
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.65rem',
          },
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            px: 0.5,
          },
        }}
      >
        {items.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={<Iconify icon={item.icon} width={22} />}
          />
        ))}
        <BottomNavigationAction
          label="Menu"
          value={items.length}
          icon={<Iconify icon="solar:hamburger-menu-bold" width={22} />}
        />
      </BottomNavigation>
    </Paper>
  );
}
