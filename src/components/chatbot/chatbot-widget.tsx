'use client';

import { useRef, useState, useEffect } from 'react';

import Fab from '@mui/material/Fab';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';

import Iconify from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { useChatbot } from 'src/hooks/use-chatbot';
import { chatbotCallbackOrder } from 'src/api/chatbot';

// ----------------------------------------------------------------------

type Props = {
  defaultOpen?: boolean;
};

export default function ChatbotWidget({ defaultOpen = false }: Props) {
  const { user } = useAuthContext();
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState('');
  const [phone, setPhone] = useState('');

  const { ready, session, messages, typing, error, sendMessage, resetSession } = useChatbot({
    phone: user?.phoneNumber ?? null,
    displayName: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : null,
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await sendMessage(text, phone || null);
  };

  const handleCallback = async () => {
    if (!session?.sessionId || !phone) return;
    try {
      await chatbotCallbackOrder({
        sessionId: session.sessionId,
        phone,
        content: messages[messages.length - 1]?.content,
      });
      await sendMessage('Tôi muốn được gọi lại để đặt hàng', phone);
    } catch (err) {
      console.error('Callback failed', err);
    }
  };

  const isAdmin = user?.role === 'Admin';

  return (
    <Box sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1400 }}>
      <Collapse in={open} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            width: { xs: '92vw', sm: 380 },
            height: 520,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
            overflow: 'hidden',
            mb: 1,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ p: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText' }}
          >
            <Avatar sx={{ bgcolor: 'primary.dark' }}>
              <Iconify icon={isAdmin ? 'solar:crown-bold' : 'solar:chat-round-dots-bold'} />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle2" sx={{ lineHeight: 1.1 }}>
                {isAdmin ? 'Internal Admin' : 'CiCi Customer Support'}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {session?.sessionId ? `Session ${session.sessionId.slice(0, 8)}…` : 'Đang kết nối…'}
              </Typography>
            </Box>
            <IconButton size="small" onClick={resetSession} sx={{ color: 'inherit' }} title="Reset phiên">
              <Iconify icon="solar:restart-bold" />
            </IconButton>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'inherit' }}>
              <Iconify icon="mingcute:close-line" />
            </IconButton>
          </Stack>

          <Box
            ref={scrollRef}
            sx={{
              flexGrow: 1,
              p: 2,
              overflowY: 'auto',
              bgcolor: (t) => (t.palette.mode === 'light' ? 'grey.100' : 'grey.900'),
            }}
          >
            {!ready && (
              <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                <CircularProgress size={24} />
              </Stack>
            )}
            {ready && messages.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                Chào bạn! CiCi ở đây để hỗ trợ. Bạn có thể hỏi về sản phẩm, đơn hàng, giờ mở cửa…
              </Typography>
            )}
            {messages.map((m) => (
              <Stack
                key={m.id}
                direction="row"
                justifyContent={m.role === 'user' ? 'flex-end' : 'flex-start'}
                sx={{ mb: 1 }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    px: 1.5,
                    py: 1,
                    maxWidth: '80%',
                    bgcolor: m.role === 'user' ? 'primary.main' : 'background.paper',
                    color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    borderRadius: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <Typography variant="body2">{m.content || '…'}</Typography>
                  {m.fromCache && (
                    <Typography variant="caption" color="text.secondary">
                      ⚡ trả lời từ cache
                    </Typography>
                  )}
                </Paper>
              </Stack>
            ))}
            {typing && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  CiCi đang soạn tin…
                </Typography>
              </Stack>
            )}
            {error && (
              <Typography variant="caption" color="error">
                {error}
              </Typography>
            )}
          </Box>

          {!user && (
            <Stack direction="row" spacing={1} sx={{ px: 1.5, pt: 1 }}>
              <TextField
                size="small"
                placeholder="Nhập SĐT (nếu có) để tra khách hàng"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
              />
              <Button size="small" variant="outlined" onClick={handleCallback} disabled={!phone}>
                Gọi lại
              </Button>
            </Stack>
          )}

          <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
            <TextField
              size="small"
              placeholder="Nhập tin nhắn…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              fullWidth
              multiline
              maxRows={3}
            />
            <IconButton color="primary" onClick={handleSend} disabled={!ready || !draft.trim()}>
              <Iconify icon="solar:plain-bold" />
            </IconButton>
          </Stack>
        </Paper>
      </Collapse>

      <Badge color="error" variant="dot" invisible={!typing}>
        <Fab color="primary" onClick={() => setOpen((p) => !p)}>
          <Iconify icon={open ? 'mingcute:close-line' : 'solar:chat-round-dots-bold'} width={28} />
        </Fab>
      </Badge>
    </Box>
  );
}
