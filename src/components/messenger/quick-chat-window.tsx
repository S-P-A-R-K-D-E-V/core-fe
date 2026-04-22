'use client';

import { useRef, useState, useEffect } from 'react';
import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';

import { fTimeShort } from 'src/utils/format-time';
import { sendMessage as apiSendMessage } from 'src/api/messenger';
import { useMessengerStore } from 'src/store/messenger-store';
import { useMessengerCtx } from './messenger-provider';
import MessageBubble from './message-bubble';

// ----------------------------------------------------------------------

type Props = {
  convId: string;
  currentUserId: string | null;
  onClose: () => void;
};

export default function QuickChatWindow({ convId, currentUserId, onClose }: Props) {
  const [minimized, setMinimized] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { openConversation, sendTyping } = useMessengerCtx();
  const messages = useMessengerStore((s) => s.messagesByConv[convId] ?? []);
  const typing = useMessengerStore((s) => s.typingByConv[convId] ?? []);
  const conversations = useMessengerStore((s) => s.conversations);
  const userCache = useMessengerStore((s) => s.userCache);
  const conv = conversations.find((c) => c.id === convId);

  const title =
    conv?.type === 'Group'
      ? conv?.name ?? `Nhóm ${conv.participantIds.length} thành viên`
      : (() => {
          const otherId = conv?.participantIds.find((id) => id !== currentUserId);
          return otherId ? userCache[otherId]?.fullName ?? otherId : 'Chat';
        })();

  useEffect(() => {
    openConversation(convId).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  useEffect(() => {
    if (!minimized && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, minimized]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);
    try {
      await apiSendMessage(convId, text);
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const typingNames = typing
    .filter((id) => id !== currentUserId)
    .map((id) => userCache[id]?.fullName?.split(' ').at(-1) ?? '...')
    .join(', ');

  return (
    <m.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      style={{ pointerEvents: 'auto' }}
    >
      <Paper
        elevation={8}
        sx={{
          width: 300,
          borderRadius: 2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            px: 1.5,
            py: 1,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            cursor: 'pointer',
          }}
          onClick={() => setMinimized((v) => !v)}
        >
          <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: 'primary.dark' }}>
            {title.charAt(0).toUpperCase()}
          </Avatar>
          <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
            {title}
          </Typography>
          <IconButton size="small" sx={{ color: 'inherit' }} onClick={(e) => { e.stopPropagation(); setMinimized((v) => !v); }}>
            <Iconify icon={minimized ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'} width={18} />
          </IconButton>
          <IconButton size="small" sx={{ color: 'inherit' }} onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <Iconify icon="eva:close-fill" width={18} />
          </IconButton>
        </Stack>

        <Collapse in={!minimized}>
          {/* Messages */}
          <Scrollbar
            scrollableNodeProps={{ ref: scrollRef }}
            sx={{ height: 280, p: 1.5, bgcolor: 'background.neutral' }}
          >
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                mine={m.senderId === currentUserId}
                senderUser={userCache[m.senderId]}
                showName={conv?.type === 'Group'}
                compact
              />
            ))}
          </Scrollbar>

          {/* Typing indicator */}
          {typingNames && (
            <Typography variant="caption" sx={{ px: 1.5, pb: 0.5, color: 'text.secondary', display: 'block' }}>
              {typingNames} đang nhập...
            </Typography>
          )}

          <Divider />

          {/* Input */}
          <Box component="form" onSubmit={handleSend} sx={{ display: 'flex', p: 1, gap: 0.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Nhập tin nhắn..."
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                sendTyping(convId);
              }}
              autoComplete="off"
              variant="standard"
              InputProps={{ disableUnderline: true }}
              sx={{ px: 1 }}
            />
            <IconButton color="primary" type="submit" disabled={!draft.trim() || sending} size="small">
              <Iconify icon="eva:paper-plane-fill" width={20} />
            </IconButton>
          </Box>
        </Collapse>
      </Paper>
    </m.div>
  );
}
