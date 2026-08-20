'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import Iconify from 'src/components/iconify';

import type { KioskAction } from 'src/types/kiosk';

// ----------------------------------------------------------------------
// Thanh xác nhận đặt ở footer — KHÔNG che camera (khác overlay toàn màn cũ, khiến người đứng
// sau không thấy được khung hình/tiến trình). Progress bar chạy ngang trên cùng, bên dưới hiện
// tên + thông tin ca chuẩn bị check-in (hoặc thông báo không có ca -> tự động ngoài giờ).

type Props = {
  staffName: string;
  staffAvatarUrl?: string;
  action: KioskAction;
  shiftName?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  secondsLeft: number;
  totalSeconds: number;
  onCancel: () => void;
};

const ACTION_META: Record<KioskAction, { label: string; color: 'success' | 'warning' | 'info' }> = {
  checkin: { label: 'Chuẩn bị check-in', color: 'success' },
  checkout: { label: 'Chuẩn bị check-out', color: 'warning' },
  overtime: { label: 'Không có ca hôm nay — check-in ngoài giờ', color: 'info' },
};

export default function KioskCandidateFooter({
  staffName,
  staffAvatarUrl,
  action,
  shiftName,
  shiftStartTime,
  shiftEndTime,
  secondsLeft,
  totalSeconds,
  onCancel,
}: Props) {
  const progress = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));
  const meta = ACTION_META[action];

  return (
    <Box sx={{ width: '100%', bgcolor: 'grey.900', color: 'common.white', borderRadius: 2, overflow: 'hidden' }}>
      <LinearProgress variant="determinate" value={progress} color={meta.color} sx={{ height: 4 }} />
      <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 2 }}>
        <Avatar src={staffAvatarUrl} sx={{ width: 48, height: 48, bgcolor: 'primary.main', flexShrink: 0 }}>
          {staffName.charAt(0)}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            {staffName}
          </Typography>
          <Typography variant="caption" sx={{ color: `${meta.color}.light`, fontWeight: 700, display: 'block' }}>
            {meta.label}
          </Typography>
          {action === 'checkin' && shiftName && (
            <Typography variant="caption" sx={{ color: 'grey.400', display: 'block' }} noWrap>
              Ca: {shiftName} ({shiftStartTime}–{shiftEndTime})
            </Typography>
          )}
        </Box>
        <Typography variant="h5" sx={{ minWidth: 28, textAlign: 'center', flexShrink: 0 }}>
          {secondsLeft}
        </Typography>
        <Button
          variant="outlined"
          color="inherit"
          size="small"
          startIcon={<Iconify icon="mdi:close" />}
          onClick={onCancel}
          sx={{ borderColor: 'grey.600', flexShrink: 0 }}
        >
          Không phải tôi
        </Button>
      </Stack>
    </Box>
  );
}
