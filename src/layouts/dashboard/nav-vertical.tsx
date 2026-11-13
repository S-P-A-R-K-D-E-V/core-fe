import { useEffect } from 'react';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';

import { usePathname } from 'src/routes/hooks';

import { useResponsive } from 'src/hooks/use-responsive';

import { NAV } from '../config-layout';
import NavSidebar from './nav/nav-sidebar';
import { useNavTree } from './config-navigation';
import NavToggleButton from '../common/nav-toggle-button';

// ----------------------------------------------------------------------
// Kiểu menu "Thanh bên" (màn ≥ lg) và ngăn kéo menu trên màn nhỏ (mọi kiểu menu).
// ----------------------------------------------------------------------

type Props = {
  openNav: boolean;
  onCloseNav: VoidFunction;
  /** Chỉ dùng ngăn kéo (kiểu "Thanh ngang" / "Thu gọn" trên màn nhỏ). */
  drawerOnly?: boolean;
};

export default function NavVertical({ openNav, onCloseNav, drawerOnly }: Props) {
  const pathname = usePathname();
  const lgUp = useResponsive('up', 'lg');
  const tree = useNavTree();

  useEffect(() => {
    if (openNav) onCloseNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (lgUp && !drawerOnly) {
    return (
      <Box sx={{ flexShrink: 0, width: NAV.W_VERTICAL }}>
        <NavToggleButton />
        <Box
          sx={{
            height: 1,
            position: 'fixed',
            width: NAV.W_VERTICAL,
            borderRight: (theme) => `dashed 1px ${theme.palette.divider}`,
          }}
        >
          <NavSidebar tree={tree} variant="desktop" />
        </Box>
      </Box>
    );
  }

  return (
    <Drawer open={openNav} onClose={onCloseNav} PaperProps={{ sx: { width: NAV.W_VERTICAL } }}>
      <NavSidebar tree={tree} variant="drawer" onNavigate={onCloseNav} />
    </Drawer>
  );
}
