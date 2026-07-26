import { useMemo, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { usePathname } from 'src/routes/hooks';

import { useBoolean } from 'src/hooks/use-boolean';
import { useResponsive } from 'src/hooks/use-responsive';
import { useNavFavorites } from 'src/hooks/use-nav-favorites';
import { useAuthContext } from 'src/auth/hooks';

import Logo from 'src/components/logo';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { NavSectionVertical } from 'src/components/nav-section';

import { NAV } from '../config-layout';
import NavUpgrade from '../common/nav-upgrade';
import { useNavData } from './config-navigation';
import NavToggleButton from '../common/nav-toggle-button';
import NavFavoritesDialog from './nav-favorites-dialog';
import { buildFavoriteNavItems } from './nav-favorites-utils';

// ----------------------------------------------------------------------

type Props = {
  openNav: boolean;
  onCloseNav: VoidFunction;
};

export default function NavVertical({ openNav, onCloseNav }: Props) {
  const { user } = useAuthContext();

  const pathname = usePathname();

  const lgUp = useResponsive('up', 'lg');

  const navData = useNavData(user?.role);

  const favoritesDialog = useBoolean();
  const { favorites, isFull, toggleFavorite } = useNavFavorites();

  const favoriteItems = useMemo(
    () => buildFavoriteNavItems(navData, favorites),
    [navData, favorites]
  );

  const navDataWithFavorites = useMemo(
    () =>
      favoriteItems.length > 0
        ? [{ subheader: 'Truy cập nhanh', items: favoriteItems }, ...navData]
        : navData,
    [favoriteItems, navData]
  );

  useEffect(() => {
    if (openNav) {
      onCloseNav();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const renderContent = (
    <Scrollbar
      sx={{
        height: 1,
        '& .simplebar-content': {
          height: 1,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 3, ml: 4, mr: 2, mb: 1 }}>
        <Logo />
        <Tooltip title="Chọn truy cập nhanh">
          <IconButton size="small" onClick={favoritesDialog.onTrue}>
            <Iconify icon="eva:star-outline" width={18} />
          </IconButton>
        </Tooltip>
      </Stack>

      <NavSectionVertical
        data={navDataWithFavorites}
        slotProps={{
          currentRole: user?.role,
        }}
      />

      <Box sx={{ flexGrow: 1 }} />

      <NavUpgrade />

      <NavFavoritesDialog
        open={favoritesDialog.value}
        onClose={favoritesDialog.onFalse}
        navData={navData}
        favorites={favorites}
        isFull={isFull}
        onToggle={toggleFavorite}
      />
    </Scrollbar>
  );

  return (
    <Box
      sx={{
        flexShrink: { lg: 0 },
        width: { lg: NAV.W_VERTICAL },
      }}
    >
      <NavToggleButton />

      {lgUp ? (
        <Stack
          sx={{
            height: 1,
            position: 'fixed',
            width: NAV.W_VERTICAL,
            borderRight: (theme) => `dashed 1px ${theme.palette.divider}`,
          }}
        >
          {renderContent}
        </Stack>
      ) : (
        <Drawer
          open={openNav}
          onClose={onCloseNav}
          PaperProps={{
            sx: {
              width: NAV.W_VERTICAL,
            },
          }}
        >
          {renderContent}
        </Drawer>
      )}
    </Box>
  );
}
