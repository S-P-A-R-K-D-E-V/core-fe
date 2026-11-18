'use client';

import { useMemo, useState } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAgentActionLogs } from 'src/api/agent-actions';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';

import { logDecision, isSuccessStatus, approvalModeLabel } from './agent-action-utils';

// ----------------------------------------------------------------------
// Nhật ký mọi lệnh ghi qua khoá agent (cả hai chế độ duyệt), mới nhất trước.
// ----------------------------------------------------------------------

const TAKE = 200;

export default function AgentLogsTab() {
  const { logs, loading, error, refresh } = useAgentActionLogs(true, undefined, TAKE);
  const [keyword, setKeyword] = useState('');

  const rows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return logs;
    return logs.filter((l) =>
      [l.agentName, l.path, l.permission ?? '', logDecision(l.decision).label]
        .join(' ')
        .toLowerCase()
        .includes(kw)
    );
  }, [logs, keyword]);

  return (
    <Card>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ p: 2.5 }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h6">Nhật ký lệnh ghi của agent</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {TAKE} lệnh gần nhất qua khoá agent — agent nào, mức áp dụng, kết quả.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Tìm agent, lệnh, quyền…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            color="inherit"
            onClick={() => refresh()}
            startIcon={<Iconify icon="solar:restart-bold" />}
            sx={{ flexShrink: 0 }}
          >
            Tải lại
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mx: 2.5, mb: 2.5 }}>
          {apiErrorMessage(error, 'Không tải được nhật ký')}
        </Alert>
      )}

      {loading && (
        <Stack spacing={1} sx={{ px: 2.5, pb: 2.5 }}>
          <Skeleton variant="rounded" height={40} />
          <Skeleton variant="rounded" height={40} />
          <Skeleton variant="rounded" height={40} />
        </Stack>
      )}

      {!loading && !error && (
        <TableContainer>
          <Scrollbar>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Thời gian</TableCell>
                  <TableCell>Agent</TableCell>
                  <TableCell>Lệnh</TableCell>
                  <TableCell>Quyền</TableCell>
                  <TableCell>Mức áp dụng</TableCell>
                  <TableCell align="right">Kết quả</TableCell>
                  <TableCell align="right">Thời gian chạy</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((log) => {
                  const decision = logDecision(log.decision);
                  return (
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {fDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{log.agentName}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          {approvalModeLabel(log.approvalMode)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
                        >
                          {log.method.toUpperCase()} {log.path}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {log.permission ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Label color={decision.color} variant="soft">
                          {decision.label}
                        </Label>
                      </TableCell>
                      <TableCell align="right">
                        <Label
                          variant="soft"
                          color={
                            log.statusCode === 202
                              ? 'warning'
                              : isSuccessStatus(log.statusCode)
                                ? 'success'
                                : 'error'
                          }
                        >
                          {log.statusCode}
                        </Label>
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {log.durationMs} ms
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      {keyword ? 'Không có dòng nào khớp' : 'Chưa có lệnh ghi nào qua khoá agent'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      )}
    </Card>
  );
}
