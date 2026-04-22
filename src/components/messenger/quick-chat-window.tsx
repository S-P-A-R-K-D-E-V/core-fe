'use client';

import { useRef, useState, useEffect } from 'react';
import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';

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

  // Stable store selectors — no ?? [] or transformations inside selector
  const messages = useMessengerStore((s) => s.messagesByConv[convId]) ?? [];
  const typing = useMessengerStore((s) => s.typingByConv[convId]) ?? [];
  const conversations = useMessengerStore((s) => s.conversations);
  const userCache = useMessengerStore((s) => s.userCache);
  // onlineIds is a stable array ref updated by userOnline/userOffline SignalR events
  const onlineIds = useMessengerStore((s) => s.onlineIds);

  const conv = conversations.find((c) => c.id === convId);

  // Compute in render body (not inside selector) to avoid useSyncExternalStore tearing
  const otherUserId = conv?.type !== 'Group'
    ? conv?.participantIds.find((id) => id !== currentUserId) ?? null
    : null;
  const isOnline = otherUserId ? onlineIds.includes(otherUserId) : false;

  const title =
    conv?.type === 'Group'
      ? conv?.name ?? `Nhóm ${conv.participantIds.length} thành viên`
      : (otherUserId ? userCache[otherUserId]?.fullName ?? otherUserId : 'Chat');

  useEffect(() => {
    openConversation(convId).catch(() => {});
    // Request browser notification permission when user opens a chat window.
    // Must happen inside a useEffect (client-only) and is triggered by user action.
    if (typeof window !== 'undefined' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
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
          {/* Avatar with online dot */}
          <Tooltip
            title={conv?.type !== 'Group' ? (isOnline ? 'Đang online' : 'Offline') : ''}
            placement="top"
          >
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                conv?.type !== 'Group' ? (
                  <Box
                    sx={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      bgcolor: isOnline ? 'success.main' : 'grey.400',
                      border: '1.5px solid',
                      borderColor: 'primary.main',
                    }}
                  />
                ) : null
              }
            >
              <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: 'primary.dark' }}>
                {title.charAt(0).toUpperCase()}
              </Avatar>
            </Badge>
          </Tooltip>

          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {title}
            </Typography>
            {conv?.type !== 'Group' && (
              <Typography variant="caption" sx={{ opacity: 0.8, lineHeight: 1 }}>
                {isOnline ? 'Đang online' : 'Offline'}
              </Typography>
            )}
          </Stack>

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
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                mine={msg.senderId === currentUserId}
                senderUser={userCache[msg.senderId]}
                showName={conv?.type === 'Group'}
                currentUserId={currentUserId ?? undefined}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as any);
                }
              }}
              autoComplete="off"
              autoFocus
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
