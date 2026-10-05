import { memo, useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { alpha, keyframes } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';

import type { ChatActivity } from 'src/hooks/use-chatbot';

import { getStorageUrl } from 'src/utils/storage';

import type { ChatbotMessage } from 'src/api/chatbot';

import Iconify from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import ChatbotMarkdown from './chatbot-markdown';
import ChatbotMessageBlocks from './chatbot-message-blocks';
import {
  stripUiFence,
  progressLabel,
  summarizeSteps,
  normalizeChatbotBlocks,
  type ChatbotUiToolAction,
} from './chatbot-blocks';

import type { ChatbotRouteUser } from './chatbot-routes';
import type { ChatbotQuickAction } from './chatbot-quick-actions';

// ----------------------------------------------------------------------
// Vùng tin nhắn của khung chat: trạng thái đang tải, lời chào + thẻ câu hỏi nhanh khi chưa có tin,
// danh sách bong bóng, và dòng báo lỗi cuối danh sách (kèm "Sửa và gửi lại").
//
// Không bao giờ có thanh cuộn ngang: vùng cuộn overflowX hidden, bong bóng minWidth 0 +
// overflowWrap anywhere, bảng / khối mã tự cuộn ngang bên trong (chatbot-markdown).
// ----------------------------------------------------------------------

/** Cách đáy vùng cuộn trong ngần này (px) thì coi là "đang ở cuối" → tin mới tự cuộn theo. */
const STICK_TO_BOTTOM_PX = 80;

const dotBounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
  40% { transform: translateY(-3px); opacity: 1; }
`;

/** Chỉ báo "đang trả lời" DUY NHẤT: ba chấm + nhãn hoạt động, nằm trong bong bóng của câu đang chạy. */
function TypingIndicator({ label }: { label: string }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      role="status"
      aria-live="polite"
      sx={{ py: 0.25, minWidth: 0 }}
    >
      <Stack direction="row" spacing={0.5} aria-hidden sx={{ flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: 'text.disabled',
              animation: `${dotBounce} 1.2s ease-in-out ${i * 0.16}s infinite`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.6 },
            }}
          />
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary" noWrap>
        {label}
      </Typography>
    </Stack>
  );
}

function BubbleCaption({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      spacing={0.5}
      sx={{ mt: 0.75, color: 'text.disabled' }}
    >
      {icon && <Iconify icon={icon} width={14} sx={{ mt: '2px', flexShrink: 0 }} />}
      <Typography variant="caption" sx={{ color: 'inherit', lineHeight: 1.4 }}>
        {children}
      </Typography>
    </Stack>
  );
}

// ----------------------------------------------------------------------

type RowProps = {
  message: ChatbotMessage;
  /** Nhãn tiến độ khi câu này đang được trả lời; null = không đang chạy. */
  progress: string | null;
  /** Hiện dòng tóm tắt các bước tra cứu (chỉ quản trị / nhân viên). */
  showSteps: boolean;
  user: ChatbotRouteUser;
  busy: boolean;
  onNavigate: (href: string) => void;
  onRequestTool: (action: ChatbotUiToolAction) => void;
  onCopy: (text: string) => void;
};

// memo: mỗi chunk stream làm cả danh sách vẽ lại — chỉ bong bóng có props đổi (thường chỉ câu đang
// stream) mới vẽ lại.
const MessageRow = memo(function MessageRow({
  message,
  progress,
  showSteps,
  user,
  busy,
  onNavigate,
  onRequestTool,
  onCopy,
}: RowProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const inProgress = progress !== null;

  // Khối từ server vẫn kiểm lại theo người dùng hiện tại (route được phép, ảnh / link an toàn).
  const blocks = useMemo(
    () => (isAssistant ? normalizeChatbotBlocks(message.blocks, user) : []),
    [isAssistant, message.blocks, user]
  );
  const text = isAssistant ? stripUiFence(message.content || '') : message.content || '';
  const hasText = text.trim().length > 0;
  const hasBlocks = blocks.some((b) => b.type !== 'suggestions');

  // Ảnh người dùng gửi kèm (từ app mobile, cùng phiên) — server trả đường dẫn /media đã ký.
  const sentImages = isUser
    ? (message.attachments ?? [])
        .filter((a) => a.kind === 'image' && typeof a.url === 'string' && a.url)
        .map((a) => getStorageUrl(a.url))
    : [];

  // Không vẽ bong bóng rỗng.
  if (!inProgress && !hasText && !hasBlocks && sentImages.length === 0) return null;

  const failed = message.status === 'error';
  const stepsSummary =
    showSteps && isAssistant && !inProgress ? summarizeSteps(message.steps) : null;

  return (
    <Stack
      direction="row"
      justifyContent={isUser ? 'flex-end' : 'flex-start'}
      sx={{ mb: 1.25, minWidth: 0 }}
    >
      <Box
        sx={{
          position: 'relative',
          minWidth: 0,
          // Khung mở rộng vẫn giữ dòng chữ dễ đọc.
          maxWidth: 'min(85%, 680px)',
          ...(isAssistant &&
            !inProgress &&
            hasText && {
              '&:hover .chatbot-copy, &:focus-within .chatbot-copy': { opacity: 1 },
            }),
        }}
      >
        <Paper
          elevation={0}
          sx={{
            px: 1.5,
            py: 1,
            minWidth: 0,
            borderRadius: 1.5,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            bgcolor: isUser ? 'primary.main' : 'background.paper',
            color: isUser ? 'primary.contrastText' : 'text.primary',
            ...(isUser && failed && { opacity: 0.6 }),
          }}
        >
          {isUser && sentImages.length > 0 && (
            <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.5, mb: hasText ? 0.75 : 0 }}>
              {sentImages.map((src) => (
                <Box
                  key={src}
                  component="a"
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Mở ảnh đã gửi trong tab mới"
                  sx={{
                    display: 'block',
                    width: 88,
                    height: 88,
                    borderRadius: 1,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    component="img"
                    src={src}
                    alt="Ảnh đã gửi"
                    loading="lazy"
                    sx={{ width: 1, height: 1, objectFit: 'cover', display: 'block' }}
                  />
                </Box>
              ))}
            </Stack>
          )}

          {isAssistant && hasText && <ChatbotMarkdown text={text} />}

          {!isAssistant && hasText && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {text}
            </Typography>
          )}

          {inProgress && (
            <Box sx={{ mt: hasText ? 0.75 : 0 }}>
              <TypingIndicator label={progress} />
            </Box>
          )}

          {isAssistant && !inProgress && hasBlocks && (
            <ChatbotMessageBlocks
              blocks={blocks}
              busy={busy}
              onNavigate={onNavigate}
              onRequestTool={onRequestTool}
            />
          )}

          {stepsSummary && (
            <BubbleCaption icon="solar:magnifer-bold-duotone">{stepsSummary}</BubbleCaption>
          )}

          {isAssistant && !inProgress && message.fromCache && (
            <BubbleCaption icon="solar:bolt-bold">Trả lời nhanh</BubbleCaption>
          )}

          {isAssistant && !inProgress && failed && (
            <BubbleCaption icon="solar:danger-triangle-bold">
              Câu trả lời chưa hoàn tất.
            </BubbleCaption>
          )}
        </Paper>

        {isUser && failed && (
          <Typography
            variant="caption"
            color="error"
            sx={{ display: 'block', textAlign: 'right', mt: 0.25 }}
          >
            Chưa gửi được
          </Typography>
        )}

        {isAssistant && !inProgress && hasText && (
          <Tooltip title="Sao chép" placement="top">
            <IconButton
              className="chatbot-copy"
              size="small"
              aria-label="Sao chép câu trả lời"
              onClick={() => onCopy(text)}
              sx={{
                position: 'absolute',
                top: 2,
                right: -32,
                opacity: 0,
                color: 'text.secondary',
                transition: (theme) => theme.transitions.create('opacity'),
                '&:focus-visible': { opacity: 1 },
                // Màn cảm ứng không có hover → luôn hiện mờ.
                '@media (hover: none)': { opacity: 0.6 },
              }}
            >
              <Iconify icon="solar:copy-bold" width={16} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Stack>
  );
});

// ----------------------------------------------------------------------

type EmptyStateProps = {
  greeting: { title: string; description: string };
  starters: ChatbotQuickAction[];
  disabled: boolean;
  expanded: boolean;
  onPick: (action: ChatbotQuickAction) => void;
};

function EmptyState({ greeting, starters, disabled, expanded, onPick }: EmptyStateProps) {
  return (
    <Stack
      alignItems="center"
      sx={{ pt: 2, pb: 1, mx: 'auto', maxWidth: 560, textAlign: 'center' }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          mb: 1.5,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'primary.main',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
        }}
      >
        <Iconify icon="solar:chat-round-dots-bold-duotone" width={28} />
      </Box>

      <Typography variant="subtitle1">{greeting.title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {greeting.description}
      </Typography>

      {starters.length > 0 && (
        <Box
          sx={{
            mt: 2.5,
            width: 1,
            display: 'grid',
            gap: 1,
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: expanded ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
            },
          }}
        >
          {starters.map((action) => (
            <ButtonBase
              key={action.id}
              disabled={disabled}
              onClick={() => onPick(action)}
              sx={{
                p: 1.25,
                gap: 1,
                minWidth: 0,
                borderRadius: 1.5,
                textAlign: 'left',
                justifyContent: 'flex-start',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                transition: (theme) => theme.transitions.create(['border-color', 'box-shadow']),
                '&:hover': { borderColor: 'primary.main' },
                '&.Mui-focusVisible': { borderColor: 'primary.main', boxShadow: 2 },
                '&.Mui-disabled': { opacity: 0.5 },
              }}
            >
              <Iconify
                icon={action.icon}
                width={22}
                sx={{ color: 'primary.main', flexShrink: 0 }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, minWidth: 0 }}>
                {action.label}
              </Typography>
            </ButtonBase>
          ))}
        </Box>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ mt: 2 }}>
        Mẹo: gõ <b>/</b> trong ô nhập để xem các lệnh nhanh.
      </Typography>
    </Stack>
  );
}

// ----------------------------------------------------------------------

type Props = {
  ready: boolean;
  /** Không mở được phiên — chỉ hiện lỗi + nút "Thử lại". */
  offline: boolean;
  messages: ChatbotMessage[];
  busy: boolean;
  streamingMessageId: string | null;
  activity: ChatActivity;
  error: string | null;
  /** Lượt hỏi gần nhất thất bại → hiện dòng lỗi + "Sửa và gửi lại". */
  turnFailed: boolean;
  /** Có câu của người dùng để đưa lại vào ô nhập. */
  canRetry: boolean;
  showSteps: boolean;
  expanded: boolean;
  user: ChatbotRouteUser;
  greeting: { title: string; description: string };
  starters: ChatbotQuickAction[];
  onQuickAction: (action: ChatbotQuickAction) => void;
  /** Gửi câu lệnh của nút thao tác sau khi người dùng xác nhận. */
  onSend: (prompt: string) => void;
  onNavigate: (href: string) => void;
  onRetry: () => void;
  onReconnect: () => void;
  onCopy: (text: string) => void;
};

export default function ChatbotMessages({
  ready,
  offline,
  messages,
  busy,
  streamingMessageId,
  activity,
  error,
  turnFailed,
  canRetry,
  showSteps,
  expanded,
  user,
  greeting,
  starters,
  onQuickAction,
  onSend,
  onNavigate,
  onRetry,
  onReconnect,
  onCopy,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);

  // Nút thao tác (action kind=tool): bấm chỉ mở hộp xác nhận; đồng ý thì GỬI prompt như tin nhắn
  // thường — trợ lý tự gọi công cụ qua kiểm quyền phía server. Không bao giờ tự chạy gì ở đây.
  const [toolDialog, setToolDialog] = useState<{
    open: boolean;
    action: ChatbotUiToolAction | null;
  }>({
    open: false,
    action: null,
  });

  const handleRequestTool = useCallback((action: ChatbotUiToolAction) => {
    setToolDialog({ open: true, action });
  }, []);

  const handleCloseTool = useCallback(() => {
    setToolDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const handleConfirmTool = () => {
    const { action } = toolDialog;
    handleCloseTool();
    if (action) onSend(action.prompt);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
  };

  const last = messages[messages.length - 1];
  const lastId = last?.id;
  const lastRole = last?.role;

  // Người dùng vừa gửi câu mới → luôn về cuối, kể cả khi đang kéo lên đọc lại.
  useEffect(() => {
    if (lastRole === 'user') stickRef.current = true;
  }, [lastId, lastRole]);

  // Mở khung (component vừa mount), có tin mới, đang stream (messages đổi theo từng chunk) → cuộn
  // xuống cuối, trừ khi người dùng đã kéo lên đọc lại.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, ready, busy, activity, error, turnFailed]);

  const online = ready && !offline;
  const showError = !!error || turnFailed;
  const toolAction = toolDialog.action;

  return (
    <Box
      ref={scrollRef}
      onScroll={handleScroll}
      sx={{
        flexGrow: 1,
        minHeight: 0,
        p: 2,
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
        bgcolor: (theme) => (theme.palette.mode === 'light' ? 'grey.100' : 'grey.900'),
      }}
    >
      {!ready && (
        <Stack alignItems="center" justifyContent="center" sx={{ height: 1 }}>
          <CircularProgress size={24} aria-label="Đang kết nối trợ lý" />
        </Stack>
      )}

      {ready && offline && (
        <Stack
          role="alert"
          alignItems="center"
          justifyContent="center"
          spacing={1.5}
          sx={{ height: 1, px: 2, textAlign: 'center' }}
        >
          <Iconify icon="solar:danger-triangle-bold" width={32} sx={{ color: 'warning.main' }} />
          <Typography variant="body2" color="text.secondary">
            {error || 'Không kết nối được trợ lý.'}
          </Typography>
          <Button size="small" variant="outlined" onClick={onReconnect}>
            Thử lại
          </Button>
        </Stack>
      )}

      {online && messages.length === 0 && (
        <EmptyState
          greeting={greeting}
          starters={starters}
          disabled={busy}
          expanded={expanded}
          onPick={onQuickAction}
        />
      )}

      {online &&
        messages.map((m) => (
          <MessageRow
            key={m.id}
            message={m}
            progress={
              m.role === 'assistant' && m.status === 'pending'
                ? progressLabel({
                    steps: m.steps,
                    activity: m.id === streamingMessageId ? activity : null,
                    hasContent: !!(m.content && m.content.trim()),
                  })
                : null
            }
            showSteps={showSteps}
            user={user}
            busy={busy}
            onNavigate={onNavigate}
            onRequestTool={handleRequestTool}
            onCopy={onCopy}
          />
        ))}

      {online && showError && (
        <Stack
          role="alert"
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          sx={{
            mt: 0.5,
            px: 1.25,
            py: 0.75,
            gap: 1,
            borderRadius: 1,
            color: 'error.main',
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
          }}
        >
          <Iconify icon="solar:danger-triangle-bold" width={18} sx={{ flexShrink: 0 }} />
          <Typography variant="caption" sx={{ flex: '1 1 160px', color: 'inherit', minWidth: 0 }}>
            {error || 'Câu trả lời bị gián đoạn.'}
          </Typography>
          {turnFailed && canRetry && (
            <Button size="small" color="error" variant="outlined" disabled={busy} onClick={onRetry}>
              Sửa và gửi lại
            </Button>
          )}
        </Stack>
      )}

      <ConfirmDialog
        open={toolDialog.open}
        onClose={handleCloseTool}
        // Khung chat nằm ở zIndex 1400, cao hơn modal mặc định (1300).
        sx={{ zIndex: (theme) => theme.zIndex.modal + 200 }}
        title={toolAction?.confirm.title ?? ''}
        content={
          toolAction ? (
            <>
              {toolAction.confirm.message}
              {toolAction.confirm.message !== toolAction.prompt && (
                // Luôn cho thấy đúng câu sẽ gửi — lời giải thích do model viết không được che nó.
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'background.neutral',
                    overflowWrap: 'anywhere',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Câu sẽ gửi cho trợ lý:
                  </Typography>
                  {toolAction.prompt}
                </Box>
              )}
            </>
          ) : null
        }
        action={
          <Button variant="contained" onClick={handleConfirmTool}>
            Gửi yêu cầu
          </Button>
        }
      />
    </Box>
  );
}
