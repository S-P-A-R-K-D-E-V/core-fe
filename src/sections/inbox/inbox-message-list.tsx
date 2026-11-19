'use client';

import type { ConversationKind, ConversationMessage } from 'src/lib/inbox';

import { useRef, useMemo, useEffect, useLayoutEffect } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { fTime, fTimeShort } from 'src/utils/format-time';

import {
  senderLabel,
  imageAttachments,
  needsTimeSeparator,
  outgoingSenderCaption,
  canToggleCommentHidden,
} from 'src/lib/inbox';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Lightbox, { useLightBox } from 'src/components/lightbox';

// ----------------------------------------------------------------------
// Bong bóng tin của một hội thoại (kiểu Meta Business Suite). perspective:
//   - 'shop'     : tin khách bên trái (xám), tin shop / agent bên phải (xanh) kèm dòng "Người gửi: …"; ghi chú nội bộ nền
//                  vàng, gợi ý của agent nền xanh nhạt viền đứt.
// Mốc giờ ở giữa khung khi sang ngày khác hoặc cách tin trước > 15 phút.
//   - 'customer' : Kênh thử — ô chat của "khách": tin khách bên phải, ẩn ghi chú nội bộ.
// Tự cuộn xuống cuối khi mở hội thoại và khi có tin mới (nếu đang ở gần cuối).
// Hội thoại bình luận: bình luận của khách có nút Ẩn / Hiện lại (người có quyền trả lời); bình luận đã ẩn mờ đi + nhãn "Đã ẩn".
// ----------------------------------------------------------------------

type Props = {
  messages: ConversationMessage[];
  loading: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: VoidFunction;
  /** Gửi lại tin lỗi (chỉ phía shop). */
  onResend?: (message: ConversationMessage) => void;
  resendingId?: string | null;
  /** Gợi ý của agent → đổ vào ô soạn (chỉ phía shop, người có quyền trả lời). */
  onUseSuggestion?: (message: ConversationMessage) => void;
  perspective?: 'shop' | 'customer';
  customerAvatarUrl?: string | null;
  /** Đổi khi mở hội thoại khác → cuộn xuống cuối. */
  conversationId: string | null;
  /** Loại hội thoại — comment mới có Ẩn / Hiện lại. */
  conversationKind?: ConversationKind;
  /** Ẩn / hiện lại bình luận của khách (chỉ phía shop, người có quyền trả lời). */
  onToggleHidden?: (message: ConversationMessage) => void;
  togglingId?: string | null;
};

const ATTACHMENT_ICON: Record<string, string> = {
  video: 'solar:videocamera-record-bold',
  audio: 'solar:music-note-bold',
  file: 'solar:file-text-bold',
  link: 'solar:link-bold',
};

export default function InboxMessageList({
  messages,
  loading,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  onResend,
  resendingId,
  onUseSuggestion,
  perspective = 'shop',
  customerAvatarUrl,
  conversationId,
  conversationKind,
  onToggleHidden,
  togglingId,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const lastId = useRef<string | null>(null);
  const firstId = useRef<string | null>(null);
  const prevHeight = useRef(0);

  const visible = useMemo(
    () => (perspective === 'customer' ? messages.filter((m) => !m.isInternalNote) : messages),
    [messages, perspective]
  );

  const slides = useMemo(
    () => visible.flatMap((m) => imageAttachments(m).map((a) => ({ src: a.url }))),
    [visible]
  );
  const lightbox = useLightBox(slides);

  // Mở hội thoại khác → về cuối.
  useEffect(() => {
    nearBottom.current = true;
    lastId.current = null;
    firstId.current = null;
  }, [conversationId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || visible.length === 0) return;
    const newFirst = visible[0].id;
    const newLast = visible[visible.length - 1].id;

    if (firstId.current && newFirst !== firstId.current && newLast === lastId.current) {
      // Vừa tải tin cũ hơn ở đầu → giữ nguyên chỗ đang đọc.
      el.scrollTop = el.scrollHeight - prevHeight.current + el.scrollTop;
    } else if (newLast !== lastId.current && (nearBottom.current || lastId.current === null)) {
      el.scrollTop = el.scrollHeight;
    }
    firstId.current = newFirst;
    lastId.current = newLast;
    prevHeight.current = el.scrollHeight;
  }, [visible]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    prevHeight.current = el.scrollHeight;
  };

  return (
    <Box
      ref={scrollRef}
      onScroll={handleScroll}
      sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 1.5, md: 2.5 }, py: 2 }}
    >
      {loading && (
        <Stack alignItems="center" sx={{ py: 5 }}>
          <CircularProgress size={24} />
        </Stack>
      )}

      {hasOlder && !loading && (
        <Stack alignItems="center" sx={{ mb: 2 }}>
          <Button size="small" color="inherit" onClick={onLoadOlder} disabled={loadingOlder}>
            {loadingOlder ? 'Đang tải…' : 'Xem tin cũ hơn'}
          </Button>
        </Stack>
      )}

      {!loading && visible.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 5 }}>
          Chưa có tin nhắn.
        </Typography>
      )}

      {visible.map((m, i) => {
        const separator = needsTimeSeparator(visible[i - 1], m);
        return (
          <Box key={m.id}>
            {separator && (
              <Typography
                variant="caption"
                component="div"
                sx={{ textAlign: 'center', color: 'text.disabled', fontWeight: 600, my: 2 }}
              >
                {fTimeShort(m.sentAt)}
              </Typography>
            )}
            <MessageBubble
              message={m}
              perspective={perspective}
              customerAvatarUrl={customerAvatarUrl}
              onOpenImage={lightbox.onOpen}
              onResend={onResend}
              onUseSuggestion={onUseSuggestion}
              resending={resendingId === m.id}
              onToggleHidden={
                perspective === 'shop' && onToggleHidden && canToggleCommentHidden(m, conversationKind)
                  ? onToggleHidden
                  : undefined
              }
              toggling={togglingId === m.id}
            />
          </Box>
        );
      })}

      <Lightbox index={lightbox.selected} slides={slides} open={lightbox.open} close={lightbox.onClose} />
    </Box>
  );
}

// ----------------------------------------------------------------------

type BubbleProps = {
  message: ConversationMessage;
  perspective: 'shop' | 'customer';
  customerAvatarUrl?: string | null;
  onOpenImage: (url: string) => void;
  onResend?: (message: ConversationMessage) => void;
  onUseSuggestion?: (message: ConversationMessage) => void;
  resending: boolean;
  onToggleHidden?: (message: ConversationMessage) => void;
  toggling: boolean;
};

function MessageBubble({
  message: m,
  perspective,
  customerAvatarUrl,
  onOpenImage,
  onResend,
  onUseSuggestion,
  resending,
  onToggleHidden,
  toggling,
}: BubbleProps) {
  const fromCustomer = m.direction === 'in';
  const right = perspective === 'customer' ? fromCustomer : !fromCustomer;
  const images = imageAttachments(m);
  const others = m.attachments.filter((a) => a.type !== 'image');
  const suggestion = m.status === 'suggested';
  const note = m.isInternalNote && !suggestion;
  const failed = m.status === 'failed';
  const hidden = m.status === 'hidden';

  const caption = suggestion
    ? `Gợi ý của ${senderLabel(m)} · chưa gửi khách`
    : note
      ? `Ghi chú nội bộ · ${senderLabel(m)}`
      : null;
  /** Tin shop / agent đã gửi khách (bong bóng xanh). */
  const outgoing = right && !note && !suggestion;
  const senderCaption = perspective === 'shop' && !fromCustomer && !note && !suggestion ? outgoingSenderCaption(m) : null;

  return (
    <Stack direction="row" justifyContent={right ? 'flex-end' : 'flex-start'} sx={{ mb: 2 }}>
      {!right && fromCustomer && perspective === 'shop' && (
        <Avatar src={customerAvatarUrl ?? undefined} sx={{ width: 32, height: 32, mr: 1.5, mt: 0.5 }}>
          {senderLabel(m).charAt(0).toUpperCase()}
        </Avatar>
      )}

      <Stack alignItems={right ? 'flex-end' : 'flex-start'} sx={{ maxWidth: { xs: '85%', md: '70%' } }}>
        {caption && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
            {note && <Iconify icon="solar:notes-bold" width={14} sx={{ color: 'warning.dark' }} />}
            {m.senderType === 'agent' && suggestion && (
              <Iconify icon="solar:cpu-bolt-bold" width={14} sx={{ color: 'info.main' }} />
            )}
            <Typography
              variant="caption"
              sx={{ color: note ? 'warning.dark' : suggestion ? 'info.dark' : 'text.disabled' }}
            >
              {caption}
            </Typography>
          </Stack>
        )}

        {(m.text || others.length > 0) && (
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: 2.25,
              typography: 'body2',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              bgcolor: 'background.neutral',
              ...(outgoing && {
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '& a': { color: 'inherit' },
              }),
              ...(note && {
                bgcolor: 'warning.lighter',
                color: 'grey.800',
                border: (theme) => `dashed 1px ${theme.palette.warning.main}`,
              }),
              ...(suggestion && {
                bgcolor: 'info.lighter',
                color: 'grey.800',
                border: (theme) => `dashed 1px ${theme.palette.info.main}`,
              }),
              ...(failed && { border: (theme) => `solid 1px ${theme.palette.error.main}` }),
              ...(hidden && {
                opacity: 0.6,
                color: 'text.secondary',
                border: (theme) => `dashed 1px ${theme.palette.divider}`,
              }),
            }}
          >
            {m.text}
            {others.map((a) => (
              <Stack key={a.url} direction="row" spacing={0.5} alignItems="center" sx={{ mt: m.text ? 0.5 : 0 }}>
                <Iconify icon={ATTACHMENT_ICON[a.type] ?? 'solar:paperclip-bold'} width={16} />
                <Link href={a.url} target="_blank" rel="noopener noreferrer" variant="body2" noWrap>
                  {a.name || a.url}
                </Link>
              </Stack>
            ))}
          </Box>
        )}

        {images.length > 0 && (
          <Box
            sx={{
              mt: m.text ? 0.75 : 0,
              display: 'grid',
              gap: 0.5,
              gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, ${images.length === 1 ? '220px' : '96px'})`,
              maxWidth: '100%',
              ...(hidden && { opacity: 0.5 }),
            }}
          >
            {images.map((a) => (
              <Box
                key={a.url}
                component="img"
                src={a.url}
                alt={a.name ?? 'Ảnh'}
                loading="lazy"
                onClick={() => onOpenImage(a.url)}
                sx={{
                  width: 1,
                  height: images.length === 1 ? 'auto' : 96,
                  maxHeight: 280,
                  objectFit: 'cover',
                  borderRadius: 1,
                  cursor: 'zoom-in',
                  bgcolor: 'background.neutral',
                  ...(note && { outline: (theme) => `dashed 1px ${theme.palette.warning.main}` }),
                }}
              />
            ))}
          </Box>
        )}

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {fTime(m.sentAt)}
          </Typography>
          {senderCaption && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'text.secondary' }}>
              {m.senderType === 'agent' && <Iconify icon="solar:cpu-bolt-bold" width={12} sx={{ color: 'info.main' }} />}
              <Typography variant="caption">{senderCaption}</Typography>
            </Stack>
          )}
          {hidden && (
            <Label color="default" variant="soft" startIcon={<Iconify icon="solar:eye-closed-bold" width={12} />}>
              Đã ẩn
            </Label>
          )}
          {onToggleHidden && (
            <Button
              size="small"
              color="inherit"
              disabled={toggling}
              onClick={() => onToggleHidden(m)}
              startIcon={<Iconify icon={hidden ? 'solar:eye-bold' : 'solar:eye-closed-bold'} width={16} />}
              sx={{ minWidth: 0, px: 1, py: 0, color: 'text.secondary' }}
            >
              {toggling ? 'Đang lưu…' : hidden ? 'Hiện lại' : 'Ẩn'}
            </Button>
          )}
          {m.status === 'sending' && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              Đang gửi…
            </Typography>
          )}
          {suggestion && perspective === 'shop' && onUseSuggestion && (
            <Button
              size="small"
              color="info"
              startIcon={<Iconify icon="solar:pen-new-square-bold" width={16} />}
              onClick={() => onUseSuggestion(m)}
              sx={{ minWidth: 0, px: 1, py: 0 }}
            >
              Dùng gợi ý
            </Button>
          )}
        </Stack>

        {failed && perspective === 'shop' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
            <Iconify icon="solar:danger-triangle-bold" width={14} sx={{ color: 'error.main' }} />
            <Typography variant="caption" sx={{ color: 'error.main' }}>
              {m.error || 'Gửi không thành công'}
            </Typography>
            {onResend && (
              <Button
                size="small"
                color="error"
                onClick={() => onResend(m)}
                disabled={resending}
                sx={{ minWidth: 0, px: 1, py: 0 }}
              >
                {resending ? 'Đang gửi…' : 'Gửi lại'}
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
