'use client';

import type {
  AgentMode,
  QuickReply,
  SendMessageInput,
  ConversationStatus,
  ConversationSummary,
  ConversationMessage,
  CustomerUpdateInput,
} from 'src/lib/inbox';

import { useSWRConfig } from 'swr';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

import { hasApiErrorCode, apiErrorMessage } from 'src/utils/api-error';

import {
  toSummary,
  isPriority,
  holderColor,
  holderLabel,
  platformIcon,
  isHeldByMe,
  facebookPostUrl,
  flattenMessages,
  addMessageToPages,
  imageAttachments,
  togglePriorityTag,
  updateMessageInPages,
} from 'src/lib/inbox';
import {
  sendPrivateReply,
  takeConversation,
  setCommentHidden,
  assignConversation,
  releaseConversation,
  setConversationTags,
  markConversationRead,
  conversationDetailKey,
  markConversationUnread,
  setConversationStatus,
  useConversationDetail,
  sendConversationMessage,
  useConversationMessages,
  updateConversationCustomer,
} from 'src/api/inbox';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';

import InboxComposer from './inbox-composer';
import InboxMessageList from './inbox-message-list';
import { useInboxEvents, useInboxRealtime } from './inbox-realtime';
import InboxAssignDialog from './inbox-assign-dialog';
import InboxCustomerPanel from './inbox-customer-panel';

// ----------------------------------------------------------------------
// Khung một hội thoại (kiểu Meta Business Suite): thanh đầu (khách, kênh, "Đã chỉ định cho …" mở hộp Giao cho, nút biểu
// tượng Spam / Ưu tiên / Đánh dấu chưa đọc / Hoàn tất – Mở lại), thanh người giữ (Tôi trả lời / Trả về hàng chờ / Giao lại
// cho agent), bong bóng tin, ô gõ; cột thông tin khách (cạnh bên hoặc ngăn kéo).
// Mở hội thoại / có tin mới khi đang mở → đánh dấu đã đọc.
// Hội thoại bình luận: thanh đầu ghi "Bình luận trên bài" + link "Xem bài"; bình luận khách ẩn / hiện lại được; ô gõ trả
// lời công khai + Nhắn riêng.
// ----------------------------------------------------------------------

export type InboxPermissions = { reply: boolean; manage: boolean };

type Props = {
  conversationId: string;
  myUserId: string | null;
  permissions: InboxPermissions;
  agentMode: AgentMode | null;
  quickReplies: QuickReply[];
  tagOptions: string[];
  /** inline: cột bên phải luôn hiện (màn rộng); drawer: mở bằng nút; none: không có. */
  panelMode: 'inline' | 'drawer' | 'none';
  /** Màn hẹp: nút quay lại danh sách. */
  onBack?: VoidFunction;
  /** Hub mất kết nối → hỏi lại định kỳ. */
  poll: boolean;
  /** Đã đánh dấu chưa đọc → rời hội thoại (không thì mở ra là tự đánh dấu đã đọc lại). */
  onMarkedUnread?: VoidFunction;
};

type Busy = 'take' | 'release-none' | 'release-agent' | 'status' | 'priority' | 'unread' | null;

export default function InboxThread({
  conversationId,
  myUserId,
  permissions,
  agentMode,
  quickReplies,
  tagOptions,
  panelMode,
  onBack,
  poll,
  onMarkedUnread,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { mutate } = useSWRConfig();
  const { applyConversation, applyMessage } = useInboxRealtime();

  const { detail, loading, error, refresh } = useConversationDetail(conversationId, poll);
  const msgs = useConversationMessages(conversationId, poll);
  const messages = useMemo(() => flattenMessages(msgs.pages), [msgs.pages]);

  const [busy, setBusy] = useState<Busy>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [forceConfirm, setForceConfirm] = useState<{ name: string } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ key: number; text: string; images: string[] } | null>(null);

  // --- Sự kiện trực tiếp cho hội thoại đang mở -------------------------------------------------
  const prevRef = useRef<{ status?: string; windowEndsAt?: string | null }>({});
  useInboxEvents({
    onMessageAdded: (m) => {
      if (m.conversationId === conversationId) msgs.mutate((pages) => addMessageToPages(pages, m), { revalidate: false });
    },
    onMessageUpdated: (m) => {
      if (m.conversationId === conversationId)
        msgs.mutate((pages) => updateMessageInPages(pages, m), { revalidate: false });
    },
    onConversationUpdated: (c) => {
      if (c.id !== conversationId) return;
      // canReply / reason do máy chủ tính theo trạng thái + cửa sổ 24 giờ → đổi thì hỏi lại chi tiết.
      const prev = prevRef.current;
      if (prev.status !== undefined && (prev.status !== c.status || prev.windowEndsAt !== c.windowEndsAt)) refresh();
    },
    onResync: () => {
      refresh();
      msgs.mutate();
    },
  });
  useEffect(() => {
    if (detail) prevRef.current = { status: detail.status, windowEndsAt: detail.windowEndsAt };
  }, [detail]);

  // --- Đánh dấu đã đọc --------------------------------------------------------------------------
  const readInFlight = useRef(false);
  /** Vừa bấm "Đánh dấu chưa đọc" → không tự đánh dấu đã đọc lại trước khi rời hội thoại. */
  const keepUnread = useRef(false);
  useEffect(() => {
    if (!detail || detail.id !== conversationId || detail.unreadCount <= 0 || readInFlight.current) return;
    if (keepUnread.current) return;
    readInFlight.current = true;
    const summary = { ...toSummary(detail), unreadCount: 0 };
    markConversationRead(conversationId)
      .then(() => applyConversation(summary))
      .catch(() => {})
      .finally(() => {
        readInFlight.current = false;
      });
  }, [detail, conversationId, applyConversation]);

  useEffect(() => {
    setPanelOpen(false);
  }, [conversationId]);

  // --- Lệnh ---------------------------------------------------------------------------------
  const applySummary = useCallback(
    (summary: ConversationSummary) => {
      applyConversation(summary);
    },
    [applyConversation]
  );

  const doTake = async (force: boolean) => {
    setBusy('take');
    try {
      applySummary(await takeConversation(conversationId, force));
      setForceConfirm(null);
    } catch (err) {
      if (!force && hasApiErrorCode(err, 'Conversation.HeldByOther') && permissions.manage) {
        setForceConfirm({ name: detail?.holder.name || 'nhân viên khác' });
      } else {
        enqueueSnackbar(apiErrorMessage(err, 'Không nhận được hội thoại'), { variant: 'error' });
        refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const doRelease = async (to: 'agent' | 'none') => {
    setBusy(to === 'agent' ? 'release-agent' : 'release-none');
    try {
      applySummary(await releaseConversation(conversationId, to));
      enqueueSnackbar(to === 'agent' ? 'Đã giao lại cho agent' : 'Đã trả về hàng chờ');
    } catch (err) {
      enqueueSnackbar(
        hasApiErrorCode(err, 'Conversation.AgentOff')
          ? 'Agent CSKH chưa bật cho hộp thư này.'
          : apiErrorMessage(err, 'Không trả được hội thoại'),
        { variant: 'error' }
      );
    } finally {
      setBusy(null);
    }
  };

  const doStatus = async (status: ConversationStatus) => {
    setBusy('status');
    try {
      applySummary(await setConversationStatus(conversationId, status));
      enqueueSnackbar(
        status === 'closed' ? 'Đã hoàn tất hội thoại' : status === 'spam' ? 'Đã đánh dấu spam' : 'Đã mở lại hội thoại'
      );
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không đổi được trạng thái'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const doTogglePriority = async () => {
    if (!detail) return;
    const on = !isPriority(detail);
    setBusy('priority');
    try {
      applySummary(await setConversationTags(conversationId, togglePriorityTag(detail.tags)));
      enqueueSnackbar(on ? 'Đã gắn Ưu tiên' : 'Đã bỏ Ưu tiên');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không đổi được Ưu tiên'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const doMarkUnread = async () => {
    keepUnread.current = true;
    setBusy('unread');
    try {
      const summary = await markConversationUnread(conversationId);
      onMarkedUnread?.();
      applySummary(summary);
      enqueueSnackbar('Đã đánh dấu chưa đọc');
    } catch (err) {
      keepUnread.current = false;
      enqueueSnackbar(apiErrorMessage(err, 'Không đánh dấu chưa đọc được'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const doAssign = async (userId: string | null) => {
    try {
      applySummary(await assignConversation(conversationId, userId));
      enqueueSnackbar(userId ? 'Đã giao hội thoại' : 'Đã bỏ giao');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không giao được hội thoại'), { variant: 'error' });
      throw err;
    }
  };

  const doSend = async (input: SendMessageInput) => {
    try {
      const message = await sendConversationMessage(conversationId, input);
      applyMessage(message);
      if (message.status === 'failed') {
        enqueueSnackbar(message.error || 'Facebook không nhận tin — bấm “Gửi lại”', { variant: 'error' });
      }
      // Gửi thật = tự giành quyền → tải lại người giữ nếu hub chậm.
      if (!input.internalNote && detail && !isHeldByMe(detail.holder, myUserId)) refresh();
    } catch (err) {
      if (hasApiErrorCode(err, 'Conversation.WindowClosed')) {
        enqueueSnackbar(apiErrorMessage(err, 'Đã quá 24 giờ từ tin cuối của khách — không gửi được tin thường.'), {
          variant: 'error',
        });
        refresh();
      } else if (hasApiErrorCode(err, 'Conversation.HeldByOther')) {
        enqueueSnackbar(apiErrorMessage(err, 'Hội thoại đang do người khác trả lời.'), { variant: 'warning' });
        refresh();
      } else {
        enqueueSnackbar(apiErrorMessage(err, 'Không gửi được tin'), { variant: 'error' });
      }
      throw err;
    }
  };

  const doResend = async (m: ConversationMessage) => {
    setResendingId(m.id);
    try {
      await doSend({
        text: m.text ?? undefined,
        imageUrls: imageAttachments(m).map((a) => a.url),
      });
    } catch {
      // đã báo
    } finally {
      setResendingId(null);
    }
  };

  const doToggleHidden = async (m: ConversationMessage) => {
    const hide = m.status !== 'hidden';
    setTogglingId(m.id);
    try {
      const updated = await setCommentHidden(conversationId, m.id, hide);
      msgs.mutate((pages) => updateMessageInPages(pages, updated), { revalidate: false });
      enqueueSnackbar(hide ? 'Đã ẩn bình luận trên Facebook' : 'Đã hiện lại bình luận');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, hide ? 'Không ẩn được bình luận' : 'Không hiện lại được bình luận'), {
        variant: 'error',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const doPrivateReply = async (text: string) => {
    try {
      applyMessage(await sendPrivateReply(conversationId, text));
      enqueueSnackbar('Đã nhắn riêng cho khách qua Messenger');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Facebook không gửi được tin nhắn riêng'), { variant: 'error' });
      throw err;
    }
  };

  const doSaveCustomer = async (input: CustomerUpdateInput) => {
    const panel = await updateConversationCustomer(conversationId, input);
    mutate(
      conversationDetailKey(conversationId),
      (d: any) =>
        d
          ? {
              ...d,
              customerPanel: panel,
              customer: { ...d.customer, id: panel.id, name: panel.name, phone: panel.phone, code: panel.code },
            }
          : d,
      { revalidate: true }
    );
    return panel;
  };

  const doSaveTags = async (tags: string[]) => {
    applySummary(await setConversationTags(conversationId, tags));
  };

  // --- Hiển thị -------------------------------------------------------------------------------
  if (error && !detail) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, p: 3 }}>
        <Alert severity="error" action={<Button onClick={() => refresh()}>Thử lại</Button>}>
          {apiErrorMessage(error, 'Không mở được hội thoại')}
        </Alert>
      </Stack>
    );
  }

  if (loading || !detail) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ flex: 1 }}>
        <CircularProgress size={28} />
      </Stack>
    );
  }

  const mine = isHeldByMe(detail.holder, myUserId);
  const isComment = detail.kind === 'comment';
  const priority = isPriority(detail);
  const postUrl = isComment ? facebookPostUrl(detail.postId) : null;
  const agentOff = !agentMode || agentMode === 'off';
  const showPanelButton = panelMode === 'drawer';

  const panel = (
    <InboxCustomerPanel
      detail={detail}
      canEdit={permissions.reply}
      tagOptions={tagOptions}
      onSaveCustomer={doSaveCustomer}
      onSaveTags={doSaveTags}
      onClose={panelMode === 'drawer' ? () => setPanelOpen(false) : undefined}
    />
  );

  const agentButton = (
    <LoadingButton
      size="small"
      color="info"
      variant="soft"
      loading={busy === 'release-agent'}
      disabled={!permissions.reply || agentOff || !!busy}
      onClick={() => doRelease('agent')}
      startIcon={<Iconify icon="solar:cpu-bolt-bold" />}
    >
      Giao lại cho agent
    </LoadingButton>
  );

  return (
    <Stack direction="row" sx={{ flex: 1, minWidth: 0, minHeight: 0, height: 1 }}>
      <Stack sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {/* Thanh đầu */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ px: { xs: 1, md: 2 }, py: 1, minHeight: 64, flexWrap: 'wrap', rowGap: 0.5 }}
        >
          {onBack && (
            <IconButton onClick={onBack} aria-label="Quay lại danh sách">
              <Iconify icon="eva:arrow-ios-back-fill" />
            </IconButton>
          )}
          <Avatar src={detail.customer.avatarUrl ?? undefined} sx={{ width: 40, height: 40 }}>
            {detail.customer.name?.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap>
                {detail.customer.name || 'Khách'}
              </Typography>
              {priority && <Iconify icon="solar:star-bold" width={16} sx={{ color: 'warning.main', flexShrink: 0 }} />}
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.secondary', minWidth: 0 }}>
              <Iconify icon={platformIcon(detail.platform)} width={14} sx={{ flexShrink: 0 }} />
              <Typography variant="caption" noWrap>
                {detail.channelName}
                {isComment ? ' · Bình luận trên bài' : ''}
              </Typography>
              {postUrl && (
                <Link
                  href={postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="caption"
                  underline="hover"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, flexShrink: 0, fontWeight: 600 }}
                >
                  Xem bài
                  <Iconify icon="eva:external-link-fill" width={12} />
                </Link>
              )}
            </Stack>
          </Box>

          <Tooltip title={permissions.manage ? 'Giao hội thoại cho nhân viên' : 'Cần quyền quản lý hộp thư để giao'}>
            <span>
              <Button
                size="small"
                color="inherit"
                disabled={!permissions.manage}
                onClick={() => setAssignOpen(true)}
                startIcon={<Iconify icon="solar:user-hand-up-bold" width={16} />}
                endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={14} />}
                sx={{ fontWeight: 500, color: 'text.secondary', maxWidth: 220 }}
              >
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {detail.assignedName ? `Đã chỉ định cho ${detail.assignedName}` : 'Chưa chỉ định'}
                </Box>
              </Button>
            </span>
          </Tooltip>

          <Stack direction="row" spacing={0.25} alignItems="center">
            <Tooltip title={detail.status === 'spam' ? 'Bỏ đánh dấu spam' : 'Đánh dấu spam'}>
              <span>
                <IconButton
                  disabled={!permissions.reply || !!busy}
                  onClick={() => doStatus(detail.status === 'spam' ? 'open' : 'spam')}
                  sx={{ color: detail.status === 'spam' ? 'error.main' : undefined }}
                >
                  <Iconify icon="solar:shield-warning-bold" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={priority ? 'Bỏ Ưu tiên' : 'Ưu tiên'}>
              <span>
                <IconButton
                  disabled={!permissions.reply || !!busy}
                  onClick={doTogglePriority}
                  sx={{ color: priority ? 'warning.main' : undefined }}
                >
                  <Iconify icon={priority ? 'solar:star-bold' : 'solar:star-linear'} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Đánh dấu chưa đọc">
              <span>
                <IconButton disabled={!!busy} onClick={doMarkUnread}>
                  <Iconify icon="solar:letter-unread-bold" />
                </IconButton>
              </span>
            </Tooltip>
            {detail.status === 'open' ? (
              <Tooltip title="Hoàn tất (đóng hội thoại)">
                <span>
                  <IconButton disabled={!permissions.reply || !!busy} onClick={() => doStatus('closed')}>
                    <Iconify icon="solar:check-circle-bold" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={!permissions.reply || !!busy}
                onClick={() => doStatus('open')}
                startIcon={<Iconify icon="solar:restart-bold" width={16} />}
              >
                Mở lại
              </Button>
            )}
            {showPanelButton && (
              <Tooltip title="Thông tin khách">
                <IconButton onClick={() => setPanelOpen(true)}>
                  <Iconify icon="solar:user-id-bold" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>

        {/* Thanh người giữ: ai đang trả lời + giành / trả / giao agent */}
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            px: { xs: 1, md: 2 },
            py: 0.75,
            bgcolor: 'background.neutral',
            borderTop: (theme) => `solid 1px ${theme.palette.divider}`,
            borderBottom: (theme) => `solid 1px ${theme.palette.divider}`,
            flexWrap: 'wrap',
            rowGap: 0.75,
          }}
        >
          <Label color={holderColor(detail.holder, myUserId)} variant="soft" sx={{ flexShrink: 0 }}>
            {holderLabel(detail.holder, myUserId)}
          </Label>
          {detail.status !== 'open' && (
            <Label color={detail.status === 'spam' ? 'error' : 'default'}>
              {detail.status === 'spam' ? 'Spam' : 'Đã hoàn tất'}
            </Label>
          )}
          <Box sx={{ flex: 1 }} />
          {!mine && (
            <LoadingButton
              size="small"
              variant="contained"
              loading={busy === 'take'}
              disabled={!permissions.reply || !!busy}
              onClick={() => doTake(false)}
              startIcon={<Iconify icon="solar:chat-round-dots-bold" />}
            >
              Tôi trả lời
            </LoadingButton>
          )}
          {detail.holder.type !== 'none' && (mine || permissions.manage) && (
            <LoadingButton
              size="small"
              variant="outlined"
              color="inherit"
              loading={busy === 'release-none'}
              disabled={!permissions.reply || !!busy}
              onClick={() => doRelease('none')}
            >
              Trả về hàng chờ
            </LoadingButton>
          )}
          {detail.holder.type !== 'agent' &&
            (agentOff ? (
              <Tooltip title="Bật agent ở bước sau">
                <span>{agentButton}</span>
              </Tooltip>
            ) : (
              agentButton
            ))}
        </Stack>

        <InboxMessageList
          conversationId={conversationId}
          messages={messages}
          loading={msgs.loading}
          hasOlder={msgs.hasOlder}
          loadingOlder={msgs.loadingOlder}
          onLoadOlder={msgs.loadOlder}
          onResend={permissions.reply ? doResend : undefined}
          onUseSuggestion={
            permissions.reply
              ? (m) =>
                  setPrefill({
                    key: Date.now(),
                    text: m.text ?? '',
                    images: m.attachments.filter((a) => a.type === 'image').map((a) => a.url),
                  })
              : undefined
          }
          resendingId={resendingId}
          customerAvatarUrl={detail.customer.avatarUrl}
          conversationKind={detail.kind}
          onToggleHidden={permissions.reply && isComment ? doToggleHidden : undefined}
          togglingId={togglingId}
        />

        <InboxComposer
          conversationId={conversationId}
          allowed={permissions.reply}
          canReply={detail.canReply}
          reason={detail.reason}
          windowEndsAt={isComment ? null : detail.windowEndsAt}
          quickReplies={quickReplies}
          onSend={doSend}
          prefill={prefill}
          kind={detail.kind}
          customerName={detail.customer.name}
          onPrivateReply={isComment ? doPrivateReply : undefined}
        />
      </Stack>

      {panelMode === 'inline' && (
        <Box
          sx={{
            width: 320,
            flexShrink: 0,
            minHeight: 0,
            borderLeft: (theme) => `solid 1px ${theme.palette.divider}`,
          }}
        >
          {panel}
        </Box>
      )}

      {panelMode === 'drawer' && (
        <Drawer
          anchor="right"
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          PaperProps={{ sx: { width: { xs: 1, sm: 360 } } }}
        >
          {panel}
        </Drawer>
      )}

      <InboxAssignDialog
        open={assignOpen}
        currentUserId={detail.assignedUserId}
        onClose={() => setAssignOpen(false)}
        onAssign={doAssign}
      />

      <ConfirmDialog
        open={!!forceConfirm}
        onClose={() => setForceConfirm(null)}
        title={`Giành từ ${forceConfirm?.name ?? ''}?`}
        content={`${forceConfirm?.name ?? 'Nhân viên khác'} đang trả lời khách này. Giành quyền thì bạn trả lời tiếp, người kia không gửi được nữa.`}
        cancelText="Huỷ"
        action={
          <LoadingButton variant="contained" color="warning" loading={busy === 'take'} onClick={() => doTake(true)}>
            Giành quyền
          </LoadingButton>
        }
      />
    </Stack>
  );
}
