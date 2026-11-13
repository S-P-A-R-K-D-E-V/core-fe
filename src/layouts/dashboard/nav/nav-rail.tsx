'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Popper from '@mui/material/Popper';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import { useTheme, alpha } from '@mui/material/styles';
import ClickAwayListener from '@mui/material/ClickAwayListener';

import { usePathname } from 'src/routes/hooks';

import Logo from 'src/components/logo';
import Iconify from 'src/components/iconify';

import NavPageRow from './nav-page-row';
import { NAV } from '../../config-layout';
import NavModuleContent from './nav-module-content';
import { useNavPins, useActiveNavPage } from './use-nav-state';

import type { NavTree, NavModule } from './nav-types';

// ----------------------------------------------------------------------
// Thanh bên thu gọn: cột icon module (88px); bấm / rê → flyout cấp 2–3 bên phải. ★ đầu cột = Ghim & gần đây.
// ----------------------------------------------------------------------

const PINS = '__pins';

export default function NavRail({ tree, footer }: { tree: NavTree; footer?: React.ReactNode }) {
  const theme = useTheme();
  const pathname = usePathname();
  const active = useActiveNavPage(tree);
  const pins = useNavPins(tree);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setOpenKey(null);
  }, [pathname]);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const modules = [
    ...tree.modules,
    ...(tree.settings ? [tree.settings] : []),
    ...(tree.me ? [tree.me] : []),
  ];
  const openModule = modules.find((m) => m.key === openKey) ?? null;

  const open = (key: string, el: HTMLElement) => {
    setAnchor(el);
    setOpenKey(key);
  };

  const railButton = (key: string, icon: string, label: string, current: boolean) => (
    <ButtonBase
      key={key}
      aria-haspopup="true"
      aria-expanded={openKey === key}
      onClick={(e) => (openKey === key ? setOpenKey(null) : open(key, e.currentTarget))}
      onMouseEnter={(e) => {
        if (!openKey || openKey === key) return;
        const el = e.currentTarget;
        clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => open(key, el), 120);
      }}
      onMouseLeave={() => clearTimeout(hoverTimer.current)}
      sx={{
        width: 1,
        py: 1,
        gap: 0.5,
        flexDirection: 'column',
        borderRadius: 1.5,
        color: current ? 'primary.main' : 'text.secondary',
        ...(current && { bgcolor: alpha(theme.palette.primary.main, 0.08) }),
        ...(openKey === key && { bgcolor: 'action.hover', color: 'text.primary' }),
        '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
      }}
    >
      <Iconify icon={icon} width={22} />
      <Typography
        variant="caption"
        sx={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );

  const renderModuleButton = (m: NavModule) =>
    railButton(m.key, m.icon, m.title, active?.moduleKey === m.key);

  return (
    <Box
      ref={railRef}
      sx={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        width: NAV.W_MINI,
        borderRight: `dashed 1px ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        px: 1,
        pb: 2,
      }}
    >
      <Logo sx={{ mx: 'auto', my: 2 }} />
      <Stack spacing={0.5}>
        {!tree.counter && railButton(PINS, 'solar:star-bold-duotone', 'Ghim', false)}
        {tree.modules.map(renderModuleButton)}
        {(tree.settings || tree.me) && (
          <Box sx={{ my: 1, borderTop: `dashed 1px ${theme.palette.divider}` }} />
        )}
        {tree.settings && renderModuleButton(tree.settings)}
        {tree.me && renderModuleButton(tree.me)}
      </Stack>
      <Box sx={{ flexGrow: 1 }} />
      {footer}

      <Popper
        open={!!openKey}
        anchorEl={anchor}
        placement="right-start"
        sx={{ zIndex: theme.zIndex.drawer + 2 }}
      >
        <ClickAwayListener
          onClickAway={(e) => {
            if (railRef.current?.contains(e.target as Node)) return;
            setOpenKey(null);
          }}
        >
          <Paper
            sx={{
              ml: 1.5,
              p: 1.5,
              width: 300,
              maxHeight: 'calc(100vh - 32px)',
              overflowY: 'auto',
              boxShadow: theme.customShadows?.dropdown ?? theme.shadows[8],
            }}
          >
            {openKey === PINS ? (
              <>
                <Typography variant="subtitle1" sx={{ px: 1, pb: 1 }}>
                  Ghim & gần đây
                </Typography>
                {pins.pinned.length === 0 && (
                  <Typography variant="body2" sx={{ px: 1, color: 'text.secondary' }}>
                    Bấm ★ cạnh một trang để ghim.
                  </Typography>
                )}
                {pins.pinned.map((page) => (
                  <NavPageRow
                    key={page.key}
                    page={page}
                    icon={page.moduleIcon}
                    pins={pins}
                    active={active?.key === page.key}
                  />
                ))}
                {pins.recent.length > 0 && (
                  <Typography
                    variant="overline"
                    component="div"
                    sx={{ px: 1, pt: 1.5, color: 'text.disabled', fontSize: 11 }}
                  >
                    Gần đây
                  </Typography>
                )}
                {pins.recent.map((page) => (
                  <NavPageRow
                    key={page.key}
                    page={page}
                    icon="solar:history-linear"
                    active={active?.key === page.key}
                  />
                ))}
              </>
            ) : (
              openModule && (
                <>
                  <Typography variant="subtitle1" sx={{ px: 1, pb: 0.5 }}>
                    {openModule.title}
                  </Typography>
                  <NavModuleContent
                    module={openModule}
                    variant="list"
                    activeKey={active?.key}
                    pins={pins}
                  />
                </>
              )
            )}
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
}
