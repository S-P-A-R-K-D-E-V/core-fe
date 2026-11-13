'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';

import Logo from 'src/components/logo';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';

import NavPageRow from './nav-page-row';
import NavModuleContent from './nav-module-content';
import { useCommandPalette } from './command-palette-store';
import { useNavPins, useActiveNavPage } from './use-nav-state';

import type { NavTree, NavModule } from './nav-types';

// ----------------------------------------------------------------------
// Thanh bên mở rộng (kiểu menu "Thanh bên") và ngăn kéo menu trên màn nhỏ: ô tìm nhanh, Ghim, Gần đây, rồi các module
// dạng cây thu gọn được (module đang mở tự bung). Ngăn kéo đặt Cá nhân lên đầu — nhân viên dùng nhiều nhất.
// ----------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      component="div"
      sx={{ px: 1.5, pt: 2, pb: 0.5, color: 'text.disabled', fontSize: 11 }}
    >
      {children}
    </Typography>
  );
}

type Props = {
  tree: NavTree;
  variant: 'desktop' | 'drawer';
  onNavigate?: VoidFunction;
  /** Nút thu gọn (đầu thanh bên). */
  headerAction?: React.ReactNode;
};

export default function NavSidebar({ tree, variant, onNavigate, headerAction }: Props) {
  const active = useActiveNavPage(tree);
  const pins = useNavPins(tree);
  const openPalette = useCommandPalette((s) => s.setOpen);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(active ? [active.moduleKey] : [])
  );

  // Mở trang của module khác (vd từ ô tìm nhanh) → bung module đó.
  useEffect(() => {
    if (!active) return;
    setExpanded((prev) =>
      prev.has(active.moduleKey) ? prev : new Set(prev).add(active.moduleKey)
    );
  }, [active]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const extra = [tree.me, tree.settings].filter((m): m is NavModule => !!m);
  const ordered =
    variant === 'drawer'
      ? [...(tree.me ? [tree.me] : []), ...tree.modules, ...(tree.settings ? [tree.settings] : [])]
      : tree.modules;

  const renderModule = (module: NavModule) => {
    const isOpen = expanded.has(module.key);
    const isCurrent = active?.moduleKey === module.key;
    return (
      <Box key={module.key}>
        <ButtonBase
          onClick={() => toggle(module.key)}
          aria-expanded={isOpen}
          sx={{
            width: 1,
            justifyContent: 'flex-start',
            gap: 1.5,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            typography: 'subtitle2',
            color: isCurrent ? 'primary.main' : 'text.secondary',
            '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
          }}
        >
          <Iconify icon={module.icon} width={22} />
          <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>
            {module.title}
          </Box>
          <Iconify
            icon="eva:arrow-ios-forward-fill"
            width={16}
            sx={{ transition: 'transform .15s', transform: isOpen ? 'rotate(90deg)' : 'none' }}
          />
        </ButtonBase>
        <Collapse in={isOpen} unmountOnExit>
          <Box sx={{ pl: 2, pb: 1 }}>
            <NavModuleContent
              module={module}
              variant="list"
              activeKey={active?.key}
              pins={pins}
              onNavigate={onNavigate}
            />
          </Box>
        </Collapse>
      </Box>
    );
  };

  return (
    <Scrollbar
      sx={{
        height: 1,
        '& .simplebar-content': { height: 1, display: 'flex', flexDirection: 'column' },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mt: 2.5, ml: 3, mr: 1.5, mb: 1 }}
      >
        <Logo />
        {headerAction}
      </Stack>

      {!tree.counter && (
        <ButtonBase
          onClick={() => {
            onNavigate?.();
            openPalette(true);
          }}
          sx={{
            mx: 2,
            mb: 1,
            px: 1.5,
            height: 40,
            gap: 1,
            borderRadius: 1.5,
            justifyContent: 'flex-start',
            color: 'text.disabled',
            bgcolor: 'background.neutral',
            typography: 'body2',
          }}
        >
          <Iconify icon="eva:search-fill" width={18} />
          <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>
            Tìm trang, lệnh…
          </Box>
        </ButtonBase>
      )}

      <Box sx={{ px: 1.5, pb: 3 }}>
        {pins.pinned.length > 0 && (
          <>
            <SectionTitle>Đã ghim</SectionTitle>
            {pins.pinned.map((page) => (
              <NavPageRow
                key={page.key}
                page={page}
                icon={page.moduleIcon}
                active={active?.key === page.key}
                pins={pins}
                onNavigate={onNavigate}
              />
            ))}
          </>
        )}

        {pins.recent.length > 0 && (
          <>
            <SectionTitle>Gần đây</SectionTitle>
            {pins.recent.slice(0, 3).map((page) => (
              <NavPageRow
                key={page.key}
                page={page}
                icon="solar:history-linear"
                active={active?.key === page.key}
                onNavigate={onNavigate}
              />
            ))}
          </>
        )}

        <SectionTitle>{tree.counter ? 'Máy quầy' : 'Nghiệp vụ'}</SectionTitle>
        {ordered.map(renderModule)}

        {variant === 'desktop' && extra.length > 0 && (
          <>
            <SectionTitle>Khác</SectionTitle>
            {extra.map(renderModule)}
          </>
        )}
      </Box>
    </Scrollbar>
  );
}
