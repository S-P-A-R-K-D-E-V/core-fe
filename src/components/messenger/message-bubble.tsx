'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';
import { fTimeShort } from 'src/utils/format-time';
import { getStorageUrl } from 'src/utils/storage';

import type { DirectMessage, InternalUser, MessageAttachment } from 'src/api/messenger';

// ----------------------------------------------------------------------

const AVATAR_COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2',
  '#c2185b', '#0097a7', '#5d4037', '#455a64',
];

function colorFor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentItem({ att, mine }: { att: MessageAttachment; mine: boolean }) {
  const url = getStorageUrl(att.objectKey);
  if (att.kind === 'image') {
    return (
      <Box
        component="a"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ display: 'block', mt: 0.5 }}
      >
        <Box
          component="img"
          src={url}
          alt={att.fileName}
          loading="lazy"
          sx={{ maxWidth: 200, maxHeight: 200, borderRadius: 1, display: 'block', objectFit: 'cover' }}
        />
      </Box>
    );
  }
  return (
    <Stack
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        mt: 0.5,
        p: 1,
        borderRadius: 1,
        textDecoration: 'none',
        color: 'inherit',
        bgcolor: mine ? 'rgba(255,255,255,0.18)' : 'action.hover',
        maxWidth: 220,
      }}
    >
      <Iconify icon="solar:document-bold" width={24} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" noWrap sx={{ display: 'block', fontWeight: 600 }}>{att.fileName}</Typography>
        <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 10 }}>{formatSize(att.sizeBytes)}</Typography>
      </Box>
    </Stack>
  );
}

// ----------------------------------------------------------------------

type Props = {
  message: DirectMessage;
  mine: boolean;
  senderUser?: InternalUser;
  showName?: boolean;
  compact?: boolean;
  currentUserId?: string;
};

export default function MessageBubble({ message, mine, senderUser, showName, compact, currentUserId }: Props) {
  const initial = (senderUser?.fullName ?? message.senderId).charAt(0).toUpperCase();
  const displayName = senderUser?.fullName ?? message.senderId;

  const seenBy = (message.readBy ?? []).filter((r) => r.userId !== message.senderId);
  const isRead = seenBy.length > 0;

  const avatarSize = compact ? 26 : 32;

  return (
    <Stack
      direction={mine ? 'row-reverse' : 'row'}
      alignItems="flex-end"
      spacing={0.75}
      sx={{ mb: compact ? 0.75 : 1 }}
    >
      {/* Sender avatar (hidden for compact mine) */}
      {!mine && (
        <Tooltip title={displayName} placement="left">
          <Avatar
            src={senderUser?.avatarUrl ?? undefined}
            sx={{ width: avatarSize, height: avatarSize, fontSize: avatarSize * 0.45, bgcolor: colorFor(message.senderId), flexShrink: 0 }}
          >
            {initial}
          </Avatar>
        </Tooltip>
      )}
      {mine && <Box sx={{ width: avatarSize, flexShrink: 0 }} />}

      <Stack alignItems={mine ? 'flex-end' : 'flex-start'} sx={{ maxWidth: compact ? '85%' : '70%' }}>
        {/* Sender name (group chats) */}
        {showName && !mine && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.25, ml: 1 }}>
            {displayName}
          </Typography>
        )}

        {/* Bubble */}
        <Box
          sx={{
            px: compact ? 1.25 : 1.5,
            py: compact ? 0.75 : 1,
            borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            bgcolor: mine ? 'primary.main' : 'background.paper',
            color: mine ? 'primary.contrastText' : 'text.primary',
            boxShadow: 1,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content ? (
            <Typography variant={compact ? 'caption' : 'body2'}>
              {message.isDeleted ? <em style={{ opacity: 0.6 }}>Tin nhắn đã bị xoá</em> : message.content}
            </Typography>
          ) : null}
          {(message.attachments ?? []).map((att, i) => (
            <AttachmentItem key={att.objectKey + i} att={att} mine={mine} />
          ))}
        </Box>

        {/* Timestamp + Seen */}
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25, opacity: 0.65 }}>
          <Typography variant="caption" sx={{ fontSize: 10 }}>
            {fTimeShort(message.createdAt)}
          </Typography>
          {mine && (
            <Tooltip
              title={isRead ? seenBy.map((r) => r.userId).join(', ') : 'Chưa xem'}
              placement="top"
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Iconify
                  icon={isRead ? 'eva:checkmark-done-fill' : 'eva:checkmark-fill'}
                  width={14}
                  sx={{ color: isRead ? 'info.main' : 'inherit' }}
                />
              </Box>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}
