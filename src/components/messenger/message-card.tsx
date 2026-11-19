'use client';

import type { IAgentAction } from 'src/api/agent-actions';
import type { MessageCard, DirectMessage, MessageCardAction } from 'src/api/messenger';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Collapse from '@mui/material/Collapse';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { useRouter } from 'src/routes/hooks';

import { apiErrorMessage } from 'src/utils/api-error';
import {
  confirmPrompt,
  CARD_DONE_TEXT,
  CARD_REPLY_MAX,
  cardActionError,
  cardActionIntent,
  messageCardState,
  optimisticDoneCard,
  visibleCardActions,
  confirmResultMessage,
  cardActionButtonProps,
} from 'src/utils/messenger-card';

import { fetchMessages } from 'src/api/messenger';
import { useMessengerStore } from 'src/store/messenger-store';
import {
  addAgentTaskNote,
  cancelAdminGroupProposal,
  confirmAdminGroupProposal,
} from 'src/api/agent-center';
import {
  getAgentAction,
  rejectAgentAction,
  approveAgentAction,
  requestAgentActionRevision,
} from 'src/api/agent-actions';
import {
  ParamList,
  ActionPreview,
  previewImages,
  PreviousVersion,
  hasActionPreview,
} from 'src/sections/agent-approvals/agent-action-preview';
import { parseActionParams } from 'src/sections/agent-approvals/agent-action-utils';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';

// ----------------------------------------------------------------------
// Thẻ hành động trong tin Messenger (A1 — nhóm "Quản trị – Đội agent"), thay bong bóng chữ khi tin có `card`. Nút gọi
// thẳng API bằng phiên của người bấm (Duyệt / Yêu cầu sửa / Từ chối phiếu, Trả lời việc chờ người, Mở phiếu / việc).
// Bấm xong: thẻ đổi sang "đã xử lý" ngay (lạc quan), máy chủ gửi `messageUpdated` sau đó để chốt chữ trạng thái.
// ----------------------------------------------------------------------

const KIND_ICON: Record<string, { icon: string; color: string }> = {
  approval: { icon: 'solar:shield-check-bold', color: 'warning.main' },
  task_question: { icon: 'solar:question-circle-bold', color: 'info.main' },
  task_failed: { icon: 'solar:danger-triangle-bold', color: 'error.main' },
  task_result: { icon: 'solar:check-circle-bold', color: 'success.main' },
  confirm: { icon: 'solar:lightbulb-bolt-bold', color: 'primary.main' },
};

// Lớp chat nhanh (quick-chat-layer) nằm ở zIndex 1400 — hộp thoại phải nổi trên nó.
const DIALOG_Z = 1500;

type InputMode = 'revise' | 'reject' | 'reply';

const INPUT_DIALOG: Record<
  InputMode,
  {
    title: string;
    label: string;
    hint: string;
    submit: string;
    color: 'primary' | 'error';
    required: boolean;
    maxLength: number;
  }
> = {
  revise: {
    title: 'Yêu cầu agent sửa',
    label: 'Cần sửa gì?',
    hint: 'Lệnh chưa chạy. Agent nhận ghi chú, sửa đúng phần đó rồi gửi phiếu mới để duyệt lại. Muốn chọn ảnh cần làm lại → bấm "Mở phiếu".',
    submit: 'Gửi yêu cầu sửa',
    color: 'primary',
    required: true,
    maxLength: 2000,
  },
  reject: {
    title: 'Từ chối hẳn việc này?',
    label: 'Lý do từ chối (không bắt buộc)',
    hint: 'Agent sẽ dừng việc này, không làm lại. Lệnh không chạy.',
    submit: 'Từ chối, dừng việc',
    color: 'error',
    required: false,
    maxLength: 500,
  },
  reply: {
    title: 'Trả lời agent',
    label: 'Câu trả lời',
    hint: 'Agent đọc câu trả lời rồi làm tiếp việc đang chờ.',
    submit: 'Gửi trả lời',
    color: 'primary',
    required: true,
    maxLength: CARD_REPLY_MAX,
  },
};

function CardInputDialog({
  mode,
  cardTitle,
  submitting,
  onClose,
  onSubmit,
}: {
  mode: InputMode | null;
  cardTitle: string;
  submitting: boolean;
  onClose: VoidFunction;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  // Giữ chữ của hộp trong lúc hiệu ứng đóng (mode đã về null).
  const [shown, setShown] = useState<InputMode>('reply');

  useEffect(() => {
    if (mode) {
      setText('');
      setShown(mode);
    }
  }, [mode]);

  const cfg = INPUT_DIALOG[mode ?? shown];
  const canSubmit = !cfg.required || text.trim().length > 0;

  return (
    <Dialog
      open={!!mode}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      sx={{ zIndex: DIALOG_Z }}
    >
      <DialogTitle>{cfg.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="subtitle2">{cardTitle}</Typography>
          <Alert severity={(mode ?? shown) === 'reject' ? 'warning' : 'info'}>{cfg.hint}</Alert>
          <TextField
            autoFocus
            label={cfg.label}
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            minRows={3}
            maxRows={10}
            inputProps={{ maxLength: cfg.maxLength }}
            helperText={`${text.length}/${cfg.maxLength}`}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={submitting}>
          Huỷ
        </Button>
        <LoadingButton
          variant="contained"
          color={cfg.color}
          loading={submitting}
          disabled={!canSubmit}
          onClick={() => onSubmit(text.trim())}
        >
          {cfg.submit}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

/** Khối "Xem trước" của phiếu duyệt — dùng lại khối xem trước của màn Duyệt việc agent. */
function ApprovalPreview({ refId }: { refId: string }) {
  const [action, setAction] = useState<IAgentAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAgentAction(refId)
      .then((res) => alive && setAction(res))
      .catch((err) => alive && setError(apiErrorMessage(err, 'Không tải được bản xem trước')));
    return () => {
      alive = false;
    };
  }, [refId]);

  if (error) return <Alert severity="warning">{error}</Alert>;
  if (!action) return <Skeleton variant="rounded" height={96} />;

  const { preview } = action;
  if (hasActionPreview(preview)) {
    const version = action.version ?? null;
    return (
      <Stack spacing={1.5}>
        <ActionPreview preview={preview} />
        {action.previous && version !== null && version > 1 && (
          <PreviousVersion previous={action.previous} currentImages={previewImages(preview)} />
        )}
      </Stack>
    );
  }

  const params = parseActionParams(action.bodyJson);
  if (params.kind === 'fields') return <ParamList fields={params.fields} />;
  return (
    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {action.summary}
    </Typography>
  );
}

// ----------------------------------------------------------------------

type Props = {
  message: DirectMessage & { card: MessageCard };
  compact?: boolean;
};

export default function MessageCardView({ message, compact }: Props) {
  const { card } = message;
  const router = useRouter();
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const canApprove = hasPermission(user, PERMISSIONS.agent.approve);

  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmProposal, setConfirmProposal] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const state = messageCardState(card, now);
  const actions = visibleCardActions(card, { canApprove, now });
  const kind = KIND_ICON[card.kind] ?? KIND_ICON.task_result;
  const lines = (card.lines ?? []).filter((l) => l != null && l !== '');
  const canPreview = card.kind === 'approval' && state.actionable && canApprove;

  // Phiếu duyệt còn mở có hạn: cập nhật mỗi 30 giây để tự chuyển "Hết hạn".
  useEffect(() => {
    if (card.kind !== 'approval' || !state.actionable || !card.expiresAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [card.kind, card.expiresAt, state.actionable]);

  const setCard = (next: MessageCard | null) =>
    useMessengerStore.getState().updateMessageCard(message.conversationId, message.id, next);

  // Sau 409 (phiếu đã có người xử lý / hết hạn): tải lại trang tin mới nhất để thẻ về đúng trạng thái.
  const reloadCards = async () => {
    try {
      const msgs = await fetchMessages(message.conversationId, { limit: 50 });
      const store = useMessengerStore.getState();
      msgs.forEach((m) => {
        if (m.card !== undefined) store.updateMessageCard(m.conversationId, m.id, m.card ?? null);
      });
    } catch {
      // bỏ qua — sự kiện messageUpdated vẫn tới sau
    }
  };

  const run = async (key: string, call: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    try {
      const res = await call();
      setCard(optimisticDoneCard(card, CARD_DONE_TEXT[key] ?? 'Đã xử lý'));
      if (key === 'approve' && (res as IAgentAction | null)?.status === 'failed') {
        enqueueSnackbar('Đã duyệt nhưng lệnh trả lỗi — bấm "Mở phiếu" để xem', {
          variant: 'warning',
        });
      } else {
        enqueueSnackbar(okText);
      }
      setConfirmApprove(false);
      setInputMode(null);
    } catch (err) {
      const e = cardActionError(err, 'Thao tác thất bại');
      enqueueSnackbar(e.message, { variant: e.variant });
      if (e.reload) {
        setConfirmApprove(false);
        setInputMode(null);
        reloadCards();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = () =>
    run('approve', () => approveAgentAction(card.refId), 'Đã duyệt — máy chủ đã chạy lệnh');

  const handleInput = (text: string) => {
    if (inputMode === 'revise') {
      run(
        'revise',
        () => requestAgentActionRevision(card.refId, { note: text }),
        'Đã gửi yêu cầu sửa — agent sẽ làm lại và gửi phiếu mới'
      );
    } else if (inputMode === 'reject') {
      run('reject', () => rejectAgentAction(card.refId, text), 'Đã từ chối — lệnh không chạy');
    } else if (inputMode === 'reply') {
      run('reply', () => addAgentTaskNote(card.refId, text), 'Đã gửi trả lời cho agent');
    }
  };

  // Thẻ confirm (A2): Xác nhận / Huỷ đề xuất của CEO. Máy chủ trả statusText → chữ trạng thái + snackbar.
  const runProposal = async (key: 'confirm' | 'cancel') => {
    setBusy(true);
    try {
      const res =
        key === 'confirm'
          ? await confirmAdminGroupProposal(card.refId)
          : await cancelAdminGroupProposal(card.refId);
      const doneText = res?.statusText?.trim() || CARD_DONE_TEXT[key];
      setCard(optimisticDoneCard(card, doneText));
      const msg = confirmResultMessage(res, CARD_DONE_TEXT[key]);
      enqueueSnackbar(msg.message, { variant: msg.variant });
      setConfirmProposal(false);
    } catch (err) {
      const e = cardActionError(err, 'Thao tác thất bại');
      enqueueSnackbar(e.message, { variant: e.variant });
      if (e.reload) {
        setConfirmProposal(false);
        reloadCards();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAction = (action: MessageCardAction) => {
    switch (cardActionIntent(action.key)) {
      case 'approve':
        setConfirmApprove(true);
        break;
      case 'confirm':
        setConfirmProposal(true);
        break;
      case 'cancel':
        runProposal('cancel');
        break;
      case 'input':
        setInputMode(action.key as InputMode);
        break;
      case 'open':
        // Chỉ điều hướng trong app (đường dẫn tương đối của máy chủ).
        if (card.link && card.link.startsWith('/')) router.push(card.link);
        break;
      default:
        break;
    }
  };

  return (
    <Box
      className="messenger-card"
      sx={{
        width: compact ? 1 : { xs: 1, sm: 420 },
        maxWidth: 1,
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        boxShadow: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        overflow: 'hidden',
      }}
    >
      <Stack spacing={compact ? 1 : 1.25} sx={{ p: compact ? 1.25 : 1.75 }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Iconify
            icon={kind.icon}
            width={compact ? 18 : 22}
            sx={{ color: kind.color, flexShrink: 0, mt: 0.25 }}
          />
          <Typography
            variant={compact ? 'subtitle2' : 'subtitle1'}
            sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word', lineHeight: 1.35 }}
          >
            {card.title}
          </Typography>
        </Stack>

        {lines.length > 0 && (
          <Stack spacing={0.25}>
            {lines.map((line, i) => (
              <Typography
                key={i}
                variant={compact ? 'caption' : 'body2'}
                sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {line}
              </Typography>
            ))}
          </Stack>
        )}

        {state.statusLabel && (
          <Box>
            <Label
              color={state.done ? 'success' : 'default'}
              variant="soft"
              sx={{ textTransform: 'none', height: 'auto', py: 0.25, whiteSpace: 'normal' }}
            >
              {state.statusLabel}
            </Label>
          </Box>
        )}

        {canPreview && (
          <Box>
            <Button
              size="small"
              color="inherit"
              onClick={() => setShowPreview((v) => !v)}
              aria-expanded={showPreview}
              startIcon={
                <Iconify
                  icon={showPreview ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
                />
              }
              sx={{ px: 0.5 }}
            >
              {showPreview ? 'Ẩn xem trước' : 'Xem trước'}
            </Button>
            <Collapse in={showPreview} unmountOnExit>
              <Box sx={{ pt: 1 }}>
                <ApprovalPreview refId={card.refId} />
              </Box>
            </Collapse>
          </Box>
        )}

        {actions.length > 0 && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {actions.map((a) => {
              const btn = cardActionButtonProps(a.style);
              return (
                <Button
                  key={a.key}
                  size="small"
                  variant={btn.variant}
                  color={btn.color}
                  disabled={busy && a.key !== 'open'}
                  onClick={() => handleAction(a)}
                >
                  {a.label}
                </Button>
              );
            })}
          </Stack>
        )}
      </Stack>

      <Dialog
        open={confirmApprove}
        onClose={busy ? undefined : () => setConfirmApprove(false)}
        fullWidth
        maxWidth="xs"
        sx={{ zIndex: DIALOG_Z }}
      >
        <DialogTitle>Duyệt việc agent xin làm?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="subtitle2">{card.title}</Typography>
            <Alert severity="warning">
              Bấm Duyệt là máy chủ chạy ngay đúng lệnh này trên dữ liệu thật, bạn được ghi là người
              thực hiện.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmApprove(false)} disabled={busy}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={busy} onClick={handleApprove}>
            Duyệt và chạy ngay
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmProposal}
        onClose={busy ? undefined : () => setConfirmProposal(false)}
        fullWidth
        maxWidth="xs"
        sx={{ zIndex: DIALOG_Z }}
      >
        <DialogTitle>{confirmPrompt(card)}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="subtitle2">{card.title}</Typography>
            <Alert severity="warning">
              Máy chủ chạy ngay các thao tác trên bằng quyền và tên của bạn. Thao tác cần quyền cao
              hơn quyền bạn có sẽ báo lỗi, thao tác khác vẫn chạy.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setConfirmProposal(false)} disabled={busy}>
            Thôi
          </Button>
          <LoadingButton variant="contained" loading={busy} onClick={() => runProposal('confirm')}>
            Xác nhận và chạy
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <CardInputDialog
        mode={inputMode}
        cardTitle={card.title}
        submitting={busy}
        onClose={() => setInputMode(null)}
        onSubmit={handleInput}
      />
    </Box>
  );
}
