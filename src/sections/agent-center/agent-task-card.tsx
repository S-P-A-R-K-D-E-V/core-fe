import type { IAgentTask } from 'src/api/agent-center';

import { memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { bgBlur } from 'src/theme/css';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';

import {
  canStop,
  taskCode,
  shortAgo,
  stepLabel,
  isDraggable,
  planProgress,
  taskElapsedMs,
  formatDuration,
  taskSourceMeta,
  taskStatusMeta,
  childrenWaitLabel,
} from './agent-center-utils';

// ----------------------------------------------------------------------
// Thẻ việc gọn (theo kanban-task-item của Minimal): mã + nguồn, tên việc tối đa 2 dòng, một dòng trạng thái (bước hiện tại /
// chờ duyệt / lỗi), chân thẻ = agent (avatar robot) + thời gian. Token chỉ xem ở ngăn chi tiết.
// ----------------------------------------------------------------------

const STATUS_ON_CARD: string[] = [
  'waiting_approval',
  'waiting_human',
  'failed',
  'stopped',
  'cancelled',
];

type Props = {
  task: IAgentTask;
  index: number;
  now: number;
  selected?: boolean;
  onOpen: (task: IAgentTask) => void;
  onStop: (task: IAgentTask) => void;
};

function AgentTaskCard({ task, index, now, selected, onOpen, onStop }: Props) {
  const theme = useTheme();
  const progress = planProgress(task.plan);
  const source = taskSourceMeta(task.source);
  const status = taskStatusMeta(task.status);
  const elapsed = taskElapsedMs(task, now);
  const childrenLabel = childrenWaitLabel(task);
  const running = task.status === 'running';

  // Một dòng nói việc đang ở đâu: chờ việc con / đã yêu cầu dừng / bước đang chạy.
  const step = running ? stepLabel(task) : null;
  let line: { text: string; color: string } | null = null;
  if (childrenLabel) line = { text: childrenLabel, color: 'primary.main' };
  else if (task.stopRequested && canStop(task.status))
    line = { text: 'Đã yêu cầu dừng', color: 'warning.main' };
  else if (step) line = { text: step, color: 'info.main' };
  // Cột gộp nhiều trạng thái (chờ duyệt / chờ người, lỗi / dừng / huỷ) → ghi rõ trên thẻ.
  const showStatus = STATUS_ON_CARD.includes(task.status);

  const time =
    elapsed != null && (running || task.finishedAt)
      ? formatDuration(elapsed)
      : shortAgo(task.finishedAt || task.createdAt, now);

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={!isDraggable(task.status)}>
      {(provided, snapshot) => (
        <Paper
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpen(task)}
          data-testid="agent-task-card"
          sx={{
            width: 1,
            borderRadius: 1.5,
            // Cột nhiều thẻ cuộn trong khung — thẻ không được co lại.
            flexShrink: 0,
            overflow: 'hidden',
            position: 'relative',
            cursor: 'pointer',
            bgcolor: 'background.paper',
            boxShadow: theme.customShadows.z1,
            '&:hover': { boxShadow: theme.customShadows.z8 },
            '&:hover .agent-card-stop, & .agent-card-stop:focus-visible': { opacity: 1 },
            ...(selected && {
              boxShadow: theme.customShadows.z8,
              outline: `2px solid ${theme.palette.primary.main}`,
            }),
            ...(snapshot.isDragging && {
              boxShadow: theme.customShadows.z20,
              ...bgBlur({ opacity: 0.48, color: theme.palette.background.default }),
            }),
          }}
        >
          <Stack spacing={0.75} sx={{ px: 1.5, pt: 1.25, pb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                {taskCode(task.id)}
              </Typography>
              <Tooltip title={`Nguồn: ${source.label}`}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}>
                  <Iconify icon={source.icon} width={14} />
                </Box>
              </Tooltip>
              <Box sx={{ flexGrow: 1 }} />
              {showStatus && (
                <Label color={status.color} variant="soft" sx={{ height: 20, fontSize: 11 }}>
                  {status.label}
                </Label>
              )}
              {canStop(task.status) && !task.stopRequested && (
                <Tooltip title="Dừng việc">
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Dừng"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStop(task);
                    }}
                    className="agent-card-stop"
                    sx={{
                      p: 0.25,
                      mr: -0.5,
                      opacity: running ? 1 : 0,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    <Iconify icon="solar:stop-circle-bold" width={18} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            <Typography
              variant="subtitle2"
              sx={{
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            >
              {task.title}
            </Typography>

            {line && (
              <Typography variant="caption" noWrap sx={{ color: line.color }}>
                {line.text}
              </Typography>
            )}

            {running && progress.total > 0 && (
              <LinearProgress
                variant="determinate"
                value={progress.percent}
                sx={{ height: 4, borderRadius: 1 }}
              />
            )}

            <Stack
              direction="row"
              alignItems="center"
              spacing={0.75}
              sx={{ typography: 'caption', color: 'text.disabled' }}
            >
              <Tooltip title={task.agentName}>
                <Avatar
                  alt={task.agentName}
                  sx={{ width: 20, height: 20, bgcolor: 'primary.lighter', color: 'primary.dark' }}
                >
                  <Iconify icon="solar:cpu-bolt-bold" width={12} />
                </Avatar>
              </Tooltip>
              <Box component="span" sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  noWrap
                  component="div"
                  sx={{ color: 'text.secondary' }}
                >
                  {task.agentName}
                </Typography>
              </Box>
              {progress.total > 0 && !running && (
                <span>
                  {progress.done}/{progress.total}
                </span>
              )}
              <Iconify icon="solar:clock-circle-outline" width={13} />
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                {time}
              </Box>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Draggable>
  );
}

export default memo(AgentTaskCard);
