'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { useAuthContext } from 'src/auth/hooks';

import Iconify from 'src/components/iconify';
import { ChatbotWidget } from 'src/components/chatbot';
import { useSettingsContext } from 'src/components/settings';

import type { ChatbotMessage } from 'src/api/chatbot';

import ChatbotAdminSidePanel, { collectUploads, collectImportIds } from '../chatbot-admin-side-panel';

// ----------------------------------------------------------------------
// Chatbot nội bộ: cùng khung chat với trợ lý nổi (ChatbotWidget variant="page") — lệnh "/", gửi / dán / kéo thả ảnh
// (tối đa theo máy chủ, mặc định 5), ảnh hoá đơn nhập hàng → thẻ hoá đơn (bấm mở drawer duyệt nhanh, nhắn trợ lý sửa),
// nhắn sửa dòng, nút / gợi ý trong câu trả lời. Cột phải: tệp đã tải lên + các phiên nhập trong cuộc trò chuyện (màn
// hẹp thì mở bằng nút ở tiêu đề).
// ----------------------------------------------------------------------

const SIDE_WIDTH = 300;

export default function ChatbotAdminView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [sideOpen, setSideOpen] = useState(false);

  const isAdmin = user?.role === 'Admin' || user?.roles?.includes?.('Admin');

  if (!isAdmin) {
    return (
      <Container maxWidth={settings.themeStretch ? false : 'md'} sx={{ mt: 4 }}>
        <Alert severity="warning">Chatbot nội bộ chỉ dành cho Admin.</Alert>
      </Container>
    );
  }

  const sideCount = collectUploads(messages).length + collectImportIds(messages).length;

  return (
    <Container
      maxWidth={settings.themeStretch ? false : 'xl'}
      sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4">Chatbot nội bộ (Admin)</Typography>
          <Typography variant="body2" color="text.secondary">
            Hỏi doanh thu, tồn kho, nhân viên, ca làm… Gửi / dán ảnh hoá đơn nhà cung cấp kèm ảnh sản phẩm (tối đa 5 ảnh)
            để nhập hàng — bấm thẻ hoá đơn để xem nhanh và nhắn trợ lý sửa.
          </Typography>
        </Box>
        <Tooltip title="Tệp đã tải lên & phiên nhập">
          <IconButton onClick={() => setSideOpen(true)} sx={{ display: { lg: 'none' } }}>
            <Badge badgeContent={sideCount} color="primary" max={99}>
              <Iconify icon="solar:sidebar-minimalistic-linear" width={22} sx={{ transform: 'scaleX(-1)' }} />
            </Badge>
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ flexGrow: 1, minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <ChatbotWidget variant="page" onMessagesChange={setMessages} />
        </Box>
        <Box sx={{ width: SIDE_WIDTH, flexShrink: 0, overflowY: 'auto', display: { xs: 'none', lg: 'block' } }}>
          <ChatbotAdminSidePanel messages={messages} />
        </Box>
      </Stack>

      <Drawer
        anchor="right"
        open={sideOpen}
        onClose={() => setSideOpen(false)}
        PaperProps={{ sx: { width: { xs: '88%', sm: SIDE_WIDTH + 32 }, p: 2 } }}
      >
        <ChatbotAdminSidePanel messages={messages} />
      </Drawer>
    </Container>
  );
}
