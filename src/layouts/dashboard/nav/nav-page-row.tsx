'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import { alpha } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import Iconify from 'src/components/iconify';

import type { NavPinsState } from './use-nav-state';
import type { NavAction } from './nav-types';

// ----------------------------------------------------------------------
// Một dòng trang trong menu: tên (link), nút "+" (hành động tạo mới — một hành động thì mở thẳng, nhiều thì hiện danh
// sách) và ★ ghim. Nút nằm cạnh link chứ không lồng trong link.
// ----------------------------------------------------------------------

type RowPage = { key: string; title: string; path: string; actions?: readonly NavAction[] };

type Props = {
  page: RowPage;
  active?: boolean;
  pins?: NavPinsState;
  /** Dòng phụ dưới tên (vd "Nhân viên › Lương" trong danh sách ghim). */
  caption?: string;
  icon?: string;
  onNavigate?: VoidFunction;
};

export default function NavPageRow({ page, active, pins, caption, icon, onNavigate }: Props) {
  const [actionAnchor, setActionAnchor] = useState<HTMLElement | null>(null);
  const actions = page.actions ?? [];
  const pinned = pins?.isPinned(page.key) ?? false;
  const rolePin = pins?.isRolePin(page.key) ?? false;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        borderRadius: 1,
        '&:hover': { bgcolor: 'action.hover' },
        '&:hover .nav-row-tool, & .nav-row-tool.is-on': { opacity: 1 },
        ...(active && { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) }),
      }}
    >
      <ButtonBase
        component={RouterLink}
        href={page.path}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        sx={{
          flex: 1,
          minWidth: 0,
          justifyContent: 'flex-start',
          gap: 1,
          px: 1,
          py: 0.75,
          borderRadius: 1,
          textAlign: 'left',
        }}
      >
        {icon && <Iconify icon={icon} width={18} sx={{ color: 'text.secondary', flexShrink: 0 }} />}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              lineHeight: 1.35,
              ...(active && { color: 'primary.main', fontWeight: 'fontWeightSemiBold' }),
            }}
          >
            {page.title}
          </Typography>
          {caption && (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }} noWrap>
              {caption}
            </Typography>
          )}
        </Box>
      </ButtonBase>

      {actions.length === 1 && (
        <Tooltip title={actions[0].title}>
          <IconButton
            className="nav-row-tool"
            size="small"
            component={RouterLink}
            href={actions[0].path}
            onClick={onNavigate}
            aria-label={actions[0].title}
            sx={{ opacity: { xs: 1, lg: 0 }, width: 28, height: 28 }}
          >
            <Iconify icon="mingcute:add-line" width={16} />
          </IconButton>
        </Tooltip>
      )}

      {actions.length > 1 && (
        <>
          <Tooltip title={actions.map((a) => a.title).join(' · ')}>
            <IconButton
              className="nav-row-tool"
              size="small"
              onClick={(e) => setActionAnchor(e.currentTarget)}
              aria-label="Tạo mới"
              sx={{ opacity: { xs: 1, lg: 0 }, width: 28, height: 28 }}
            >
              <Iconify icon="mingcute:add-line" width={16} />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={actionAnchor} open={!!actionAnchor} onClose={() => setActionAnchor(null)}>
            {actions.map((action) => (
              <MenuItem
                key={action.path}
                component={RouterLink}
                href={action.path}
                onClick={() => {
                  setActionAnchor(null);
                  onNavigate?.();
                }}
              >
                <Iconify icon="mingcute:add-line" width={16} sx={{ mr: 1 }} />
                {action.title}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}

      {pins && (
        <Tooltip
          title={
            rolePin
              ? 'Ghim mặc định của vai trò'
              : pinned
                ? 'Bỏ ghim'
                : pins.isFull
                  ? 'Đã đủ số mục ghim'
                  : 'Ghim'
          }
        >
          <span>
            <IconButton
              className={`nav-row-tool${pinned ? ' is-on' : ''}`}
              size="small"
              disabled={rolePin || (!pinned && pins.isFull)}
              onClick={() => pins.togglePin(page.key)}
              aria-label={pinned ? 'Bỏ ghim' : 'Ghim'}
              aria-pressed={pinned}
              sx={{
                opacity: { xs: pinned ? 1 : 0.6, lg: 0 },
                width: 28,
                height: 28,
                color: pinned ? 'warning.main' : undefined,
              }}
            >
              <Iconify icon={pinned ? 'solar:star-bold' : 'solar:star-linear'} width={16} />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );
}
