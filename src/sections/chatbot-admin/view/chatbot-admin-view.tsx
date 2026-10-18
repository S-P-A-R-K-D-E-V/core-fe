'use client';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';

import { useAuthContext } from 'src/auth/hooks';

import { ChatbotWidget } from 'src/components/chatbot';
import { useSettingsContext } from 'src/components/settings';

// ----------------------------------------------------------------------
// Chatbot nội bộ: cùng khung chat với trợ lý nổi (ChatbotWidget variant="page") — lệnh "/", gửi / dán / kéo thả ảnh
// (tối đa theo máy chủ, mặc định 5), ảnh hoá đơn nhập hàng → thẻ hoá đơn, nhắn sửa dòng, nút / gợi ý trong câu trả lời.
// ----------------------------------------------------------------------

export default function ChatbotAdminView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();

  const isAdmin = user?.role === 'Admin' || user?.roles?.includes?.('Admin');

  if (!isAdmin) {
    return (
      <Container maxWidth={settings.themeStretch ? false : 'md'} sx={{ mt: 4 }}>
        <Alert severity="warning">Chatbot nội bộ chỉ dành cho Admin.</Alert>
      </Container>
    );
  }

  return (
    <Container
      maxWidth={settings.themeStretch ? false : 'lg'}
      sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4">Chatbot nội bộ (Admin)</Typography>
        <Typography variant="body2" color="text.secondary">
          Hỏi doanh thu, tồn kho, nhân viên, ca làm… Gửi / dán ảnh hoá đơn nhà cung cấp (tối đa 5 ảnh) để nhập hàng.
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ChatbotWidget variant="page" />
      </Box>
    </Container>
  );
}
