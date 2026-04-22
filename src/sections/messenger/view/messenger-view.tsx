'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';

import { useAuthContext } from 'src/auth/hooks';
import { useMessenger } from 'src/hooks/use-messenger';
import { useSettingsContext } from 'src/components/settings';

import Iconify from 'src/components/iconify';

import NewConversationDialog from '../new-conversation-dialog';

// ----------------------------------------------------------------------

export default function MessengerView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const currentUserId: string | null = user?.id ?? null;

  const { conversations, activeId, messages, loading, openConversation, send, reloadConversations } =
    useMessenger(currentUserId);

  const [draft, setDraft] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();

  // Auto-open conversation when coming from UsersPopover (?conv=...)
  useEffect(() => {
    const convId = searchParams.get('conv');
    if (convId && !activeId) {
      openConversation(convId).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, activeId]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    try {
      await send(text);
    } catch {
      setDraft(text);
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

      <Paper variant="outlined" sx={{ height: '70vh', display: 'flex', overflow: 'hidden' }}>
        {/* LEFT — conversation list */}
        <Box sx={{ width: 320, borderRight: 1, borderColor: 'divider', overflowY: 'auto' }}>
          {conversations.length === 0 && (
            <Box sx={{ p: 3, color: 'text.secondary' }}>
              <Typography variant="body2">Chưa có cuộc hội thoại nào.</Typography>
            </Box>
          )}
          {conversations.map((c) => {
            const title =
              c.type === 'Group'
                ? c.name ?? `Nhóm ${c.participantIds.length} thành viên`
                : c.participantIds.find((id) => id !== currentUserId) ?? 'Hội thoại';
            return (
              <ListItemButton
                key={c.id}
                selected={c.id === activeId}
                onClick={() => openConversation(c.id)}
                sx={{ py: 1.5 }}
              >
                <Badge color="error" badgeContent={c.unreadCount} sx={{ mr: 2 }}>
                  <Avatar>{c.type === 'Group' ? 'G' : (title[0] ?? '?').toUpperCase()}</Avatar>
                </Badge>
                <ListItemText
                  primary={title}
                  primaryTypographyProps={{ noWrap: true, fontWeight: c.unreadCount > 0 ? 700 : 500 }}
                  secondary={c.lastMessagePreview ?? '(Chưa có tin nhắn)'}
                  secondaryTypographyProps={{ noWrap: true, variant: 'caption' }}
                />
              </ListItemButton>
            );
          })}
        </Box>

        {/* RIGHT — chat window */}
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          {active ? (
            <>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 2 }}>
                <Avatar>
                  {active.type === 'Group'
                    ? 'G'
                    : (active.participantIds.find((id) => id !== currentUserId) ?? '?')[0]?.toUpperCase()}
                </Avatar>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap fontWeight={600}>
                    {active.type === 'Group'
                      ? active.name ?? `Nhóm ${active.participantIds.length} thành viên`
                      : active.participantIds.find((id) => id !== currentUserId)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {active.type === 'Group' ? `${active.participantIds.length} thành viên` : 'Chat 1:1'}
                  </Typography>
                </Stack>
              </Stack>
              <Divider />

              <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'background.neutral' }}>
                {loading && <CircularProgress size={20} />}
                {messages.map((m) => {
                  const mine = m.senderId === currentUserId;
                  return (
                    <Stack
                      key={m.id}
                      direction="row"
                      justifyContent={mine ? 'flex-end' : 'flex-start'}
                      sx={{ mb: 1 }}
                    >
                      <Box
                        sx={{
                          maxWidth: '70%',
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: mine ? 'primary.main' : 'background.paper',
                          color: mine ? 'primary.contrastText' : 'text.primary',
                          boxShadow: 1,
                        }}
                      >
                        {!mine && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {m.senderId}
                          </Typography>
                        )}
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {m.content}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', opacity: 0.7, mt: 0.5, textAlign: 'right' }}
                        >
                          {fDateTime(m.createdAt)}
                        </Typography>
                      </Box>
                    </Stack>
                  );
                })}
              </Box>

              <Divider />
              <Box component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Nhập tin nhắn..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoComplete="off"
                  />
                  <IconButton color="primary" type="submit" disabled={!draft.trim()}>
                    <Iconify icon="eva:paper-plane-fill" />
                  </IconButton>
                </Stack>
              </Box>
            </>
          ) : (
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{ flex: 1, color: 'text.secondary' }}
            >
              <Iconify icon="eva:message-circle-outline" width={64} />
              <Typography sx={{ mt: 1 }}>Chọn một cuộc hội thoại để bắt đầu</Typography>
            </Stack>
          )}
        </Stack>
      </Paper>

      <NewConversationDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={async (conversationId) => {
          setNewOpen(false);
          await reloadConversations();
          openConversation(conversationId);
        }}
      />
    </Container>
  );
}
