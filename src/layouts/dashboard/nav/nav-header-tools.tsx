'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';

import { useResponsive } from 'src/hooks/use-responsive';

import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

import NavPageRow from './nav-page-row';
import NavModuleContent from './nav-module-content';
import { useNavPins, useActiveNavPage } from './use-nav-state';

import type { NavTree } from './nav-types';

// ----------------------------------------------------------------------
// Nút trên header: ★ Ghim & gần đây, Cài đặt cửa hàng (module Cài đặt + lối tắt Giao diện & kiểu menu), nút "Bán hàng".
// Nút Cài đặt giao diện (bánh răng) vẫn là layouts/common/settings-button như trước.
// ----------------------------------------------------------------------

export function NavPinsButton({ tree }: { tree: NavTree }) {
  const popover = usePopover();
  const pins = useNavPins(tree);
  const active = useActiveNavPage(tree);

  return (
    <>
      <Tooltip title="Ghim & gần đây">
        <IconButton
          onClick={popover.onOpen}
          color={popover.open ? 'primary' : 'default'}
          aria-label="Ghim & gần đây"
        >
          <Iconify icon="solar:star-bold-duotone" width={22} />
        </IconButton>
      </Tooltip>
      <CustomPopover open={popover.open} onClose={popover.onClose} sx={{ width: 320, p: 1 }}>
        <Typography
          variant="overline"
          component="div"
          sx={{ px: 1, color: 'text.disabled', fontSize: 11 }}
        >
          Đã ghim
        </Typography>
        {pins.pinned.length === 0 && (
          <Typography variant="body2" sx={{ px: 1, pb: 1, color: 'text.secondary' }}>
            Bấm ★ cạnh một trang trong menu để ghim (tối đa 10).
          </Typography>
        )}
        {pins.pinned.map((page) => (
          <NavPageRow
            key={page.key}
            page={page}
            icon={page.moduleIcon}
            caption={`${page.moduleTitle} › ${page.groupTitle}`}
            active={active?.key === page.key}
            pins={pins}
            onNavigate={popover.onClose}
          />
        ))}
        {pins.recent.length > 0 && (
          <>
            <Divider sx={{ borderStyle: 'dashed', my: 1 }} />
            <Typography
              variant="overline"
              component="div"
              sx={{ px: 1, color: 'text.disabled', fontSize: 11 }}
            >
              Gần đây
            </Typography>
            {pins.recent.map((page) => (
              <NavPageRow
                key={page.key}
                page={page}
                icon="solar:history-linear"
                caption={page.moduleTitle}
                active={active?.key === page.key}
                pins={pins}
                onNavigate={popover.onClose}
              />
            ))}
          </>
        )}
      </CustomPopover>
    </>
  );
}

export function NavSettingsButton({ tree }: { tree: NavTree }) {
  const popover = usePopover();
  const settings = useSettingsContext();
  const pins = useNavPins(tree);
  const active = useActiveNavPage(tree);

  return (
    <>
      <Tooltip title="Cài đặt cửa hàng">
        <IconButton
          onClick={popover.onOpen}
          color={popover.open || active?.moduleKey === 'settings' ? 'primary' : 'default'}
          aria-label="Cài đặt cửa hàng"
        >
          {/* Không dùng bánh răng — bánh răng là nút Cài đặt giao diện ngay bên cạnh. */}
          <Iconify icon="solar:shop-2-bold-duotone" width={22} />
        </IconButton>
      </Tooltip>
      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        sx={{ width: tree.settings ? 300 : 240, p: 1 }}
      >
        {tree.settings && (
          <>
            <NavModuleContent
              module={tree.settings}
              variant="list"
              activeKey={active?.key}
              pins={pins}
              onNavigate={popover.onClose}
            />
            <Divider sx={{ borderStyle: 'dashed', my: 1 }} />
          </>
        )}
        <ButtonBase
          onClick={() => {
            popover.onClose();
            settings.onToggle();
          }}
          sx={{
            width: 1,
            justifyContent: 'flex-start',
            gap: 1,
            px: 1,
            py: 0.75,
            borderRadius: 1,
            typography: 'body2',
          }}
        >
          <Iconify
            icon="solar:pallete-2-bold-duotone"
            width={18}
            sx={{ color: 'text.secondary' }}
          />
          Giao diện & kiểu menu
        </ButtonBase>
      </CustomPopover>
    </>
  );
}

/** Nút "Bán hàng" nổi bật — mở màn bán hàng ở tab mới trên máy tính (như KiotViet), cùng tab trên điện thoại. */
export function NavSellButton({ tree }: { tree: NavTree }) {
  const lgUp = useResponsive('up', 'lg');
  const sale =
    tree.pages.find((p) => p.key === 'sales.pos') ??
    tree.pages.find((p) => p.key === 'sales.fnb') ??
    null;
  if (!sale || tree.counter) return null;

  if (!lgUp) {
    return (
      <Tooltip title="Bán hàng">
        <IconButton color="primary" href={sale.path} aria-label="Bán hàng">
          <Iconify icon="solar:cart-large-2-bold" width={22} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ ml: 0.5 }}>
      <Button
        variant="contained"
        color="primary"
        href={sale.path}
        target="_blank"
        rel="noopener"
        startIcon={<Iconify icon="solar:cart-large-2-bold" />}
        sx={{ whiteSpace: 'nowrap' }}
      >
        Bán hàng
      </Button>
    </Box>
  );
}
