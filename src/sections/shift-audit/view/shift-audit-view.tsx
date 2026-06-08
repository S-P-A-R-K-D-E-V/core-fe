'use client';

import { useCallback, useEffect, useState } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';

import { type IShiftAuditLog, getShiftAuditLogs } from 'src/api/shiftAudit';

// ----------------------------------------------------------------------

const ACTION_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  ASSIGN: 'primary',
  BULK_ASSIGN: 'primary',
  MANAGE_ASSIGN: 'info',
  SWAP_DIRECTED: 'warning',
  CREATE_POST: 'default',
  CLAIM_POST: 'info',
  CANCEL_POST: 'default',
  APPROVE_POST: 'success',
  REJECT_CLAIM: 'error',
  DIRECTED_RESOLVE: 'warning',
  SET_PREFERENCE: 'secondary',
};

const ACTION_LABELS: Record<string, string> = {
  ASSIGN: 'Phân công',
  BULK_ASSIGN: 'Phân công hàng loạt',
  MANAGE_ASSIGN: 'Quản lý phân công',
  SWAP_DIRECTED: 'Chỉ định đổi ca',
  CREATE_POST: 'Đăng pool',
  CLAIM_POST: 'Nhận ca',
  CANCEL_POST: 'Huỷ đăng',
  APPROVE_POST: 'Duyệt pool',
  REJECT_CLAIM: 'Từ chối nhận',
  DIRECTED_RESOLVE: 'Chỉ định giải quyết',
  SET_PREFERENCE: 'Cài ca ưa thích',
};

const ACTION_TYPES = Object.keys(ACTION_LABELS);

function toVNDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ----------------------------------------------------------------------

export default function ShiftAuditView() {
  const settings = useSettingsContext();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [actionType, setActionType] = useState('');
  const [logs, setLogs] = useState<IShiftAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getShiftAuditLogs({
        date,
        actionType: actionType || undefined,
        limit: 500,
      });
      setLogs(data);
    } catch {
      setError('Không thể tải audit log. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [date, actionType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Audit Log ca làm"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Audit Log ca làm' },
        ]}
        sx={{ mb: 3 }}
      />

      {/* Bộ lọc */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          label="Ngày"
          type="date"
          size="small"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="Loại thao tác"
          select
          size="small"
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          {ACTION_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {ACTION_LABELS[t] ?? t}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Card>
        {loading && (
          <Stack alignItems="center" py={4}>
            <CircularProgress size={28} />
          </Stack>
        )}

        {!loading && error && (
          <Typography color="error" sx={{ p: 3 }}>
            {error}
          </Typography>
        )}

        {!loading && !error && (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 900 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 160 }}>Thời gian</TableCell>
                    <TableCell sx={{ minWidth: 140 }}>Thao tác</TableCell>
                    <TableCell sx={{ minWidth: 140 }}>Người thực hiện</TableCell>
                    <TableCell sx={{ minWidth: 80 }}>Vai trò</TableCell>
                    <TableCell sx={{ minWidth: 100 }}>Ngày ca</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>Loại nhu cầu</TableCell>
                    <TableCell>Ghi chú</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        Không có dữ liệu cho ngày này.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>
                        <Typography variant="caption" noWrap>
                          {toVNDate(log.timestamp)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={ACTION_LABELS[log.actionType] ?? log.actionType}
                          color={ACTION_COLORS[log.actionType] ?? 'default'}
                          size="small"
                          variant="soft"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={`ID: ${log.actorId}`} placement="top">
                          <Typography variant="body2" noWrap>
                            {log.actorName}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {log.actorRole}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{log.shiftDate}</Typography>
                      </TableCell>
                      <TableCell>
                        {log.needType ? (
                          <Typography variant="caption">{log.needType}</Typography>
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {log.note ?? '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}

        {!loading && !error && (
          <Stack
            direction="row"
            justifyContent="flex-end"
            sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="caption" color="text.secondary">
              {logs.length} bản ghi
            </Typography>
          </Stack>
        )}
      </Card>
    </Container>
  );
}
