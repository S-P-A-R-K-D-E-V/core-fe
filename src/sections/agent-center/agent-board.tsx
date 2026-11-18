import type { DropResult } from '@hello-pangea/dnd';
import type { IAgentTask, IAgentDefinition } from 'src/api/agent-center';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Droppable, DragDropContext } from '@hello-pangea/dnd';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';

import AgentTaskCard from './agent-task-card';
import {
  decideDrop,
  BOARD_COLUMNS,
  type BoardColumnId,
  groupTasksByColumn,
} from './agent-center-utils';

// ----------------------------------------------------------------------
// Bảng việc dạng kanban (bộ kanban của template + @hello-pangea/dnd). Cột = trạng thái việc, máy chủ chuyển cột. Kéo thả chỉ
// cho hai nước: Lỗi / Đã dừng → Chờ chạy (chạy lại) và Chờ chạy → Lỗi / Đã dừng (huỷ); nước khác bị từ chối kèm toast.
// ----------------------------------------------------------------------

type Props = {
  tasks: IAgentTask[];
  agents: IAgentDefinition[];
  loading: boolean;
  selectedTaskId: string | null;
  onOpen: (task: IAgentTask) => void;
  onStop: (task: IAgentTask) => void;
  onRetry: (task: IAgentTask) => void;
  onCancel: (task: IAgentTask) => void;
  onRefresh: VoidFunction;
};

const COLUMN_WIDTH = 300;

export default function AgentBoard({
  tasks,
  agents,
  loading,
  selectedTaskId,
  onOpen,
  onStop,
  onRetry,
  onCancel,
  onRefresh,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [agentId, setAgentId] = useState<string>('');

  const columns = useMemo(() => groupTasksByColumn(tasks, agentId || null), [tasks, agentId]);
  const hasRunning = columns.running.length > 0;
  const hasWaiting = columns.waiting_approval.length + columns.waiting_human.length > 0;

  // Đồng hồ cho thời gian chạy: mỗi giây khi có việc đang chạy, mỗi 30 giây khi chỉ có việc đang chờ; không có thì tắt.
  const tickMs = hasRunning ? 1000 : hasWaiting ? 30_000 : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!tickMs) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);

  const onDragEnd = useCallback(
    ({ source, destination, draggableId }: DropResult) => {
      if (!destination) return;
      const task = tasks.find((t) => t.id === draggableId);
      if (!task) return;
      const decision = decideDrop(
        source.droppableId as BoardColumnId,
        destination.droppableId as BoardColumnId,
        task.status
      );
      if (decision.kind === 'retry') onRetry(task);
      else if (decision.kind === 'cancel') onCancel(task);
      else if (decision.kind === 'reject') enqueueSnackbar(decision.message, { variant: 'info' });
    },
    [tasks, onRetry, onCancel, enqueueSnackbar]
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField
          select
          size="small"
          label="Agent"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Tất cả agent</MenuItem>
          {agents.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="caption" sx={{ color: 'text.secondary', flexGrow: 1 }}>
          Việc của 7 ngày gần nhất và mọi việc chưa xong. Kéo thẻ Lỗi / Đã dừng về Chờ chạy để chạy
          lại; kéo thẻ Chờ chạy sang Lỗi / Đã dừng để huỷ.
        </Typography>
        <Button
          size="small"
          color="inherit"
          onClick={onRefresh}
          startIcon={<Iconify icon="solar:restart-bold" />}
        >
          Tải lại
        </Button>
      </Stack>

      <DragDropContext onDragEnd={onDragEnd}>
        <Scrollbar sx={{ pb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="flex-start">
            {BOARD_COLUMNS.map((col) => {
              const list = columns[col.id];
              return (
                <Paper
                  key={col.id}
                  sx={{
                    px: 1.5,
                    pt: 1.5,
                    borderRadius: 2,
                    flexShrink: 0,
                    width: COLUMN_WIDTH,
                    bgcolor: 'background.neutral',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 0.5, mb: 1 }}>
                    <Iconify icon={col.icon} width={18} />
                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                      {col.label}
                    </Typography>
                    <Label color={col.color} variant="soft">
                      {list.length}
                    </Label>
                  </Stack>

                  <Droppable droppableId={col.id} type="TASK">
                    {(dropProvided, dropSnapshot) => (
                      <Stack
                        ref={dropProvided.innerRef}
                        {...dropProvided.droppableProps}
                        spacing={1.5}
                        sx={{
                          pb: 2,
                          minHeight: 120,
                          borderRadius: 1.5,
                          transition: 'background-color 0.2s',
                          ...(dropSnapshot.isDraggingOver && { bgcolor: 'action.hover' }),
                        }}
                      >
                        {loading && list.length === 0 && (
                          <>
                            <Skeleton variant="rounded" height={110} />
                            <Skeleton variant="rounded" height={110} />
                          </>
                        )}
                        {!loading && list.length === 0 && (
                          <Box
                            sx={{
                              py: 4,
                              textAlign: 'center',
                              typography: 'caption',
                              color: 'text.disabled',
                            }}
                          >
                            Trống
                          </Box>
                        )}
                        {list.map((task, index) => (
                          <AgentTaskCard
                            key={task.id}
                            task={task}
                            index={index}
                            now={now}
                            selected={task.id === selectedTaskId}
                            onOpen={onOpen}
                            onStop={onStop}
                          />
                        ))}
                        {dropProvided.placeholder}
                      </Stack>
                    )}
                  </Droppable>
                </Paper>
              );
            })}
          </Stack>
        </Scrollbar>
      </DragDropContext>
    </Stack>
  );
}
