import { forwardRef } from 'react';

import Avatar, { AvatarProps } from '@mui/material/Avatar';

import {
  SYSTEM_USER_ICON,
  SYSTEM_USER_NAME,
  SYSTEM_CHANNEL_ICON,
} from 'src/utils/messenger-system';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = Omit<AvatarProps, 'children' | 'src'> & {
  size?: number;
};

/** Avatar của người gửi hệ thống "Trợ lý hệ thống": icon bot, không phải chữ cái đầu của tên. */
export const SystemSenderAvatar = forwardRef<HTMLDivElement, Props>(
  ({ size = 32, sx, ...other }, ref) => (
    <Avatar
      ref={ref}
      role="img"
      aria-label={SYSTEM_USER_NAME}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        color: 'common.white',
        bgcolor: 'info.main',
        ...sx,
      }}
      {...other}
    >
      <Iconify icon={SYSTEM_USER_ICON} width={Math.round(size * 0.62)} />
    </Avatar>
  )
);

/** Avatar của kênh cảnh báo của hệ thống (hội thoại có systemKey): icon chuông. */
export const SystemChannelAvatar = forwardRef<HTMLDivElement, Props>(
  ({ size = 40, sx, ...other }, ref) => (
    <Avatar
      ref={ref}
      role="img"
      aria-label="Kênh cảnh báo hệ thống"
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        color: 'common.white',
        bgcolor: 'warning.main',
        ...sx,
      }}
      {...other}
    >
      <Iconify icon={SYSTEM_CHANNEL_ICON} width={Math.round(size * 0.58)} />
    </Avatar>
  )
);
