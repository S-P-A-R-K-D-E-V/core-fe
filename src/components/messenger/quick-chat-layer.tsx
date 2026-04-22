'use client';

import { useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import Iconify from 'src/components/iconify';

import { useMessengerStore, selectMessages, selectTyping } from 'src/store/messenger-store';
import { sendMessage as apiSendMessage } from 'src/api/messenger';
import { useMessengerCtx } from './messenger-provider';

import QuickChatWindow from './quick-chat-window';

// ----------------------------------------------------------------------

type Props = { currentUserId: string | null };

export default function QuickChatLayer({ currentUserId }: Props) {
  const { openQuickChats, notifQueue, openQuickChat, closeQuickChat, dismissNotif } =
    useMessengerStore();

  // Auto-dismiss notifications after 5 s
  useEffect(() => {
    if (notifQueue.length === 0) return undefined;
    const oldest = notifQueue[0];
    const remaining = 5000 - (Date.now() - oldest.at);
    const t = setTimeout(() => dismissNotif(oldest.id), Math.max(remaining, 100));
    return () => clearTimeout(t);
  }, [notifQueue, dismissNotif]);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'row-reverse',
        alignItems: 'flex-end',
        gap: 1.5,
        pointerEvents: 'none',
      }}
    >
      {/* Quick-chat windows — up to 3 */}
      <AnimatePresence>
        {openQuickChats.map((convId) => (
          <QuickChatWindow
            key={convId}
            convId={convId}
            currentUserId={currentUserId}
            onClose={() => closeQuickChat(convId)}
          />
        ))}
      </AnimatePresence>

      {/* Notification toasts (stacked above) */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 1,
          pointerEvents: 'none',
          zIndex: 1500,
        }}
      >
        <AnimatePresence>
          {notifQueue.map((notif) => (
            <m.div
              key={notif.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              style={{ pointerEvents: 'auto' }}
            >
              <Paper
                elevation={6}
                sx={{
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  cursor: 'pointer',
                  maxWidth: 280,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                }}
                onClick={() => {
                  dismissNotif(notif.id);
                  openQuickChat(notif.convId);
                }}
              >
                <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
                  {notif.senderName.charAt(0).toUpperCase()}
                </Avatar>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>{notif.senderName}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {notif.preview}
                  </Typography>
                </Stack>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); dismissNotif(notif.id); }}
                >
                  <Iconify icon="eva:close-fill" width={16} />
                </IconButton>
              </Paper>
            </m.div>
          ))}
        </AnimatePresence>
      </Box>
    </Box>
  );
}
