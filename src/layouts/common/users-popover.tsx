'use client';

import { m } from 'framer-motion';
import { useRouter } from 'next/navigation';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { varHover } from 'src/components/animate';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

import { useAuthContext } from 'src/auth/hooks';
import { usePresence } from 'src/hooks/use-presence';
import { openPrivateConversation } from 'src/api/messenger';

// ----------------------------------------------------------------------

export default function UsersPopover() {
  const popover = usePopover();
  const router = useRouter();
  const { user: me } = useAuthContext();
  const { users, loading, onlineCount } = usePresence();

  const handleClickUser = async (userId: string) => {
    popover.onClose();
    try {
      const conv = await openPrivateConversation(userId);
      router.push(`${paths.dashboard.messenger}?conv=${conv.id}`);
    } catch (err) {
      console.error('[UsersPopover] open private conv error', err);
    }
  };

  // Exclude self
  const list = users.filter((u) => u.id !== me?.id);

  return (
    <>
      <Tooltip title="Người dùng nội bộ">
        <IconButton
          component={m.button}
          whileTap="tap"
          whileHover="hover"
          variants={varHover(1.05)}
          color={popover.open ? 'inherit' : 'default'}
          onClick={popover.onOpen}
          sx={{
            position: 'relative',
            ...(popover.open && {
              bgcolor: (theme) => theme.palette.action.selected,
            }),
          }}
        >
          <Iconify icon="solar:users-group-rounded-bold-duotone" width={24} />
          {onlineCount > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'success.main',
                border: '1.5px solid',
                borderColor: 'background.default',
              }}
            />
          )}
        </IconButton>
      </Tooltip>

      <CustomPopover open={popover.open} onClose={popover.onClose} sx={{ width: 340 }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Người dùng</Typography>
          <Typography variant="caption" color="text.secondary">
            {onlineCount} online
          </Typography>
        </Box>

        <Scrollbar sx={{ height: 400 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!loading && list.length === 0 && (
            <Box sx={{ p: 2, color: 'text.secondary' }}>
              <Typography variant="body2">Không có người dùng nào.</Typography>
            </Box>
          )}

          {list.map((u) => (
            <MenuItem
              key={u.id}
              onClick={() => handleClickUser(u.id)}
              sx={{ px: 2, py: 1.25, gap: 1.5 }}
            >
              {/* Avatar with online dot */}
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <Avatar
                  src={u.avatarUrl ?? undefined}
                  alt={u.fullName}
                  sx={{ width: 40, height: 40 }}
                >
                  {u.fullName.charAt(0).toUpperCase()}
                </Avatar>
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    bgcolor: u.online ? 'success.main' : 'text.disabled',
                    border: '2px solid',
                    borderColor: 'background.paper',
                    transition: 'background-color 0.3s',
                  }}
                />
              </Box>

              <ListItemText
                primary={u.fullName}
                secondary={u.online ? 'Đang online' : u.email}
                primaryTypographyProps={{ typography: 'subtitle2', noWrap: true }}
                secondaryTypographyProps={{
                  typography: 'caption',
                  color: u.online ? 'success.main' : 'text.disabled',
                  noWrap: true,
                }}
              />

              <Iconify
                icon="eva:message-circle-fill"
                width={18}
                sx={{ color: 'text.disabled', flexShrink: 0 }}
              />
            </MenuItem>
          ))}
        </Scrollbar>
      </CustomPopover>
    </>
  );
}
