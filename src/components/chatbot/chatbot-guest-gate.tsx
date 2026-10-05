import { useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------
// Khách chưa đăng nhập phải nhập Tên + SĐT trước khi chat — widget lưu localStorage nên lần sau quay
// lại không phải nhập lại.
// ----------------------------------------------------------------------

export type ChatbotGuestInfo = { name: string; phone: string };

type Props = {
  brandName: string;
  onSubmit: (info: ChatbotGuestInfo) => void;
};

export default function ChatbotGuestGate({ brandName, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const valid = !!name.trim() && !!phone.trim();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    onSubmit({ name: name.trim(), phone: phone.trim() });
  };

  return (
    <Stack
      component="form"
      noValidate
      onSubmit={handleSubmit}
      spacing={1.5}
      sx={{
        p: 2.5,
        flexGrow: 1,
        minHeight: 0,
        overflowY: 'auto',
        justifyContent: 'center',
        bgcolor: (theme) => (theme.palette.mode === 'light' ? 'grey.100' : 'grey.900'),
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          mx: 'auto',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
        }}
      >
        <Iconify icon="solar:chat-round-dots-bold-duotone" width={28} />
      </Box>

      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="subtitle1">
          Trước khi chat, cho {brandName} biết bạn là ai nhé 👋
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Giúp {brandName} hỗ trợ bạn tốt hơn — thông tin chỉ dùng trong phiên chat này.
        </Typography>
      </Box>

      <TextField
        size="small"
        label="Tên của bạn"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        fullWidth
        autoFocus
        sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
      />
      <TextField
        size="small"
        type="tel"
        label="Số điện thoại"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        autoComplete="tel"
        fullWidth
        sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
      />

      <Button type="submit" variant="contained" disabled={!valid}>
        Bắt đầu trò chuyện
      </Button>
    </Stack>
  );
}
