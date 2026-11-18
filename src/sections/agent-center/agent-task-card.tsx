import type { IAgentTask } from 'src/api/agent-center';

import { memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { fToNow } from 'src/utils/format-time';

import { bgBlur } from 'src/theme/css';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';

import {
  canStop,
  stepLabel,
  taskTokens,
  shortTokens,
  isDraggable,
  planProgress,
  taskElapsedMs,
  formatDuration,
  taskSourceMeta,
  taskStatusMeta,
} from './agent-center-utils';

// ----------------------------------------------------------------------
// Thẻ việc trên bảng (dựa trên kanban-task-item của template): agent, tên việc, nguồn, bước hiện tại, tiến độ kế hoạch,
// thời gian chạy (đang chạy thì tự tăng theo `now`), token, nút Dừng.
// ----------------------------------------------------------------------

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
  const label = stepLabel(task);
  const source = taskSourceMeta(task.source);
  const elapsed = taskElapsedMs(task, now);
  const tokens = taskTokens(task);
  const status = taskStatusMeta(task.status);
  const showStatus = ['failed', 'stopped', 'cancelled'].includes(task.status);

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={!isDraggable(task.status)}>
      {(provided, snapshot) => (
        <Paper
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpen(task)}
          sx={{
            width: 1,
            borderRadius: 1.5,
            overflow: 'hidden',
            position: 'relative',
            cursor: 'pointer',
            bgcolor: 'background.default',
            boxShadow: theme.customShadows.z1,
            '&:hover': { boxShadow: theme.customShadows.z20 },
            ...(selected && {
              boxShadow: theme.customShadows.z20,
              outline: `2px solid ${theme.palette.primary.main}`,
            }),
            ...(snapshot.isDragging && {
              boxShadow: theme.customShadows.z20,
              ...bgBlur({ opacity: 0.48, color: theme.palette.background.default }),
            }),
          }}
        >
          <Stack spacing={1.25} sx={{ px: 2, py: 1.75 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Avatar
                alt={task.agentName}
                sx={{ width: 24, height: 24, fontSize: 12, bgcolor: 'primary.main' }}
              >
                {(task.agentName || '?').trim().charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="caption" noWrap sx={{ flexGrow: 1, color: 'text.secondary' }}>
                {task.agentName}
              </Typography>
              <Tooltip title={`Nguồn: ${source.label}`}>
                <Label variant="soft" startIcon={<Iconify icon={source.icon} width={14} />}>
                  {source.label}
                </Label>
              </Tooltip>
            </Stack>

            <Typography variant="subtitle2" sx={{ wordBreak: 'break-word' }}>
              {task.title}
            </Typography>

            {showStatus && (
              <Box>
                <Label color={status.color} variant="soft">
                  {status.label}
                </Label>
              </Box>
            )}

            {label && (
              <Typography
                variant="caption"
                sx={{ color: task.status === 'running' ? 'info.main' : 'text.secondary' }}
              >
                {label}
              </Typography>
            )}

            {task.stopRequested && canStop(task.status) && (
              <Typography variant="caption" sx={{ color: 'warning.main' }}>
                Đã yêu cầu dừng — dừng sau bước hiện tại
              </Typography>
            )}

            {progress.total > 0 && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <LinearProgress
                  variant="determinate"
                  value={progress.percent}
                  color={task.status === 'failed' ? 'error' : 'primary'}
                  sx={{ flexGrow: 1, height: 6, borderRadius: 1 }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {progress.done}/{progress.total}
                </Typography>
              </Stack>
            )}

            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ typography: 'caption', color: 'text.disabled' }}
            >
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Iconify icon="solar:clock-circle-outline" width={14} />
                <span>
                  {elapsed != null ? formatDuration(elapsed) : `tạo ${fToNow(task.createdAt)}`}
                </span>
              </Stack>
              {tokens > 0 && (
                <Tooltip title={`Vào ${task.inputTokens} · ra ${task.outputTokens} token`}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Iconify icon="solar:bolt-circle-outline" width={14} />
                    <span>{shortTokens(tokens)}</span>
                  </Stack>
                </Tooltip>
              )}
              <Box sx={{ flexGrow: 1 }} />
              {canStop(task.status) && !task.stopRequested && (
                <Button
                  size="small"
                  color="error"
                  variant="soft"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStop(task);
                  }}
                  startIcon={<Iconify icon="solar:stop-circle-bold" width={16} />}
                  sx={{ minHeight: 26, py: 0, px: 1 }}
                >
                  Dừng
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      )}
    </Draggable>
  );
}

export default memo(AgentTaskCard);
