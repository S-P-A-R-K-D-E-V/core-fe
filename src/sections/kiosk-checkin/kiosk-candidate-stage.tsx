'use client';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  staffName: string;
  staffAvatarUrl?: string;
  /** Kiosk không gạt tay chọn chiều nữa — BE tự suy luận theo trạng thái ca/log của người
   *  nhận diện được (xem IKioskCandidateFound.isCheckIn). */
  isCheckIn: boolean;
  secondsLeft: number;
  totalSeconds: number;
  onCancel: () => void;
};

export default function KioskCandidateStage({
  staffName,
  staffAvatarUrl,
  isCheckIn,
  secondsLeft,
  totalSeconds,
  onCancel,
}: Props) {
  const progress = Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100));

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        bgcolor: 'rgba(0,0,0,0.72)',
        color: 'common.white',
        textAlign: 'center',
        px: 3,
        zIndex: 10,
      }}
    >
      <Avatar
        src={staffAvatarUrl}
        sx={{ width: 120, height: 120, fontSize: 48, bgcolor: 'primary.main' }}
      >
        {staffName.charAt(0)}
      </Avatar>

      <Typography variant="h3">Xin chào, {staffName}</Typography>
      <Typography
        variant="subtitle1"
        sx={{ mt: -2, color: isCheckIn ? 'success.light' : 'warning.light', fontWeight: 700 }}
      >
        {isCheckIn ? 'CHẤM CÔNG VÀO' : 'CHẤM CÔNG RA'}
      </Typography>

      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={progress}
          size={96}
          thickness={3}
          sx={{ color: 'primary.main' }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="h4">{secondsLeft}</Typography>
        </Box>
      </Box>

      <Button
        variant="outlined"
        color="inherit"
        size="large"
        startIcon={<Iconify icon="mdi:close" />}
        onClick={onCancel}
        sx={{ borderColor: 'common.white' }}
      >
        Không phải tôi / Huỷ
      </Button>
    </Box>
  );
}
