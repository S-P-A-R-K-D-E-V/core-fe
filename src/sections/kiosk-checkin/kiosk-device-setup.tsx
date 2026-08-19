'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type Props = {
  onSubmit: (key: string) => void;
  onBack?: () => void;
};

export default function KioskDeviceSetup({ onSubmit, onBack }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.900',
        p: 2,
      }}
    >
      <Card sx={{ p: 4, maxWidth: 420, width: '100%' }}>
        <Stack spacing={2}>
          <Typography variant="h5">Thiết lập Kiosk</Typography>
          <Typography variant="body2" color="text.secondary">
            Nhập khoá thiết bị (Kiosk Device Key) đã được cấp cho thiết bị này. Khoá được lưu trên
            trình duyệt, chỉ cần nhập 1 lần.
          </Typography>
          <TextField
            label="Khoá thiết bị"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            fullWidth
            autoFocus
            type="password"
          />
          <Button variant="contained" size="large" disabled={!value.trim()} onClick={handleSubmit}>
            Lưu &amp; Kết nối
          </Button>
          {onBack && (
            <Button size="small" color="inherit" onClick={onBack}>
              Quay lại ghép nối bằng mã QR
            </Button>
          )}
        </Stack>
      </Card>
    </Box>
  );
}
