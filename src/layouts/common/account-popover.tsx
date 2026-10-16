import { useState } from 'react';
import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';
import { unpairCounter } from 'src/api/counter';

import { clearCounterDevice, useCounterDevice } from 'src/sections/counter/counter-device';
import { COUNTER_LOCK_PATH, useCounterSession } from 'src/sections/counter/counter-scope';

import { varHover } from 'src/components/animate';
import { useSnackbar } from 'src/components/snackbar';
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

const OPTIONS = [
  {
    label: 'Trang chủ',
    linkTo: '/',
  },
  {
    label: 'Cài đặt',
    linkTo: paths.dashboard.user.account,
  },
];

// ----------------------------------------------------------------------

export default function AccountPopover() {
  const router = useRouter();

  const { user } = useAuthContext();

  const { logout } = useAuthContext();

  const { enqueueSnackbar } = useSnackbar();

  const popover = usePopover();

  const counterSession = useCounterSession();
  const counterDevice = useCounterDevice();
  const isManager = !!user?.roles?.some((r: string) => r === 'Admin' || r === 'Manager');

  // Hộp thoại của giao diện, không window.confirm (trình duyệt nhúng chặn hộp thoại hệ thống → nút như không phản hồi).
  const [confirmLeave, setConfirmLeave] = useState(false);

  const handleLeaveCounter = async () => {
    setConfirmLeave(false);
    try {
      await unpairCounter();
    } catch {
      // Máy đã bị gỡ ở nơi khác / mất mạng: vẫn thoát ở trình duyệt này.
    }
    clearCounterDevice();
    await logout();
    router.replace('/');
  };

  const handleLogout = async () => {
    try {
      await logout();
      popover.onClose();
      // Máy quầy: đăng xuất là về màn chọn tên cho người tiếp theo.
      router.replace(counterDevice ? COUNTER_LOCK_PATH : '/');
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Unable to logout!', { variant: 'error' });
    }
  };

  const handleClickItem = (path: string) => {
    popover.onClose();
    router.push(path);
  };

  return (
    <>
      <IconButton
        component={m.button}
        whileTap="tap"
        whileHover="hover"
        variants={varHover(1.05)}
        onClick={popover.onOpen}
        sx={{
          width: 40,
          height: 40,
          background: (theme) => alpha(theme.palette.grey[500], 0.08),
          ...(popover.open && {
            background: (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
          }),
        }}
      >
        <Avatar
          src={user?.photoURL}
          alt={user?.displayName}
          sx={{
            width: 36,
            height: 36,
            border: (theme) => `solid 2px ${theme.palette.background.default}`,
          }}
        >
          {user?.displayName?.charAt(0).toUpperCase()}
        </Avatar>
      </IconButton>

      <CustomPopover open={popover.open} onClose={popover.onClose} sx={{ width: 200, p: 0 }}>
        <Box sx={{ p: 2, pb: 1.5 }}>
          <Typography variant="subtitle2" noWrap>
            {user?.displayName}
          </Typography>

          <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
            {user?.email}
          </Typography>
        </Box>

        <Divider sx={{ borderStyle: 'dashed' }} />

        {counterSession ? (
          <Stack sx={{ p: 1 }}>
            <Typography variant="caption" sx={{ px: 1, color: 'text.secondary' }}>
              {counterDevice ? `${counterDevice.deviceName} · ${counterDevice.branchName}` : 'Máy quầy'}
            </Typography>
            {isManager && (
              <MenuItem
                onClick={() => {
                  popover.onClose();
                  setConfirmLeave(true);
                }}
                sx={{ color: 'warning.main' }}
              >
                Thoát chế độ máy quầy
              </MenuItem>
            )}
          </Stack>
        ) : (
          <Stack sx={{ p: 1 }}>
            {OPTIONS.map((option) => (
              <MenuItem key={option.label} onClick={() => handleClickItem(option.linkTo)}>
                {option.label}
              </MenuItem>
            ))}
          </Stack>
        )}

        <Divider sx={{ borderStyle: 'dashed' }} />

        <MenuItem
          onClick={handleLogout}
          sx={{ m: 1, fontWeight: 'fontWeightBold', color: 'error.main' }}
        >
          {counterSession ? 'Kết thúc phiên' : 'Đăng xuất'}
        </MenuItem>
      </CustomPopover>

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Thoát chế độ máy quầy?"
        content="Trình duyệt này không còn là máy quầy; mọi người đang dùng máy quầy này sẽ bị đăng xuất."
        action={
          <Button variant="contained" color="error" onClick={handleLeaveCounter}>
            Thoát chế độ máy quầy
          </Button>
        }
      />
    </>
  );
}
