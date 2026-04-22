'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';

import { fTimeShort } from 'src/utils/format-time';

import { useAuthContext } from 'src/auth/hooks';
import { useSettingsContext } from 'src/components/settings';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';

import { sendMessage as apiSendMessage } from 'src/api/messenger';
import { useMessengerStore } from 'src/store/messenger-store';
import { useMessengerCtx } from 'src/components/messenger/messenger-provider';
import MessageBubble from 'src/components/messenger/message-bubble';

import NewConversationDialog from '../new-conversation-dialog';

// ----------------------------------------------------------------------

const AVATAR_COLORS = ['#1976d2','#388e3c','#f57c00','#7b1fa2','#c2185b','#0097a7','#5d4037','#455a64'];
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ----------------------------------------------------------------------

export default function MessengerView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const currentUserId: string | null = user?.id ?? null;
  const searchParams = useSearchParams();
  const router = useRouter();

  const { openConversation, sendTyping } = useMessengerCtx();

  const conversations = useMessengerStore((s) => s.conversations);
  const userCache = useMessengerStore((s) => s.userCache);
  const onlineIds = useMessengerStore((s) => s.onlineIds);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const messages = useMessengerStore((s) => activeId ? s.messagesByConv[activeId] ?? [] : []);
  const typingUsers = useMessengerStore((s) => activeId ? s.typingByConv[activeId] ?? [] : []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, activeId]);

  // Open conv from ?conv= query param (from UsersPopover)
  useEffect(() => {
    const convId = searchParams.get('conv');
    if (convId && convId !== activeId) {
      handleSelectConv(convId);
      router.replace('/dashboard/messenger', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSelectConv = useCallback(async (convId: string) => {
    setActiveId(convId);
    openConversation(convId).catch(() => {});
  }, [openConversation]);

  const activeConv = conversations.find((c) => c.id === activeId);

  const convTitle = (convId: string) => {
    const c = conversations.find((x) => x.id === convId);
    if (!c) return '';
    if (c.type === 'Group') return c.name ?? `Nhóm ${c.participantIds.length} thành viên`;
    const otherId = c.participantIds.find((id) => id !== currentUserId);
    return otherId ? userCache[otherId]?.fullName ?? otherId : 'Chat';
  };

  const convAvatar = (convId: string) => {
    const c = conversations.find((x) => x.id === convId);
    if (!c) return null;
    if (c.type === 'Group') return null;
    const otherId = c.participantIds.find((id) => id !== currentUserId);
    return otherId ? userCache[otherId]?.avatarUrl ?? null : null;
  };

  const convInitial = (convId: string) => convTitle(convId).charAt(0).toUpperCase();

  const convOnline = (convId: string) => {
    const c = conversations.find((x) => x.id === convId);
    if (!c || c.type === 'Group') return false;
    const otherId = c.participantIds.find((id) => id !== currentUserId);
    return otherId ? onlineIds.includes(otherId) : false;
  };

  const typingLabel = typingUsers
    .filter((id) => id !== currentUserId)
    .map((id) => userCache[id]?.fullName?.split(' ').at(-1) ?? '...')
    .join(', ');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    try {
      await apiSendMessage(activeId, text);
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'} sx={{ py: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">Tin nhắn nội bộ</Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="eva:plus-fill" />}
          onClick={() => setNewOpen(true)}
        >
          Hội thoại mới
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ height: 'calc(100vh - 200px)', display: 'flex', overflow: 'hidden', minHeight: 500 }}>
        {/* LEFT — conversation list */}
        <Box sx={{ width: { xs: 72, sm: 280 }, borderRight: 1, borderColor: 'divider', overflowY: 'auto', flexShrink: 0 }}>
          {conversations.length === 0 && (
            <Box sx={{ p: 2, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2">Chưa có cuộc hội thoại nào.</Typography>
            </Box>
          )}
          {conversations.map((c) => {
            const title = convTitle(c.id);
            const online = convOnline(c.id);
            return (
              <ListItemButton
                key={c.id}
                selected={c.id === activeId}
                onClick={() => handleSelectConv(c.id)}
                sx={{ py: 1.5, px: { xs: 1, sm: 1.5 } }}
              >
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: online ? 'success.main' : 'text.disabled', border: '2px solid', borderColor: 'background.paper' }} />
                  }
                  sx={{ mr: { xs: 0, sm: 1.5 } }}
                >
                  <Avatar
                    src={convAvatar(c.id) ?? undefined}
                    sx={{ width: 40, height: 40, bgcolor: colorFor(c.id) }}
                  >
                    {convInitial(c.id)}
                  </Avatar>
                </Badge>
                <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0, flex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography
                      variant="subtitle2"
                      noWrap
                      fontWeight={c.unreadCount > 0 ? 700 : 500}
                    >
                      {title}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5, flexShrink: 0 }}>
                      {fTimeShort(c.lastMessageAt)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                      {c.lastMessagePreview ?? '(Chưa có tin nhắn)'}
                    </Typography>
                    {c.unreadCount > 0 && (
                      <Box sx={{ ml: 0.5, minWidth: 18, height: 18, borderRadius: 9, bgcolor: 'error.main', color: 'white', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </Box>
                    )}
                  </Stack>
                </Box>
              </ListItemButton>
            );
          })}
        </Box>

        {/* RIGHT — chat window */}
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          {activeConv ? (
            <>
              {/* Chat header */}
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: convOnline(activeId!) ? 'success.main' : 'text.disabled', border: '2px solid', borderColor: 'background.paper' }} />
                  }
                >
                  <Avatar src={convAvatar(activeId!) ?? undefined} sx={{ width: 40, height: 40, bgcolor: colorFor(activeId!) }}>
                    {convInitial(activeId!)}
                  </Avatar>
                </Badge>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600} noWrap>{convTitle(activeId!)}</Typography>
                  <Typography variant="caption" color={convOnline(activeId!) ? 'success.main' : 'text.secondary'}>
                    {activeConv.type === 'Group'
                      ? `${activeConv.participantIds.length} thành viên`
                      : convOnline(activeId!) ? 'Đang online' : 'Offline'}
                  </Typography>
                </Stack>
              </Stack>

              {/* Messages */}
              <Scrollbar scrollableNodeProps={{ ref: scrollRef }} sx={{ flex: 1, p: 2, bgcolor: 'background.neutral' }}>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    mine={msg.senderId === currentUserId}
                    senderUser={userCache[msg.senderId]}
                    showName={activeConv.type === 'Group'}
                    currentUserId={currentUserId ?? undefined}
                  />
                ))}
              </Scrollbar>

              {/* Typing indicator */}
              {typingLabel && (
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 2, py: 0.75 }}>
                  <Box sx={{ display: 'flex', gap: 0.4 }}>
                    {[0, 1, 2].map((i) => (
                      <Box
                        key={i}
                        component={m => <span {...m} />}
                        sx={{
                          width: 6, height: 6, borderRadius: '50%', bgcolor: 'text.disabled',
                          animation: 'typing-dot 1.2s infinite',
                          animationDelay: `${i * 0.2}s`,
                          '@keyframes typing-dot': {
                            '0%, 80%, 100%': { transform: 'scale(1)', opacity: 0.5 },
                            '40%': { transform: 'scale(1.3)', opacity: 1 },
                          },
                        }}
                      />
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {typingLabel} đang nhập...
                  </Typography>
                </Stack>
              )}

              <Divider />

              {/* Input */}
              <Box component="form" onSubmit={handleSend} sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="flex-end">
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Nhập tin nhắn..."
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (activeId) sendTyping(activeId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e as any);
                      }
                    }}
                    multiline
                    maxRows={4}
                    autoComplete="off"
                  />
                  <IconButton color="primary" type="submit" disabled={!draft.trim() || sending}>
                    <Iconify icon="eva:paper-plane-fill" />
                  </IconButton>
                </Stack>
              </Box>
            </>
          ) : (
            <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, color: 'text.secondary', gap: 1 }}>
              <Iconify icon="eva:message-circle-outline" width={72} sx={{ opacity: 0.4 }} />
              <Typography variant="h6" sx={{ opacity: 0.6 }}>Chọn một cuộc hội thoại</Typography>
              <Typography variant="body2" sx={{ opacity: 0.4 }}>hoặc tạo mới để bắt đầu nhắn tin</Typography>
            </Stack>
          )}
        </Stack>
      </Paper>

      <NewConversationDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={async (convId) => {
          setNewOpen(false);
          await handleSelectConv(convId);
        }}
      />
    </Container>
  );
}
