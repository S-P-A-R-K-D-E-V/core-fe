'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Fab from '@mui/material/Fab';
import Box from '@mui/material/Box';
import Grow from '@mui/material/Grow';
import Zoom from '@mui/material/Zoom';
import Paper from '@mui/material/Paper';
import Badge from '@mui/material/Badge';

import { useRouter } from 'src/routes/hooks';

import { useChatbot } from 'src/hooks/use-chatbot';
import { useResponsive } from 'src/hooks/use-responsive';
import { useCopyToClipboard } from 'src/hooks/use-copy-to-clipboard';

import { useAuthContext } from 'src/auth/hooks';
import { chatbotCallbackOrder } from 'src/api/chatbot';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useStoreBrand } from 'src/components/branding';

import ChatbotMessages from './chatbot-messages';
import { suggestionsOf, normalizeChatbotBlocks } from './chatbot-blocks';
import ChatbotComposer, { type ChatbotChip } from './chatbot-composer';
import ChatbotHeader, { type ChatbotHeaderStatus } from './chatbot-header';
import ChatbotGuestGate, { type ChatbotGuestInfo } from './chatbot-guest-gate';
import {
  chatbotHeader,
  chatbotGreeting,
  quickActionsFor,
  resolveChatbotAudience,
  CHATBOT_CALLBACK_ACTION,
  type ChatbotQuickAction,
} from './chatbot-quick-actions';

import type { ChatbotRouteUser } from './chatbot-routes';
import type { ChatbotLocalCommandId } from './chatbot-commands';

// ----------------------------------------------------------------------
// Khung chat trợ lý AI nổi ở góc phải dưới (mọi trang dashboard + trang công khai).
//
// File này chỉ ráp các phần và giữ state của khung (mở / mở rộng / bản nháp / chấm chưa đọc):
//   chatbot-header         tên trợ lý theo đối tượng + trạng thái + nút
//   chatbot-messages       danh sách tin, lời chào + thẻ câu hỏi nhanh, dòng báo lỗi
//   chatbot-composer       chip câu hỏi nhanh, lệnh "/…", ô nhập
//   chatbot-guest-gate     khách chưa đăng nhập nhập Tên + SĐT
// Phiên, tin nhắn, SignalR: src/hooks/use-chatbot.
//
// Đối tượng (quản trị / nhân viên / khách) lấy theo PHIÊN của server (agent + tier); trước khi phiên
// về thì tạm theo vai trò đăng nhập.
// ----------------------------------------------------------------------

// Cho phép các section khác (vd CTA "Chat ngay với CiCi AI" ở trang chủ) mở widget từ xa —
// widget là component global độc lập, không có context/store dùng chung nên dùng custom event.
export const OPEN_CHATBOT_EVENT = 'cici:open-chat';

const GUEST_INFO_KEY = 'chatbot.guestInfo';
const EXPANDED_KEY = 'chatbot.expanded';

/** Chỗ dành cho nút tròn (56px) + khe hở khi khung thu gọn nằm phía trên nút. */
const FAB_CLEARANCE = 64;

function loadGuestInfo(): ChatbotGuestInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GUEST_INFO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.name && parsed?.phone) return parsed as ChatbotGuestInfo;
    return null;
  } catch {
    return null;
  }
}

function loadExpanded(): boolean {
  try {
    return localStorage.getItem(EXPANDED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveExpanded(value: boolean) {
  try {
    localStorage.setItem(EXPANDED_KEY, value ? '1' : '0');
  } catch {
    /* localStorage bị chặn — chỉ nhớ trong tab này */
  }
}

type Props = {
  defaultOpen?: boolean;
};

export default function ChatbotWidget({ defaultOpen = false }: Props) {
  const { user, loading: authLoading } = useAuthContext();
  // Tên xưng hô trong khung chat theo cửa hàng đang mở (CiCi giữ "CiCi").
  const { brandName } = useStoreBrand();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { copy } = useCopyToClipboard();
  // copy đổi identity mỗi lần render — giữ qua ref để các callback (và memo của từng bong bóng) ổn định.
  const copyRef = useRef(copy);
  copyRef.current = copy;
  // Màn nhỏ: khung mở luôn toàn màn hình.
  const isXs = useResponsive('down', 'sm');

  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  /** Đóng khung lúc nút tròn đang ẩn → chờ nút hiện lại rồi mới trả focus cho nó. */
  const pendingFabFocusRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  // Khách chưa đăng nhập phải nhập Tên + SĐT trước khi chat — lưu localStorage nên lần
  // sau quay lại không phải nhập lại (đồng bộ tinh thần "giữ phiên" đã có cho session_id).
  const [guestInfo, setGuestInfo] = useState<ChatbotGuestInfo | null>(null);
  /** Đã đọc xong localStorage (chỉ đọc được sau khi mount — tránh lệch với HTML dựng ở server). */
  const [storageLoaded, setStorageLoaded] = useState(false);

  useEffect(() => {
    setGuestInfo(loadGuestInfo());
    setExpanded(loadExpanded());
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    const handleOpenRequest = () => setOpen(true);
    window.addEventListener(OPEN_CHATBOT_EVENT, handleOpenRequest);
    return () => window.removeEventListener(OPEN_CHATBOT_EVENT, handleOpenRequest);
  }, []);

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
    : (guestInfo?.name ?? null);

  const {
    ready,
    session,
    messages,
    busy,
    streamingMessageId,
    activity,
    connection,
    error,
    turnFailed,
    lastUserText,
    lastReplyAt,
    sendMessage,
    startNewSession,
    reconnect,
  } = useChatbot({
    phone: user?.phoneNumber ?? guestInfo?.phone ?? null,
    displayName,
    userId: user?.id ?? null,
    // Chờ biết chắc ai đang hỏi (đã đăng nhập hay chưa, khách cũ đã để lại SĐT hay chưa) rồi mới mở
    // phiên — không mở một phiên khách thừa rồi mở lại ngay.
    enabled: !authLoading && storageLoaded,
  });

  // Chấm "chưa đọc": có câu trả lời hoàn tất trong lúc khung đang đóng; mở khung thì xoá.
  useEffect(() => {
    if (lastReplyAt && !openRef.current) setUnread(true);
  }, [lastReplyAt]);

  useEffect(() => {
    if (open) {
      setUnread(false);
    } else if (pendingFabFocusRef.current) {
      pendingFabFocusRef.current = false;
      fabRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  // Đóng khung từ bên trong (nút Đóng, Esc, sau khi mở trang ở màn nhỏ): trả focus về nút tròn để
  // người dùng bàn phím không bị mất chỗ đứng.
  const closePanel = useCallback(() => {
    if (fabRef.current) fabRef.current.focus({ preventScroll: true });
    else pendingFabFocusRef.current = true;
    setOpen(false);
  }, []);

  // ---------------------------------------------------------------------- đối tượng

  // Phiên của server quyết định. Lúc đang đổi danh tính (vừa đăng nhập / đăng xuất, phiên cũ chưa
  // được thay) thì phiên đang giữ chưa đáng tin → tạm theo vai trò đăng nhập.
  const trustSession = !!session && (ready || (session.ownerType === 'User') === !!user);
  const tier = trustSession ? (session?.tier ?? null) : null;
  const audience = resolveChatbotAudience({
    agent: trustSession ? session?.agent : null,
    tier,
    role: user?.role,
    roles: user?.roles,
  });

  const userRole: string | null = user?.role ?? null;
  const userRoles: string[] | null = user?.roles ?? null;
  const userFeatures: string[] | null = user?.enabledFeatures ?? null;
  const routeUser = useMemo<ChatbotRouteUser>(
    () =>
      userRole || userRoles
        ? { role: userRole, roles: userRoles, enabledFeatures: userFeatures }
        : null,
    [userRole, userRoles, userFeatures]
  );

  const guestPhone: string | null = !user ? (guestInfo?.phone ?? null) : null;
  const identityPending = !!authLoading || !storageLoaded;
  const needsGuestGate = !identityPending && !user && !guestInfo;
  const panelReady = ready && !identityPending;

  // ---------------------------------------------------------------------- hành động

  const handleSend = useCallback(
    (text: string) => {
      if (!ready || busy) return;
      void sendMessage(text, guestPhone);
    },
    [ready, busy, sendMessage, guestPhone]
  );

  const lastContent = messages[messages.length - 1]?.content;
  const sessionId = session?.sessionId ?? null;

  // "Gọi lại đặt hàng" (khách đã để lại SĐT): báo cửa hàng qua callback-order rồi mới gửi câu nhắn.
  const handleCallback = useCallback(async () => {
    if (!sessionId || !guestPhone || !ready || busy) return;
    try {
      await chatbotCallbackOrder({ sessionId, phone: guestPhone, content: lastContent });
      await sendMessage(CHATBOT_CALLBACK_ACTION.prompt, guestPhone);
    } catch (err) {
      console.error('Callback failed', err);
      enqueueSnackbar('Chưa gửi được yêu cầu gọi lại. Vui lòng thử lại.', { variant: 'error' });
    }
  }, [sessionId, guestPhone, ready, busy, lastContent, sendMessage, enqueueSnackbar]);

  // Bấm thẻ / chip câu hỏi nhanh: gửi luôn, rồi đưa focus về ô nhập (thẻ vừa bấm sẽ biến mất hoặc bị
  // khoá). Màn nhỏ thì không — focus ô nhập sẽ bật bàn phím che mất câu trả lời.
  const handleShortcut = useCallback(
    (prompt: string) => {
      handleSend(prompt);
      if (!isXs) inputRef.current?.focus();
    },
    [handleSend, isXs]
  );

  const handleQuickAction = useCallback(
    (action: ChatbotQuickAction) => {
      if (action.id === CHATBOT_CALLBACK_ACTION.id) void handleCallback();
      else handleShortcut(action.prompt);
    },
    [handleCallback, handleShortcut]
  );

  const handleNewSession = useCallback(async () => {
    if (!ready) return;
    const ok = await startNewSession();
    if (ok) {
      enqueueSnackbar('Đã bắt đầu trò chuyện mới');
    } else {
      enqueueSnackbar('Không tạo được cuộc trò chuyện mới. Vui lòng thử lại.', {
        variant: 'error',
      });
    }
  }, [ready, startNewSession, enqueueSnackbar]);

  const handleToggleExpand = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    saveExpanded(next);
    if (isXs) {
      enqueueSnackbar('Trên màn hình nhỏ, khung chat luôn mở toàn màn hình.', { variant: 'info' });
    }
  }, [expanded, isXs, enqueueSnackbar]);

  const handleCopySession = useCallback(async () => {
    if (!sessionId) {
      enqueueSnackbar('Chưa có phiên trò chuyện để sao chép.', { variant: 'warning' });
      return;
    }
    const ok = await copyRef.current(sessionId);
    enqueueSnackbar(ok ? 'Đã sao chép mã phiên' : 'Không sao chép được mã phiên', {
      variant: ok ? 'success' : 'error',
    });
  }, [sessionId, enqueueSnackbar]);

  const handleLocalCommand = useCallback(
    (id: Exclude<ChatbotLocalCommandId, 'help'>) => {
      if (id === 'new-session') void handleNewSession();
      else if (id === 'toggle-expand') handleToggleExpand();
      else void handleCopySession();
    },
    [handleNewSession, handleToggleExpand, handleCopySession]
  );

  const handleCopyMessage = useCallback(
    async (text: string) => {
      const ok = await copyRef.current(text);
      enqueueSnackbar(ok ? 'Đã sao chép' : 'Không sao chép được', {
        variant: ok ? 'success' : 'error',
      });
    },
    [enqueueSnackbar]
  );

  const handleNavigate = useCallback(
    (href: string) => {
      router.push(href);
      // Màn nhỏ khung đang che cả trang → đóng lại để thấy trang vừa mở.
      if (isXs) closePanel();
    },
    [router, isXs, closePanel]
  );

  // "Sửa và gửi lại": đưa câu vừa gửi vào lại ô nhập — KHÔNG tự gửi.
  const handleRetry = useCallback(() => {
    if (!lastUserText) return;
    setDraft(lastUserText);
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(lastUserText.length, lastUserText.length);
    }, 0);
  }, [lastUserText]);

  const handleGuestInfoSubmit = useCallback((info: ChatbotGuestInfo) => {
    try {
      localStorage.setItem(GUEST_INFO_KEY, JSON.stringify(info));
    } catch {
      /* localStorage bị chặn — chỉ nhớ trong tab này */
    }
    setGuestInfo(info);
  }, []);

  // ---------------------------------------------------------------------- câu hỏi nhanh

  const defaultActions = useMemo(() => {
    const actions = quickActionsFor(audience, tier);
    return guestPhone ? [...actions, CHATBOT_CALLBACK_ACTION] : actions;
  }, [audience, tier, guestPhone]);

  // Câu trả lời MỚI NHẤT đã xong có khối gợi ý → chip là các câu hỏi tiếp theo theo ngữ cảnh.
  const lastMessage = messages[messages.length - 1];
  const followUps = useMemo(() => {
    if (!lastMessage || lastMessage.role !== 'assistant') return [];
    if (lastMessage.status === 'pending' || lastMessage.status === 'error') return [];
    return suggestionsOf(normalizeChatbotBlocks(lastMessage.blocks, routeUser));
  }, [lastMessage, routeUser]);

  const hasFollowUps = followUps.length > 0;

  let chips: ChatbotChip[] = [];
  // Chưa có tin nào thì câu hỏi nhanh đã nằm ở thẻ giữa khung — không lặp lại ở hàng chip.
  if (messages.length > 0) {
    chips = hasFollowUps
      ? followUps.map((item, index) => ({
          key: `follow-${index}-${item.label}`,
          label: item.label,
          title: item.prompt !== item.label ? item.prompt : undefined,
          onClick: () => handleShortcut(item.prompt),
        }))
      : defaultActions
          .filter((action) => action.id !== CHATBOT_CALLBACK_ACTION.id)
          .map((action) => ({
            key: action.id,
            label: action.label,
            title: action.prompt,
            icon: action.icon,
            onClick: () => handleQuickAction(action),
          }));

    if (guestPhone) {
      chips.push({
        key: CHATBOT_CALLBACK_ACTION.id,
        label: CHATBOT_CALLBACK_ACTION.label,
        icon: CHATBOT_CALLBACK_ACTION.icon,
        onClick: () => void handleCallback(),
      });
    }
  }

  // ---------------------------------------------------------------------- hiển thị

  let status: ChatbotHeaderStatus = 'ready';
  if (!panelReady) status = 'connecting';
  else if (!session || connection === 'error') status = 'offline';
  else if (busy) status = 'replying';
  else if (connection === 'connecting') status = 'connecting';

  const header = chatbotHeader(audience, brandName);
  const greeting = chatbotGreeting(audience, brandName, user ? displayName : null);
  const hideFab = open && (isXs || expanded);

  // Esc đóng khung. Danh sách lệnh và hộp xác nhận tự xử lý Esc của mình (không lan tới đây).
  const handlePanelKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing) return;
    closePanel();
  };

  return (
    <Box sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1400 }}>
      <Grow in={open} mountOnEnter unmountOnExit style={{ transformOrigin: 'bottom right' }}>
        {/* Lớp ngoài nhận hiệu ứng mở/đóng của Grow; lớp trong tự chuyển kích thước khi mở rộng. */}
        <Box
          sx={{
            position: { xs: 'fixed', sm: 'absolute' },
            top: { xs: 0, sm: 'auto' },
            left: { xs: 0, sm: 'auto' },
            right: 0,
            bottom: 0,
            // Khoảng trống dành cho nút tròn bên dưới khung không được chặn chuột của trang.
            pointerEvents: 'none',
          }}
        >
          <Paper
            role="dialog"
            aria-label={header.title}
            elevation={8}
            onKeyDown={handlePanelKeyDown}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              pointerEvents: 'auto',
              borderRadius: { xs: 0, sm: 2 },
              // Thu gọn: 400×560, nằm trên nút tròn. Mở rộng: tới 760×860, phủ luôn chỗ nút tròn.
              width: {
                xs: '100vw',
                sm: expanded ? 'min(760px, 100vw - 48px)' : 'min(400px, 100vw - 48px)',
              },
              height: {
                xs: '100vh',
                sm: expanded
                  ? 'min(860px, 100vh - 48px)'
                  : `min(560px, 100vh - ${48 + FAB_CLEARANCE}px)`,
              },
              '@supports (height: 100dvh)': {
                height: {
                  xs: '100dvh',
                  sm: expanded
                    ? 'min(860px, 100dvh - 48px)'
                    : `min(560px, 100dvh - ${48 + FAB_CLEARANCE}px)`,
                },
              },
              mb: { xs: 0, sm: expanded ? 0 : `${FAB_CLEARANCE}px` },
              transition: (theme) =>
                theme.transitions.create(['width', 'height', 'margin-bottom'], {
                  duration: theme.transitions.duration.standard,
                }),
            }}
          >
            <ChatbotHeader
              title={header.title}
              icon={header.icon}
              status={status}
              sessionId={sessionId}
              canStartNew={panelReady}
              expanded={expanded}
              showExpand={!isXs}
              onNewSession={handleNewSession}
              onToggleExpand={handleToggleExpand}
              onClose={closePanel}
            />

            {needsGuestGate ? (
              <ChatbotGuestGate brandName={brandName} onSubmit={handleGuestInfoSubmit} />
            ) : (
              <>
                <ChatbotMessages
                  ready={panelReady}
                  offline={!session}
                  messages={messages}
                  busy={busy}
                  streamingMessageId={streamingMessageId}
                  activity={activity}
                  error={error}
                  turnFailed={turnFailed}
                  canRetry={!!lastUserText}
                  showSteps={audience !== 'customer'}
                  expanded={expanded && !isXs}
                  user={routeUser}
                  greeting={greeting}
                  starters={defaultActions}
                  onQuickAction={handleQuickAction}
                  onSend={handleSend}
                  onNavigate={handleNavigate}
                  onRetry={handleRetry}
                  onReconnect={reconnect}
                  onCopy={handleCopyMessage}
                />

                <ChatbotComposer
                  draft={draft}
                  onDraftChange={setDraft}
                  inputRef={inputRef}
                  audience={audience}
                  ready={panelReady && !!session}
                  busy={busy}
                  autoFocus={!isXs}
                  chips={chips}
                  chipsLabel={hasFollowUps ? 'Gợi ý câu hỏi tiếp theo' : 'Câu hỏi nhanh'}
                  onSend={handleSend}
                  onLocalCommand={handleLocalCommand}
                />
              </>
            )}
          </Paper>
        </Box>
      </Grow>

      <Zoom in={!hideFab} appear={false} unmountOnExit>
        <Badge color="error" variant="dot" overlap="circular" invisible={!unread}>
          <Fab
            ref={fabRef}
            color="primary"
            aria-label={open ? 'Đóng trợ lý' : 'Mở trợ lý'}
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            <Iconify
              icon={open ? 'mingcute:close-line' : 'solar:chat-round-dots-bold'}
              width={28}
            />
          </Fab>
        </Badge>
      </Zoom>
    </Box>
  );
}
