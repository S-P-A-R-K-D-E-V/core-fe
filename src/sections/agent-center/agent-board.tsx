import type { DropResult } from '@hello-pangea/dnd';
import type { IAgentTask } from 'src/api/agent-center';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Droppable, DragDropContext } from '@hello-pangea/dnd';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import AgentTaskCard from './agent-task-card';
import {
  buildBoard,
  decideDrop,
  BOARD_COLUMNS,
  type BoardMode,
  type BoardColumnId,
} from './agent-center-utils';

// ----------------------------------------------------------------------
// Bảng việc dạng kanban (theo kanban của Minimal + @hello-pangea/dnd). Cột = nhóm trạng thái, máy chủ chuyển cột.
// - Chế độ "Đang phải làm" ẩn cột Xong và việc đã huỷ; "Tất cả" hiện cột Xong (chỉ việc xong hôm nay).
// - Cột Lỗi / Đã dừng chỉ giữ việc từ đầu hôm qua, thu gọn được; việc cũ hơn → "Xem N việc trước đó" mở chế độ Danh sách.
// - Mỗi cột cuộn riêng, đầu cột đứng yên, bảng không kéo dài cả trang.
// Kéo thả chỉ cho hai nước: Lỗi / Đã dừng → Chờ chạy (chạy lại) và Chờ chạy → Lỗi / Đã dừng (huỷ).
// ----------------------------------------------------------------------

type Props = {
  /** Việc đã lọc (agent / nguồn / từ khoá) — bảng chỉ chia cột. */
  tasks: IAgentTask[];
  mode: BoardMode;
  loading: boolean;
  selectedTaskId: string | null;
  onOpen: (task: IAgentTask) => void;
  onStop: (task: IAgentTask) => void;
  onRetry: (task: IAgentTask) => void;
  onCancel: (task: IAgentTask) => void;
  /** Mở chế độ Danh sách lọc sẵn trạng thái (vd "done", "failed,stopped,cancelled"). */
  onShowList: (status: string) => void;
};

const COLUMN_MIN_WIDTH = 264;
const COLUMN_MAX_WIDTH = 380;
const COLLAPSED_WIDTH = 52;
const COLLAPSE_KEY = 'agent-board:collapsed';

function readCollapsed(): BoardColumnId[] {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? (JSON.parse(raw) as BoardColumnId[]) : [];
  } catch {
    return [];
  }
}

export default function AgentBoard({
  tasks,
  mode,
  loading,
  selectedTaskId,
  onOpen,
  onStop,
  onRetry,
  onCancel,
  onShowList,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const hasRunning = tasks.some((t) => t.status === 'running');
  const hasWaiting = tasks.some((t) => t.status.startsWith('waiting'));

  // Đồng hồ cho thời gian chạy: mỗi giây khi có việc đang chạy, mỗi 30 giây khi chỉ có việc đang chờ, còn lại mỗi phút
  // (để cột Xong "hôm nay" tự sang ngày).
  const tickMs = hasRunning ? 1000 : hasWaiting ? 30_000 : 60_000;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);

  // ≤ 200 việc — dựng lại theo đồng hồ cũng rẻ, và cột Xong "hôm nay" tự sang ngày.
  const board = useMemo(() => buildBoard(tasks, mode, now), [tasks, mode, now]);

  const [collapsed, setCollapsed] = useState<BoardColumnId[]>([]);
  useEffect(() => setCollapsed(readCollapsed()), []);
  const toggleCollapsed = (id: BoardColumnId) =>
    setCollapsed((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        // Trình duyệt chặn lưu → chỉ nhớ trong phiên.
      }
      return next;
    });

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

  const columns = BOARD_COLUMNS.filter((c) => mode === 'all' || !c.allOnly);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="flex-start"
          sx={{ minWidth: 'min-content' }}
        >
          {columns.map((col) => {
            const list = board.columns[col.id];
            const isCollapsed = collapsed.includes(col.id);
            const older =
              col.id === 'done' ? board.olderDone : col.id === 'ended' ? board.olderEnded : 0;

            if (isCollapsed) {
              return (
                <Paper
                  key={col.id}
                  onClick={() => toggleCollapsed(col.id)}
                  sx={{
                    width: COLLAPSED_WIDTH,
                    flexShrink: 0,
                    py: 1.5,
                    borderRadius: 2,
                    cursor: 'pointer',
                    bgcolor: 'background.neutral',
                  }}
                >
                  <Stack alignItems="center" spacing={1}>
                    <Label color={col.color} variant="soft">
                      {list.length}
                    </Label>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        writingMode: 'vertical-rl',
                        whiteSpace: 'nowrap',
                        color: 'text.secondary',
                      }}
                    >
                      {col.label}
                    </Typography>
                  </Stack>
                  {/* Vẫn nhận thả khi thu gọn (kéo Chờ chạy → Lỗi để huỷ). */}
                  <Droppable droppableId={col.id} type="TASK">
                    {(p) => (
                      <Box ref={p.innerRef} {...p.droppableProps} sx={{ minHeight: 80 }}>
                        {p.placeholder}
                      </Box>
                    )}
                  </Droppable>
                </Paper>
              );
            }

            return (
              <Paper
                key={col.id}
                data-testid={`agent-column-${col.id}`}
                sx={{
                  flex: '1 1 0',
                  minWidth: COLUMN_MIN_WIDTH,
                  maxWidth: COLUMN_MAX_WIDTH,
                  borderRadius: 2,
                  bgcolor: 'background.neutral',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: { xs: 'none', md: 'calc(100vh - 330px)' },
                  minHeight: 220,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ px: 1.5, pt: 1.5, pb: 1 }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: col.color === 'default' ? 'grey.500' : `${col.color}.main`,
                    }}
                  />
                  <Typography variant="subtitle2" noWrap sx={{ flexGrow: 1 }}>
                    {col.label}
                  </Typography>
                  <Label color={col.color} variant="soft">
                    {list.length}
                  </Label>
                  {(col.id === 'ended' || col.id === 'done') && (
                    <Tooltip title="Thu gọn cột">
                      <IconButton
                        size="small"
                        onClick={() => toggleCollapsed(col.id)}
                        sx={{ p: 0.25 }}
                      >
                        <Iconify icon="solar:minimize-square-linear" width={16} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>

                <Droppable droppableId={col.id} type="TASK">
                  {(dropProvided, dropSnapshot) => (
                    <Stack
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      spacing={1}
                      sx={{
                        px: 1,
                        pb: 1,
                        flexGrow: 1,
                        overflowY: 'auto',
                        minHeight: 120,
                        transition: 'background-color 0.2s',
                        ...(dropSnapshot.isDraggingOver && { bgcolor: 'action.hover' }),
                      }}
                    >
                      {loading && list.length === 0 && (
                        <>
                          <Skeleton variant="rounded" height={84} />
                          <Skeleton variant="rounded" height={84} />
                        </>
                      )}
                      {!loading && list.length === 0 && (
                        <Box
                          sx={{
                            py: 3,
                            textAlign: 'center',
                            typography: 'caption',
                            color: 'text.disabled',
                          }}
                        >
                          {col.id === 'done' ? 'Chưa có việc xong hôm nay' : 'Trống'}
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

                {older > 0 && (
                  <Box sx={{ px: 1.5, py: 1, borderTop: (t) => `dashed 1px ${t.palette.divider}` }}>
                    <Link
                      component="button"
                      variant="caption"
                      color="text.secondary"
                      onClick={() =>
                        onShowList(col.id === 'done' ? 'done' : 'failed,stopped,cancelled')
                      }
                    >
                      Xem {older} việc {col.id === 'done' ? 'xong' : 'lỗi / dừng'} trước đó →
                    </Link>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Stack>
      </Box>
    </DragDropContext>
  );
}
