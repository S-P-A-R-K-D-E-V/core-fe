import { useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useBoolean } from 'src/hooks/use-boolean';
import { useResponsive } from 'src/hooks/use-responsive';
import { useMobileView } from 'src/hooks/use-mobile-view';
import { SyncNotificationProvider } from 'src/hooks/use-sync-notification';

import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import { ChatbotWidget } from 'src/components/chatbot';
import MessengerProvider from 'src/components/messenger/messenger-provider';
import ProfileCompletionDialog from 'src/components/profile-completion';

import Main from './main';
import Header from './header';
import NavMini from './nav-mini';
import NavBottom from './nav-bottom';
import NavVertical from './nav-vertical';
import NavHorizontal from './nav-horizontal';
import { BOTTOM_NAV } from '../config-layout';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default function DashboardLayout({ children }: Props) {
  const settings = useSettingsContext();

  const lgUp = useResponsive('up', 'lg');

  const nav = useBoolean();

  const { pref, loaded, savePref } = useMobileView();
  const [rememberPref, setRememberPref] = useState(true);

  const isHorizontal = settings.themeLayout === 'horizontal';
  const isMini = settings.themeLayout === 'mini';

  // Show prompt when on small screen and preference not yet saved
  const showMobilePrompt = loaded && !lgUp && pref === null;
  const isMobileView = !lgUp && pref === 'mobile';

  const renderNavMini = <NavMini />;
  const renderHorizontal = <NavHorizontal />;
  const renderNavVertical = <NavVertical openNav={nav.value} onCloseNav={nav.onFalse} />;

  const renderMobilePrompt = (
    <Dialog open={showMobilePrompt} maxWidth="xs" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Iconify icon="solar:smartphone-bold-duotone" width={28} />
          <span>Giao diện mobile</span>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Bạn đang dùng thiết bị màn hình nhỏ. Bạn có muốn chuyển sang giao diện mobile không?
          Giao diện mobile có thanh điều hướng ở dưới để thao tác dễ dàng hơn.
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              checked={rememberPref}
              onChange={(e) => setRememberPref(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Nhớ lựa chọn này</Typography>}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="outlined" size="small" onClick={() => savePref('desktop', rememberPref)}>
          Giao diện đầy đủ
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={<Iconify icon="solar:smartphone-bold" width={18} />}
          onClick={() => savePref('mobile', rememberPref)}
        >
          Giao diện mobile
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Bottom padding to avoid content hidden under bottom nav
  const mobileNavSx = isMobileView ? { pb: `${BOTTOM_NAV.H + 16}px` } : undefined;

  if (isHorizontal) {
    return (
      <SyncNotificationProvider>
        <MessengerProvider>
          <Header onOpenNav={nav.onTrue} />
          {lgUp ? renderHorizontal : renderNavVertical}
          <Main sx={mobileNavSx}>{children}</Main>
          {isMobileView && <NavBottom onOpenMenu={nav.onTrue} />}
          <ChatbotWidget />
          {renderMobilePrompt}
          <ProfileCompletionDialog />
        </MessengerProvider>
      </SyncNotificationProvider>
    );
  }

  if (isMini) {
    return (
      <SyncNotificationProvider>
        <MessengerProvider>
          <Header onOpenNav={nav.onTrue} />
          <Box
            sx={{
              minHeight: 1,
              display: 'flex',
              flexDirection: { xs: 'column', lg: 'row' },
            }}
          >
            {lgUp ? renderNavMini : renderNavVertical}
            <Main sx={mobileNavSx}>{children}</Main>
          </Box>
          {isMobileView && <NavBottom onOpenMenu={nav.onTrue} />}
          <ChatbotWidget />
          {renderMobilePrompt}
          <ProfileCompletionDialog />
        </MessengerProvider>
      </SyncNotificationProvider>
    );
  }

  return (
    <SyncNotificationProvider>
      <MessengerProvider>
        <Header onOpenNav={nav.onTrue} />
        <Box
          sx={{
            minHeight: 1,
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
          }}
        >
          {renderNavVertical}
          <Main sx={mobileNavSx}>{children}</Main>
        </Box>
        {isMobileView && <NavBottom onOpenMenu={nav.onTrue} />}
        <ChatbotWidget />
        {renderMobilePrompt}
        <ProfileCompletionDialog />
      </MessengerProvider>
    </SyncNotificationProvider>
  );
}
