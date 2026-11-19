import { forwardRef } from 'react';

import Avatar, { AvatarProps } from '@mui/material/Avatar';

import {
  AGENT_ADMIN_ICON,
  SYSTEM_USER_ICON,
  SYSTEM_USER_NAME,
  SYSTEM_CHANNEL_ICON,
  AGENT_ADMIN_GROUP_NAME,
  AGENT_ADMIN_SYSTEM_KEY,
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

/**
 * Avatar của nhóm hệ thống (hội thoại có systemKey): kênh cảnh báo = icon chuông; nhóm "Quản trị – Đội agent"
 * (systemKey "agent-admin") = icon robot.
 */
export const SystemChannelAvatar = forwardRef<
  HTMLDivElement,
  Props & { systemKey?: string | null }
>(({ size = 40, sx, systemKey, ...other }, ref) => {
  const agentAdmin = systemKey === AGENT_ADMIN_SYSTEM_KEY;
  return (
    <Avatar
      ref={ref}
      role="img"
      aria-label={agentAdmin ? AGENT_ADMIN_GROUP_NAME : 'Kênh cảnh báo hệ thống'}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        color: 'common.white',
        bgcolor: agentAdmin ? 'primary.main' : 'warning.main',
        ...sx,
      }}
      {...other}
    >
      <Iconify
        icon={agentAdmin ? AGENT_ADMIN_ICON : SYSTEM_CHANNEL_ICON}
        width={Math.round(size * 0.58)}
      />
    </Avatar>
  );
});
