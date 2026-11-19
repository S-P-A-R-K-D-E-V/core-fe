import type { IAgentTask, IAgentRunStep } from 'src/api/agent-center';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import { alpha, styled } from '@mui/material/styles';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { addAgentTaskNote, useAgentTaskDetail } from 'src/api/agent-center';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';

import {
  canStop,
  taskCode,
  canRetry,
  canCancel,
  stepLabel,
  shortTokens,
  planProgress,
  stepKindMeta,
  taskElapsedMs,
  formatDuration,
  planStatusMeta,
  taskSourceMeta,
  taskStatusMeta,
  childrenWaitLabel,
} from './agent-center-utils';

// ----------------------------------------------------------------------
// Chi tiết một việc (dựa trên kanban-details của template): thông tin, kế hoạch, dòng thời gian từng bước (model / tool /
// kế hoạch / ghi chú / duyệt / hệ thống — bước mới đến qua hub stepAdded), kết quả / lỗi, ô "Nhắn agent" và nút Dừng /
// Chạy lại / Huỷ.
// ----------------------------------------------------------------------

const StyledLabel = styled('span')(({ theme }) => ({
  ...theme.typography.caption,
  width: 110,
  flexShrink: 0,
  color: theme.palette.text.secondary,
  fontWeight: theme.typography.fontWeightSemiBold,
}));

type DrawerTab = 'overview' | 'steps' | 'chat';

type Props = {
  taskId: string | null;
  /** Bản trên bảng — hiện ngay khi chi tiết còn đang tải. */
  fallbackTask: IAgentTask | null;
  /** Hub mất kết nối → hỏi lại chi tiết mỗi 30 giây. */
  poll: boolean;
  onClose: VoidFunction;
  onStop: (task: IAgentTask) => void;
  onRetry: (task: IAgentTask) => void;
  onCancel: (task: IAgentTask) => void;
  /** Sau khi gửi ghi chú (cập nhật bảng khi máy chủ trả việc mới). */
  onNoteSent: (result: unknown) => void;
};

export default function AgentTaskDrawer({
  taskId,
  fallbackTask,
  poll,
  onClose,
  onStop,
  onRetry,
  onCancel,
  onNoteSent,
}: Props) {
  const { detail, loading, error, refresh } = useAgentTaskDetail(taskId, poll);
  const task = detail?.task ?? fallbackTask;
  const steps = [...(detail?.steps ?? [])].sort((a, b) => a.seq - b.seq);
  const notes = steps.filter((st) => st.kind === 'note');

  // Mở việc khác → về tab Tổng quan; việc đang chờ người → mở thẳng tab Trao đổi.
  const [tab, setTab] = useState<DrawerTab>('overview');
  const waitingHuman = task?.status === 'waiting_human';
  useEffect(() => {
    setTab(waitingHuman ? 'chat' : 'overview');
    // Chỉ khi đổi việc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  return (
    <Drawer
      open={!!taskId}
      onClose={onClose}
      anchor="right"
      slotProps={{ backdrop: { invisible: true } }}
      PaperProps={{ sx: { width: { xs: 1, sm: 560 } } }}
    >
      <Box sx={{ px: 2.5, pt: 2, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {task && (
            <>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                {taskCode(task.id)}
              </Typography>
              <Label color={taskStatusMeta(task.status).color} variant="soft">
                {taskStatusMeta(task.status).label}
              </Label>
            </>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {task && (
            <TaskActions task={task} onStop={onStop} onRetry={onRetry} onCancel={onCancel} />
          )}
          <Tooltip title="Tải lại">
            <IconButton onClick={() => refresh()}>
              <Iconify icon="solar:restart-bold" />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Stack>
        <Typography variant="h6" sx={{ mt: 1, wordBreak: 'break-word' }}>
          {task?.title ?? 'Việc của agent'}
        </Typography>
        <Tabs value={tab} onChange={(_, v: DrawerTab) => setTab(v)} sx={{ mt: 0.5 }}>
          <Tab value="overview" label="Tổng quan" />
          <Tab value="steps" label={`Các bước${detail ? ` (${steps.length})` : ''}`} />
          <Tab
            value="chat"
            label={
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <span>Trao đổi</span>
                {waitingHuman && (
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                )}
              </Stack>
            }
          />
        </Tabs>
      </Box>

      {error && !task && (
        <Alert severity="error" sx={{ m: 2.5 }}>
          {apiErrorMessage(
            error,
            'Không tải được việc này (có thể đã bị xoá hoặc bạn không có quyền)'
          )}
        </Alert>
      )}

      {!task && loading && (
        <Stack spacing={2} sx={{ p: 2.5 }}>
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={240} />
        </Stack>
      )}

      {task && (
        <Scrollbar sx={{ height: 1 }}>
          <Stack spacing={3} sx={{ px: 2.5, pt: 2.5, pb: 5 }}>
            {tab === 'overview' && (
              <>
                {task.pendingActionId && (
                  <Alert
                    severity="warning"
                    action={
                      <Button
                        component={RouterLink}
                        href={`${paths.dashboard.agent.approvals}?id=${task.pendingActionId}`}
                        color="inherit"
                        size="small"
                      >
                        Xem phiếu duyệt
                      </Button>
                    }
                  >
                    Agent đang chờ duyệt một lệnh ghi.
                  </Alert>
                )}

                {task.error && (
                  <Alert severity="error" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {task.error}
                  </Alert>
                )}

                {task.result && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Kết quả
                    </Typography>
                    <TextBox text={task.result} />
                  </Box>
                )}

                <TaskInfo task={task} />
                <TaskPlan task={task} />
              </>
            )}

            {tab === 'steps' && (
              <Box>
                {loading && !detail && <Skeleton variant="rounded" height={160} />}
                {detail && steps.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    Chưa có bước nào.
                  </Typography>
                )}
                <Stack spacing={0}>
                  {steps.map((step, i) => (
                    <StepItem key={step.id} step={step} last={i === steps.length - 1} />
                  ))}
                </Stack>
              </Box>
            )}

            {tab === 'chat' && (
              <>
                {notes.length > 0 && (
                  <Stack spacing={0}>
                    {notes.map((step, i) => (
                      <StepItem key={step.id} step={step} last={i === notes.length - 1} />
                    ))}
                  </Stack>
                )}
                {detail && notes.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    Chưa có trao đổi nào với agent trong việc này.
                  </Typography>
                )}
                <NoteInput
                  task={task}
                  onSent={onNoteSent}
                  onSentRefresh={() => refresh()}
                  poll={poll}
                />
              </>
            )}
          </Stack>
        </Scrollbar>
      )}
    </Drawer>
  );
}

// ----------------------------------------------------------------------

function TaskInfo({ task }: { task: IAgentTask }) {
  const source = taskSourceMeta(task.source);
  const elapsed = taskElapsedMs(task);
  const label = stepLabel(task);
  const childrenLabel = childrenWaitLabel(task);

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Agent', value: task.agentName },
    {
      label: 'Nguồn',
      value: (
        <Label variant="soft" startIcon={<Iconify icon={source.icon} width={14} />}>
          {source.label}
        </Label>
      ),
    },
    { label: 'Người giao', value: task.createdByName || '—' },
    { label: 'Tạo lúc', value: fDateTime(task.createdAt) },
    { label: 'Bắt đầu', value: task.startedAt ? fDateTime(task.startedAt) : '—' },
    { label: 'Kết thúc', value: task.finishedAt ? fDateTime(task.finishedAt) : '—' },
    { label: 'Thời gian chạy', value: elapsed != null ? formatDuration(elapsed) : '—' },
    {
      label: 'Token',
      value: `${shortTokens(task.inputTokens + task.outputTokens)} (vào ${shortTokens(
        task.inputTokens
      )} · ra ${shortTokens(task.outputTokens)}) · ${task.toolCalls} lần gọi tool`,
    },
  ];

  return (
    <Stack spacing={1.25}>
      {label && (
        <Typography variant="body2" sx={{ color: 'info.main' }}>
          {label}
        </Typography>
      )}
      {childrenLabel && (
        <Alert severity="info" icon={<Iconify icon="solar:users-group-rounded-bold" />}>
          {childrenLabel} — agent chạy tiếp khi các việc con xong (tối đa 30 phút).
        </Alert>
      )}
      {task.stopRequested && canStop(task.status) && (
        <Alert severity="warning">Đã yêu cầu dừng — agent dừng sau bước đang chạy.</Alert>
      )}
      {rows.map((r) => (
        <Stack key={r.label} direction="row" alignItems="center">
          <StyledLabel>{r.label}</StyledLabel>
          <Typography variant="body2" component="div">
            {r.value}
          </Typography>
        </Stack>
      ))}
      <Box>
        <StyledLabel>Chỉ dẫn</StyledLabel>
        <TextBox text={task.instruction} sx={{ mt: 0.75 }} />
      </Box>
    </Stack>
  );
}

function TaskActions({
  task,
  onStop,
  onRetry,
  onCancel,
}: {
  task: IAgentTask;
  onStop: (task: IAgentTask) => void;
  onRetry: (task: IAgentTask) => void;
  onCancel: (task: IAgentTask) => void;
}) {
  const stop = canStop(task.status) && !task.stopRequested;
  const retry = canRetry(task.status);
  const cancel = canCancel(task.status);
  if (!stop && !retry && !cancel) return null;
  return (
    <Stack direction="row" spacing={1}>
      {stop && (
        <Button
          size="small"
          variant="soft"
          color="error"
          startIcon={<Iconify icon="solar:stop-circle-bold" />}
          onClick={() => onStop(task)}
        >
          Dừng
        </Button>
      )}
      {cancel && (
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<Iconify icon="solar:close-circle-bold" />}
          onClick={() => onCancel(task)}
        >
          Huỷ
        </Button>
      )}
      {retry && (
        <Button
          size="small"
          variant="contained"
          startIcon={<Iconify icon="solar:restart-bold" />}
          onClick={() => onRetry(task)}
        >
          Chạy lại
        </Button>
      )}
    </Stack>
  );
}

function TaskPlan({ task }: { task: IAgentTask }) {
  const plan = task.plan ?? [];
  const progress = planProgress(plan);
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          Kế hoạch
        </Typography>
        {progress.total > 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {progress.done}/{progress.total} bước
          </Typography>
        )}
      </Stack>
      {progress.total === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          Agent chưa khai kế hoạch.
        </Typography>
      ) : (
        <>
          <LinearProgress
            variant="determinate"
            value={progress.percent}
            sx={{ height: 6, borderRadius: 1, mb: 1.5 }}
          />
          <Stack spacing={1}>
            {plan.map((item, i) => {
              const meta = planStatusMeta(item.status);
              return (
                <Stack
                  key={`${i}-${item.title}`}
                  direction="row"
                  spacing={1.25}
                  alignItems="flex-start"
                >
                  <Tooltip title={meta.label}>
                    <Iconify
                      icon={meta.icon}
                      width={20}
                      sx={{ color: meta.color, mt: 0.1, flexShrink: 0 }}
                    />
                  </Tooltip>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        ...(item.status === 'skipped' && {
                          textDecoration: 'line-through',
                          color: 'text.disabled',
                        }),
                        ...(item.status === 'in_progress' && { fontWeight: 600 }),
                      }}
                    >
                      {i + 1}. {item.title}
                    </Typography>
                    {item.note && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.note}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

function StepItem({ step, last }: { step: IAgentRunStep; last: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = stepKindMeta(step.kind);
  const isError = step.status === 'error';
  const isPending = step.status === 'pending';
  const tokens = (step.inputTokens ?? 0) + (step.outputTokens ?? 0);

  return (
    <Stack direction="row" spacing={1.5}>
      <Stack alignItems="center" sx={{ flexShrink: 0 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isError
              ? 'error.main'
              : meta.color === 'default'
                ? 'text.secondary'
                : `${meta.color}.main`,
            bgcolor: (t) =>
              alpha(
                isError
                  ? t.palette.error.main
                  : meta.color === 'default'
                    ? t.palette.grey[500]
                    : t.palette[meta.color].main,
                0.12
              ),
          }}
        >
          <Iconify icon={isPending ? 'svg-spinners:180-ring' : meta.icon} width={18} />
        </Box>
        {!last && <Box sx={{ flexGrow: 1, width: 2, my: 0.5, bgcolor: 'divider' }} />}
      </Stack>

      <Box sx={{ flexGrow: 1, minWidth: 0, pb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {meta.label}
            {step.name ? ` · ${step.name}` : ''}
          </Typography>
          {isError && (
            <Label color="error" variant="soft">
              Lỗi
            </Label>
          )}
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {fDateTime(step.createdAt, 'HH:mm:ss')}
            {step.durationMs != null && ` · ${formatDuration(step.durationMs)}`}
            {tokens > 0 && ` · ${shortTokens(tokens)} token`}
            {step.authorName && ` · ${step.authorName}`}
          </Typography>
        </Stack>

        <Typography
          variant="body2"
          sx={{ mt: 0.25, wordBreak: 'break-word', ...(isError && { color: 'error.main' }) }}
        >
          {step.summary}
        </Typography>

        {step.kind === 'approval' && (
          <Link
            component={RouterLink}
            href={paths.dashboard.agent.approvals}
            variant="caption"
            sx={{ display: 'inline-block', mt: 0.5 }}
          >
            Xem phiếu duyệt
          </Link>
        )}

        {step.detail && (
          <>
            <Link
              component="button"
              type="button"
              variant="caption"
              onClick={() => setOpen((v) => !v)}
              sx={{ display: 'block', mt: 0.5 }}
            >
              {open ? 'Ẩn chi tiết' : 'Xem chi tiết'}
            </Link>
            <Collapse in={open} unmountOnExit>
              <TextBox text={step.detail} mono sx={{ mt: 1 }} />
            </Collapse>
          </>
        )}
      </Box>
    </Stack>
  );
}

function TextBox({ text, mono, sx }: { text: string; mono?: boolean; sx?: object }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'background.neutral',
        typography: 'body2',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: 360,
        overflow: 'auto',
        ...(mono && { fontFamily: 'monospace', fontSize: 12 }),
        ...sx,
      }}
    >
      {text}
    </Box>
  );
}

// ----------------------------------------------------------------------

function NoteInput({
  task,
  poll,
  onSent,
  onSentRefresh,
}: {
  task: IAgentTask;
  poll: boolean;
  onSent: (result: unknown) => void;
  onSentRefresh: VoidFunction;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Đổi sang việc khác → xoá nháp.
  useEffect(() => {
    setText('');
  }, [task.id]);

  const waitingHuman = task.status === 'waiting_human';
  const ended = ['done', 'failed', 'stopped', 'cancelled'].includes(task.status);

  const hint = waitingHuman
    ? 'Agent đang chờ bạn: gửi chỉ dẫn xong, việc chuyển về Chờ chạy và agent đọc rồi chạy tiếp.'
    : ended
      ? 'Việc đã kết thúc — ghi chú được lưu lại; với việc Lỗi / Đã dừng, bấm Chạy lại để agent đọc.'
      : task.status === 'waiting_children'
        ? 'Agent đang chờ việc con — đọc chỉ dẫn này khi chạy tiếp.'
        : 'Agent đọc chỉ dẫn này ở lượt tiếp theo.';

  const handleSend = async () => {
    const value = text.trim();
    if (!value) return;
    setSending(true);
    try {
      const res = await addAgentTaskNote(task.id, value);
      setText('');
      enqueueSnackbar(waitingHuman ? 'Đã gửi — agent sẽ chạy tiếp' : 'Đã gửi chỉ dẫn cho agent');
      onSent(res);
      // Không có hub → bước ghi chú không tự đến, tải lại chi tiết.
      if (poll) onSentRefresh();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Gửi chỉ dẫn thất bại'), { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Nhắn agent
      </Typography>
      {waitingHuman && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Agent đang hỏi / chuyển việc cho người — đọc dòng thời gian rồi trả lời ở đây.
        </Alert>
      )}
      <TextField
        fullWidth
        multiline
        minRows={2}
        maxRows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nhắn thêm chỉ dẫn cho agent…"
        helperText={hint}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
        }}
      />
      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
        <LoadingButton
          variant="contained"
          loading={sending}
          disabled={!text.trim()}
          onClick={handleSend}
          startIcon={<Iconify icon="iconamoon:send-fill" />}
        >
          Gửi
        </LoadingButton>
      </Stack>
    </Box>
  );
}
