'use client';

import { useRef, useState, useEffect, useLayoutEffect } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import MenuItem from '@mui/material/MenuItem';
import ButtonBase from '@mui/material/ButtonBase';
import { useTheme } from '@mui/material/styles';
import ListItemIcon from '@mui/material/ListItemIcon';
import ClickAwayListener from '@mui/material/ClickAwayListener';

import { useRouter, usePathname } from 'src/routes/hooks';

import { bgBlur } from 'src/theme/css';

import Iconify from 'src/components/iconify';

import NavModuleContent from './nav-module-content';
import { NAV, HEADER } from '../../config-layout';
import { useNavPins, useActiveNavPage } from './use-nav-state';

import type { NavTree, NavPage, NavModule } from './nav-types';

// ----------------------------------------------------------------------
// Thanh module ngang (kiểu KiotViet) dưới header, màn ≥ lg. Bấm module → mega-menu chia cột theo nhóm con. Thanh KHÔNG
// cuộn ngang: module không đủ chỗ dồn vào "Thêm ▾" (đo bằng ResizeObserver). Đang mở một mega-menu thì rê sang module
// khác là chuyển luôn (trễ 120 ms để không nháy).
// ----------------------------------------------------------------------

type BarItem =
  | { kind: 'module'; module: NavModule }
  | { kind: 'page'; page: NavPage; module: NavModule };

const itemKey = (item: BarItem) => (item.kind === 'module' ? item.module.key : item.page.key);
const MORE_WIDTH = 96;

export default function NavModuleBar({ tree }: { tree: NavTree }) {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const active = useActiveNavPage(tree);
  const pins = useNavPins(tree);

  const items: BarItem[] = tree.modules.flatMap((module): BarItem[] =>
    module.flat
      ? module.groups.flatMap((g) =>
          g.pages.map((page): BarItem => ({ kind: 'page', page, module }))
        )
      : [{ kind: 'module', module }]
  );
  const itemsKey = items.map(itemKey).join('|');

  const barRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  // Đo độ rộng từng nút trên hàng ẩn, tính số nút vừa thanh.
  useLayoutEffect(() => {
    const bar = barRef.current;
    const measure = measureRef.current;
    if (!bar || !measure) return undefined;
    const compute = () => {
      // Chưa dựng xong khung (độ rộng 0): hiện đủ, đo lại khi ResizeObserver báo.
      if (!bar.clientWidth) {
        setVisibleCount(measure.children.length);
        return;
      }
      const widths = Array.from(measure.children).map((el) => (el as HTMLElement).offsetWidth);
      const available = bar.clientWidth - 16;
      const total = widths.reduce((a, b) => a + b, 0);
      if (total <= available) {
        setVisibleCount(widths.length);
        return;
      }
      let used = MORE_WIDTH;
      let count = 0;
      while (count < widths.length && used + widths[count] <= available) {
        used += widths[count];
        count += 1;
      }
      setVisibleCount(count);
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [itemsKey]);

  // Đổi trang → đóng menu.
  useEffect(() => {
    setOpenKey(null);
    setMoreAnchor(null);
  }, [pathname]);

  useEffect(() => {
    if (!openKey) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openKey]);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const openModule = tree.modules.find((m) => m.key === openKey && !m.flat) ?? null;
  const visible = items.slice(0, visibleCount);
  const overflow = items.slice(visibleCount);

  const renderButton = (item: BarItem, measuring = false) => {
    const key = itemKey(item);
    const isCurrent =
      item.kind === 'module'
        ? active?.moduleKey === item.module.key
        : active?.key === item.page.key;
    const isOpen = openKey === key;
    const common = {
      sx: {
        height: 1,
        px: 1.5,
        gap: 0.5,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        typography: 'subtitle2',
        color: isCurrent ? 'primary.main' : 'text.secondary',
        borderRadius: '8px 8px 0 0',
        position: 'relative',
        '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
        ...(isOpen && { color: 'text.primary', bgcolor: 'action.hover' }),
        ...(isCurrent && {
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 0,
            height: 3,
            borderRadius: '3px 3px 0 0',
            bgcolor: 'primary.main',
          },
        }),
      },
    };
    if (item.kind === 'page') {
      return (
        <ButtonBase
          key={key}
          tabIndex={measuring ? -1 : undefined}
          onClick={() => !measuring && router.push(item.page.path)}
          {...common}
        >
          {item.page.title}
        </ButtonBase>
      );
    }
    return (
      <ButtonBase
        key={key}
        tabIndex={measuring ? -1 : undefined}
        aria-haspopup="true"
        aria-expanded={measuring ? undefined : isOpen}
        onClick={() => !measuring && setOpenKey(isOpen ? null : key)}
        onMouseEnter={() => {
          if (measuring || !openKey || openKey === key) return;
          clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => setOpenKey(key), 120);
        }}
        onMouseLeave={() => clearTimeout(hoverTimer.current)}
        {...common}
      >
        {item.module.title}
        <Iconify
          icon="eva:chevron-down-fill"
          width={16}
          sx={{
            opacity: 0.6,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }}
        />
      </ButtonBase>
    );
  };

  return (
    <Box
      component="nav"
      aria-label="Menu chính"
      sx={{
        position: 'fixed',
        top: HEADER.H_DESKTOP_OFFSET,
        left: 0,
        right: 0,
        height: NAV.H_MODULE_BAR,
        zIndex: theme.zIndex.appBar,
        ...bgBlur({ color: theme.palette.background.default }),
        borderBottom: `solid 1px ${theme.palette.divider}`,
      }}
    >
      <Box
        ref={barRef}
        sx={{ height: 1, display: 'flex', alignItems: 'stretch', px: 4, overflow: 'hidden' }}
      >
        {visible.map((item) => renderButton(item))}
        {overflow.length > 0 && (
          <ButtonBase
            onClick={(e) => setMoreAnchor(e.currentTarget)}
            aria-haspopup="true"
            sx={{
              height: 1,
              px: 1.5,
              gap: 0.5,
              typography: 'subtitle2',
              color: 'text.secondary',
              flexShrink: 0,
            }}
          >
            Thêm
            <Iconify icon="eva:chevron-down-fill" width={16} sx={{ opacity: 0.6 }} />
          </ButtonBase>
        )}
      </Box>

      {/* Hàng ẩn để đo độ rộng nút. */}
      <Box
        ref={measureRef}
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 1,
          display: 'flex',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {items.map((item) => renderButton(item, true))}
      </Box>

      <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)}>
        {overflow.map((item) => (
          <MenuItem
            key={itemKey(item)}
            onClick={() => {
              setMoreAnchor(null);
              if (item.kind === 'page') router.push(item.page.path);
              else setOpenKey(item.module.key);
            }}
          >
            <ListItemIcon>
              <Iconify icon={item.module.icon} width={20} />
            </ListItemIcon>
            {item.kind === 'page' ? item.page.title : item.module.title}
          </MenuItem>
        ))}
      </Menu>

      <Popper
        open={!!openModule}
        anchorEl={barRef.current}
        placement="bottom-start"
        sx={{ zIndex: theme.zIndex.appBar + 2, width: barRef.current?.clientWidth }}
      >
        <ClickAwayListener
          onClickAway={(e) => {
            // Bấm vào thanh module: nút tự xử lý (mở module khác / đóng).
            if (barRef.current?.contains(e.target as Node)) return;
            setOpenKey(null);
          }}
        >
          <Paper
            elevation={0}
            sx={{
              mx: 2,
              px: 2.5,
              py: 2,
              maxHeight: `calc(100vh - ${HEADER.H_DESKTOP_OFFSET + NAV.H_MODULE_BAR + 24}px)`,
              overflowY: 'auto',
              borderRadius: '0 0 16px 16px',
              border: `solid 1px ${theme.palette.divider}`,
              borderTop: 0,
              boxShadow: theme.customShadows?.dropdown ?? theme.shadows[8],
            }}
          >
            {openModule && (
              <NavModuleContent
                module={openModule}
                variant="columns"
                activeKey={active?.key}
                pins={pins}
                onNavigate={() => setOpenKey(null)}
              />
            )}
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
}
