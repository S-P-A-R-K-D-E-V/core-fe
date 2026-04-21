'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';

import { useSettingsContext } from 'src/components/settings';
import Iconify from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { useChatbot } from 'src/hooks/use-chatbot';

// ----------------------------------------------------------------------

export default function ChatbotAdminView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();

  const isAdmin = user?.role === 'Admin' || user?.roles?.includes?.('Admin');

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { ready, session, messages, typing, error, sendMessage, resetSession } = useChatbot({
    phone: user?.phoneNumber ?? null,
    displayName: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : null,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  if (!isAdmin) {
    return (
      <Container maxWidth={settings.themeStretch ? false : 'md'} sx={{ mt: 4 }}>
        <Alert severity="warning">Chatbot nội bộ chỉ dành cho Admin.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'} sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4">Chatbot nội bộ (Admin)</Typography>
          <Typography variant="body2" color="text.secondary">
            Dùng agent <b>internal-admin</b> — hỗ trợ Chủ tịch / quản lý nội bộ
          </Typography>
        </Box>
        <Button startIcon={<Iconify icon="solar:restart-bold" />} onClick={resetSession}>
          Phiên mới
        </Button>
      </Stack>

      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 2 }}>
        <Box
          ref={scrollRef}
          sx={{
            flexGrow: 1,
            p: 3,
            overflowY: 'auto',
            bgcolor: (t) => (t.palette.mode === 'light' ? 'grey.100' : 'grey.900'),
          }}
        >
          {!ready && (
            <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
              <CircularProgress />
            </Stack>
          )}
          {ready && messages.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
              Xin chào Chủ tịch! Hỏi tôi về doanh thu, tồn kho, nhân viên, ca làm,…
            </Typography>
          )}
          {messages.map((m) => (
            <Stack
              key={m.id}
              direction="row"
              justifyContent={m.role === 'user' ? 'flex-end' : 'flex-start'}
              sx={{ mb: 1.5 }}
            >
              <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1.25,
                  maxWidth: '75%',
                  bgcolor: m.role === 'user' ? 'primary.main' : 'background.paper',
                  color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  whiteSpace: 'pre-wrap',
                  borderRadius: 2,
                }}
              >
                <Typography variant="body2">{m.content || '…'}</Typography>
              </Paper>
            </Stack>
          ))}
          {typing && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                Đang soạn…
              </Typography>
            </Stack>
          )}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Box>

        <Stack direction="row" spacing={1} sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <TextField
            size="small"
            placeholder="Nhập tin nhắn (Enter để gửi, Shift+Enter để xuống dòng)…"
            fullWidth
            multiline
            maxRows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = draft.trim();
                if (text) {
                  setDraft('');
                  sendMessage(text);
                }
              }
            }}
          />
          <IconButton
            color="primary"
            onClick={() => {
              const text = draft.trim();
              if (text) {
                setDraft('');
                sendMessage(text);
              }
            }}
            disabled={!ready || !draft.trim()}
          >
            <Iconify icon="solar:plain-bold" width={24} />
          </IconButton>
        </Stack>
      </Paper>
    </Container>
  );
}
