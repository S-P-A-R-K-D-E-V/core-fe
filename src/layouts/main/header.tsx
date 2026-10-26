import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import { useTheme } from '@mui/material/styles';
import Container from '@mui/material/Container';

import { useOffSetTop } from 'src/hooks/use-off-set-top';
import { useResponsive } from 'src/hooks/use-responsive';

import { bgBlur } from 'src/theme/css';

import { useAuthContext } from 'src/auth/hooks';

import Logo from 'src/components/logo';

import NavMobile from './nav/mobile';
import NavDesktop from './nav/desktop';
import { HEADER } from '../config-layout';
import { mainNav } from './config-navigation';
import LoginOrAccount from '../common/login-or-account';
import HeaderShadow from '../common/header-shadow';
import SettingsButton from '../common/settings-button';

// ----------------------------------------------------------------------

type Props = {
  hasProducts?: boolean;
  /** Cửa hàng có bài tin tức đã đăng — hiện mục "Tin tức". */
  hasPosts?: boolean;
  logoUrl?: string | null;
};

export default function Header({ hasProducts = true, hasPosts = false, logoUrl }: Props) {
  const theme = useTheme();

  const mdUp = useResponsive('up', 'md');

  const offsetTop = useOffSetTop(HEADER.H_DESKTOP);

  const { authenticated } = useAuthContext();

  const navData = mainNav({ hasProducts, hasPosts, authenticated });

  return (
    <AppBar>
      <Toolbar
        disableGutters
        sx={{
          height: {
            xs: HEADER.H_MOBILE,
            md: HEADER.H_DESKTOP,
          },
          transition: theme.transitions.create(['height'], {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.shorter,
          }),
          ...(offsetTop && {
            ...bgBlur({
              color: theme.palette.background.default,
            }),
            height: {
              md: HEADER.H_DESKTOP_OFFSET,
            },
          }),
        }}
      >
        <Container sx={{ height: 1, display: 'flex', alignItems: 'center' }}>
          {/* Bỏ nhãn "v5.7.0" của template (link ra docs.minimals.cc) — trang công khai của cửa hàng. */}
          <Logo logoSrc={logoUrl} />

          <Box sx={{ flexGrow: 1 }} />

          {mdUp && <NavDesktop data={navData} />}

          <Stack alignItems="center" direction={{ xs: 'row', md: 'row-reverse' }}>
            {mdUp && <LoginOrAccount />}

            <SettingsButton
              sx={{
                ml: { xs: 1, md: 0 },
                mr: { md: 2 },
              }}
            />

            {!mdUp && <NavMobile data={navData} />}
          </Stack>
        </Container>
      </Toolbar>

      {offsetTop && <HeaderShadow />}
    </AppBar>
  );
}
