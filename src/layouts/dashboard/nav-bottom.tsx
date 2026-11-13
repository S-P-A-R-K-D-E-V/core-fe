'use client';

import { useMemo } from 'react';

import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';

import { useRouter } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';

import { BOTTOM_NAV } from '../config-layout';
import { useNavTree } from './config-navigation';
import { useNavPins, useActiveNavPage } from './nav/use-nav-state';

// ----------------------------------------------------------------------
// Thanh dưới (giao diện mobile): 4 nút đầu là mục đã ghim (của mình, rồi ghim mặc định của vai trò); chưa ghim gì thì
// dùng bộ quen thuộc Kiểm quầy · Chấm công · Lịch làm · Lương. Nút cuối mở ngăn kéo menu.
// ----------------------------------------------------------------------

const DEFAULT_KEYS = ['cash.shift', 'me.checkin', 'me.schedule', 'me.payroll'];

const ICONS: Record<string, string> = {
  'cash.shift': 'solar:wallet-money-bold-duotone',
  'me.checkin': 'solar:clock-circle-bold-duotone',
  'me.schedule': 'solar:calendar-bold-duotone',
  'me.payroll': 'solar:money-bag-bold-duotone',
  'sales.pos': 'solar:cart-large-2-bold-duotone',
};

/** Nhãn ngắn cho nút nhỏ. */
function shortLabel(title: string) {
  return title
    .replace(' của tôi', '')
    .replace('Chấm công vào / ra', 'Chấm công')
    .replace('Màn bán hàng', 'Bán hàng')
    .replace(/\s*\(.+\)$/, '');
}

type Props = {
  onOpenMenu: VoidFunction;
};

export default function NavBottom({ onOpenMenu }: Props) {
  const router = useRouter();
  const tree = useNavTree();
  const pins = useNavPins(tree);
  const active = useActiveNavPage(tree);

  const items = useMemo(() => {
    const visible = new Map(tree.pages.map((p) => [p.key, p]));
    const source = pins.pinned.length
      ? pins.pinned
      : DEFAULT_KEYS.map((k) => visible.get(k)).filter((p): p is NonNullable<typeof p> => !!p);
    return source.slice(0, 4);
  }, [pins.pinned, tree.pages]);

  const activeIndex = items.findIndex((item) => item.key === active?.key);

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === items.length) onOpenMenu();
    else router.push(items[newValue].path);
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
          '& .MuiBottomNavigationAction-label': { fontSize: '0.65rem' },
          '& .MuiBottomNavigationAction-root': { minWidth: 0, px: 0.5 },
        }}
      >
        {items.map((item) => (
          <BottomNavigationAction
            key={item.key}
            label={shortLabel(item.title)}
            icon={<Iconify icon={ICONS[item.key] ?? item.moduleIcon} width={22} />}
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
