import type { LabelColor } from 'src/components/label';
import type { IWorkHubItem } from 'src/api/work-hub';

import { useMemo, useState } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import { fDateTime } from 'src/utils/format-time';

import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';

import { BOARD_COLUMNS, filterHubItems } from './agent-center-utils';

import type { TaskFilterState } from './agent-task-toolbar';

// ----------------------------------------------------------------------
// Chế độ Danh sách cho việc giao một người / vệ sinh theo ca (T2): 31 ngày gần nhất + việc giao chưa xong, phân trang ở
// máy. Bấm dòng mở hộp duyệt / chấm như trên bảng.
// ----------------------------------------------------------------------

const COLUMN_COLOR: Record<string, LabelColor> = {
  queued: 'default',
  running: 'info',
  waiting: 'warning',
  done: 'success',
  ended: 'error',
};

type Props = {
  items: IWorkHubItem[];
  filter: TaskFilterState;
  onOpen: (item: IWorkHubItem) => void;
};

export default function WorkHubTable({ items, filter, onOpen }: Props) {
  const [column, setColumn] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const cleaning = filter.kind === 'cleaning';

  const rows = useMemo(
    () =>
      filterHubItems(items, filter)
        .filter((i) => !column || i.column === column)
        .sort((a, b) => b.sortAt.localeCompare(a.sortAt)),
    [items, filter, column]
  );
  const pageRows = rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Card>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2 }}>
        <TextField
          select
          size="small"
          label="Cột"
          value={column}
          onChange={(e) => {
            setColumn(e.target.value);
            setPage(0);
          }}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Mọi trạng thái</MenuItem>
          {BOARD_COLUMNS.filter((c) => c.id !== 'running').map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {cleaning
            ? 'Vệ sinh 31 ngày gần nhất, mỗi dòng một ca.'
            : 'Việc chưa xong + việc đóng trong 31 ngày.'}
        </Typography>
      </Stack>

      <TableContainer>
        <Scrollbar>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>{cleaning ? 'Ca' : 'Việc'}</TableCell>
                <TableCell>{cleaning ? 'Người trong ca' : 'Người được giao'}</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>{cleaning ? 'Kết quả' : 'Hạn'}</TableCell>
                <TableCell>{cleaning ? 'Ngày' : 'Giao lúc'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    sx={{ py: 6, textAlign: 'center', color: 'text.disabled' }}
                  >
                    Không có mục nào khớp bộ lọc
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((item) => (
                <TableRow
                  key={`${item.kind}:${item.id}`}
                  hover
                  onClick={() => onOpen(item)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600 }}>
                      {item.code}
                    </Typography>
                    <Typography variant="subtitle2" noWrap>
                      {item.title}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Typography variant="body2" noWrap>
                      {item.assigneeName ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Label color={COLUMN_COLOR[item.column] ?? 'default'} variant="soft">
                      {item.statusLabel}
                    </Label>
                  </TableCell>
                  <TableCell
                    sx={{ whiteSpace: 'nowrap', color: item.overdue ? 'error.main' : undefined }}
                  >
                    {cleaning
                      ? item.subtitle
                      : item.dueAt
                        ? fDateTime(item.dueAt, 'HH:mm dd/MM')
                        : '—'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {cleaning && item.date
                      ? fDateTime(`${item.date}T00:00:00`, 'dd/MM/yyyy')
                      : fDateTime(item.createdAt, 'dd/MM HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <TablePagination
        component="div"
        page={page}
        count={rows.length}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[25, 50, 100]}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(Number(e.target.value));
          setPage(0);
        }}
        labelRowsPerPage="Số dòng"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        sx={{ borderTop: (t) => `dashed 1px ${t.palette.divider}` }}
      />
    </Card>
  );
}
