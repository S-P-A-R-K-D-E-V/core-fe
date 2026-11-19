import type { IAgentTask } from 'src/api/agent-center';
import type { IWorkHubItem } from 'src/api/work-hub';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';
import TablePagination from '@mui/material/TablePagination';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useDebounce } from 'src/hooks/use-debounce';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAgentTaskList } from 'src/api/agent-center';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';

import {
  taskCode,
  taskTokens,
  shortTokens,
  taskElapsedMs,
  formatDuration,
  taskSourceMeta,
  taskStatusMeta,
} from './agent-center-utils';

import WorkHubTable from './work-hub-table';

import type { TaskFilterState } from './agent-task-toolbar';

// ----------------------------------------------------------------------
// Chế độ Danh sách: mọi việc theo bộ lọc, phân trang ở máy chủ (`skip` / `take`), xem được việc cũ hơn 7 ngày.
// ----------------------------------------------------------------------

export const LIST_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Mọi trạng thái' },
  {
    value: 'queued,running,waiting_approval,waiting_human,waiting_children',
    label: 'Chưa xong',
  },
  { value: 'waiting_approval,waiting_human', label: 'Chờ duyệt / chờ người' },
  { value: 'done', label: 'Xong' },
  { value: 'failed,stopped,cancelled', label: 'Lỗi / dừng / huỷ' },
];

const PERIODS: { value: number; label: string }[] = [
  { value: 7, label: '7 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
  { value: 365, label: '1 năm' },
];

const ROWS_OPTIONS = [25, 50, 100];

type Props = {
  filter: TaskFilterState;
  status: string;
  onStatus: (status: string) => void;
  selectedTaskId: string | null;
  onOpen: (task: IAgentTask) => void;
  /** Hub mất kết nối → hỏi lại mỗi 30 giây. */
  poll: boolean;
};

/** Danh sách: Loại = việc giao / vệ sinh → bảng các mục đó (đã tải ở trang); còn lại → việc agent phân trang ở máy chủ. */
export default function AgentTaskList({
  hubItems,
  onOpenItem,
  ...props
}: Props & { hubItems: IWorkHubItem[]; onOpenItem: (item: IWorkHubItem) => void }) {
  if (props.filter.kind === 'work' || props.filter.kind === 'cleaning')
    return <WorkHubTable items={hubItems} filter={props.filter} onOpen={onOpenItem} />;
  return <AgentOnlyList {...props} />;
}

function AgentOnlyList({ filter, status, onStatus, selectedTaskId, onOpen, poll }: Props) {
  const [days, setDays] = useState(7);
  const [withConversation, setWithConversation] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const q = useDebounce(filter.q.trim(), 350);

  // Lọc đổi → về trang đầu.
  useEffect(() => setPage(0), [q, filter.agentId, filter.source, status, days, withConversation]);

  // Mốc "từ ngày" tính theo đầu ngày để khoá SWR không đổi mỗi lần vẽ lại.
  const from = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - days + 1);
    return d.toISOString();
  }, [days]);

  // Xin dư một dòng để biết còn trang sau.
  const { tasks, loading, error } = useAgentTaskList(
    {
      status: status || undefined,
      agentId: filter.agentId || undefined,
      source: filter.source || undefined,
      q: q || undefined,
      from,
      hideConversation: !withConversation,
      skip: page * rowsPerPage,
      take: rowsPerPage + 1,
    },
    poll
  );
  const rows = tasks.slice(0, rowsPerPage);
  const hasNext = tasks.length > rowsPerPage;
  const count = hasNext ? -1 : page * rowsPerPage + rows.length;
  const now = Date.now();

  return (
    <Card>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ p: 2 }}
      >
        <TextField
          select
          size="small"
          label="Trạng thái"
          value={status}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          onChange={(e) => onStatus(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {LIST_STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value || 'all'} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Tạo trong"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          sx={{ minWidth: 120 }}
        >
          {PERIODS.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={withConversation}
              onChange={(e) => setWithConversation(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Gồm việc trả lời tin khách</Typography>}
        />
      </Stack>

      {loading && <LinearProgress sx={{ height: 2 }} />}
      {!!error && (
        <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
          {apiErrorMessage(error, 'Không tải được danh sách việc')}
        </Alert>
      )}

      <TableContainer>
        <Scrollbar>
          <Table size="small" sx={{ minWidth: 860 }}>
            <TableHead>
              <TableRow>
                <TableCell>Việc</TableCell>
                <TableCell>Agent</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Nguồn</TableCell>
                <TableCell>Tạo lúc</TableCell>
                <TableCell align="right">Thời gian</TableCell>
                <TableCell align="right">Token</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    sx={{ py: 6, textAlign: 'center', color: 'text.disabled' }}
                  >
                    Không có việc nào khớp bộ lọc
                  </TableCell>
                </TableRow>
              )}
              {rows.map((task) => {
                const st = taskStatusMeta(task.status);
                const src = taskSourceMeta(task.source);
                const elapsed = taskElapsedMs(task, now);
                return (
                  <TableRow
                    key={task.id}
                    hover
                    selected={task.id === selectedTaskId}
                    onClick={() => onOpen(task)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ maxWidth: 380 }}>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.disabled', fontWeight: 600 }}
                      >
                        {taskCode(task.id)}
                      </Typography>
                      <Typography variant="subtitle2" noWrap>
                        {task.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Avatar
                          sx={{
                            width: 24,
                            height: 24,
                            bgcolor: 'primary.lighter',
                            color: 'primary.dark',
                          }}
                        >
                          <Iconify icon="solar:cpu-bolt-bold" width={14} />
                        </Avatar>
                        <Typography variant="body2" noWrap>
                          {task.agentName}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Label color={st.color} variant="soft">
                        {st.label}
                      </Label>
                    </TableCell>
                    <TableCell>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        sx={{ typography: 'body2' }}
                      >
                        <Iconify icon={src.icon} width={16} sx={{ color: 'text.disabled' }} />
                        <span>{src.label}</span>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {fDateTime(task.createdAt, 'dd/MM HH:mm')}
                    </TableCell>
                    <TableCell align="right">
                      {elapsed != null ? formatDuration(elapsed) : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {taskTokens(task) > 0 ? shortTokens(taskTokens(task)) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <Box sx={{ borderTop: (t) => `dashed 1px ${t.palette.divider}` }}>
        <TablePagination
          component="div"
          page={page}
          count={count}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={ROWS_OPTIONS}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          labelRowsPerPage="Số dòng"
          labelDisplayedRows={({ from: a, to: b }) => `${a}–${b}`}
        />
      </Box>
    </Card>
  );
}
