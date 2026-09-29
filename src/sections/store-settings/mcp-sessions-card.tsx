'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { TableHeadCustom } from 'src/components/table';

import {
  type IMcpCall,
  type IMcpSession,
  listMcpCalls,
  listMcpSessions,
} from 'src/api/store-settings';

// ----------------------------------------------------------------------
// Phiên MCP gần đây: agent nào (clientInfo), khoá nào, bao nhiêu lượt gọi / lỗi. Mở 1 phiên -> các
// lượt gọi tool (tham số đã rút gọn), mới nhất trước.

const HEAD = [
  { id: 'expand', label: '', width: 40 },
  { id: 'client', label: 'Agent' },
  { id: 'key', label: 'Khoá API' },
  { id: 'started', label: 'Bắt đầu' },
  { id: 'seen', label: 'Hoạt động cuối' },
  { id: 'calls', label: 'Lượt gọi', align: 'right' as const },
  { id: 'status', label: 'Trạng thái', align: 'center' as const },
];

export const MCP_CALL_STATUS: Record<
  string,
  { label: string; color: 'success' | 'error' | 'warning' | 'default' }
> = {
  ok: { label: 'OK', color: 'success' },
  error: { label: 'Lỗi', color: 'error' },
  denied: { label: 'Không có quyền', color: 'error' },
  needs_confirm: { label: 'Chờ xác nhận', color: 'warning' },
};

const IDLE_MS = 30 * 60 * 1000;

export function mcpSessionState(s: IMcpSession) {
  if (s.closedAt) return { label: 'Đã đóng', color: 'default' as const };
  if (Date.now() - new Date(s.lastActivityAt).getTime() > IDLE_MS) {
    return { label: 'Không hoạt động', color: 'default' as const };
  }
  return { label: 'Đang mở', color: 'success' as const };
}

export function McpSessionCalls({ sessionId }: { sessionId: string }) {
  const [calls, setCalls] = useState<IMcpCall[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listMcpCalls(sessionId)
      .then((data) => alive && setCalls(data))
      .catch((err) => alive && setError(apiErrorMessage(err, 'Không tải được lượt gọi.')));
    return () => {
      alive = false;
    };
  }, [sessionId]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!calls) return <CircularProgress size={20} />;
  if (!calls.length) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Phiên này chưa gọi tool nào (chỉ kết nối / xem danh sách tool).
      </Typography>
    );
  }
  return (
    <Box>
      {calls.map((c) => {
        const st = MCP_CALL_STATUS[c.status] ?? { label: c.status, color: 'default' as const };
        return (
          <Box
            key={c.id}
            sx={{ display: 'flex', gap: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', width: 120, flexShrink: 0 }}
            >
              {fDateTime(c.createdAt, 'HH:mm:ss dd/MM')}
            </Typography>
            <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
              <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                {c.tool}
              </Typography>
              {c.arguments && c.arguments !== '{}' && (
                <Typography
                  variant="caption"
                  component="div"
                  sx={{ fontFamily: 'monospace', color: 'text.secondary', wordBreak: 'break-all' }}
                >
                  {c.arguments}
                </Typography>
              )}
              {c.error && (
                <Typography variant="caption" component="div" sx={{ color: 'error.main' }}>
                  {c.error}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
              {c.durationMs} ms
            </Typography>
            <Label variant="soft" color={st.color} sx={{ flexShrink: 0 }}>
              {st.label}
            </Label>
          </Box>
        );
      })}
    </Box>
  );
}

export function McpSessionsCard() {
  const [sessions, setSessions] = useState<IMcpSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listMcpSessions()
      .then((data) => {
        setSessions(data);
        setError(null);
      })
      .catch((err) => setError(apiErrorMessage(err, 'Không tải được phiên MCP.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader
        title="Phiên gần đây"
        subheader="Mỗi lần agent kết nối là 1 phiên; mở phiên để xem từng tool đã gọi (giữ 90 ngày)."
        action={
          <Button
            size="small"
            color="inherit"
            onClick={load}
            startIcon={<Iconify icon="solar:refresh-bold" />}
          >
            Tải lại
          </Button>
        }
      />
      {error && (
        <Box sx={{ px: 3, pt: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}
      <Scrollbar>
        <Table sx={{ minWidth: 720 }}>
          <TableHeadCustom headLabel={HEAD} />
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={HEAD.length} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}
            {!loading && sessions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={HEAD.length}
                  align="center"
                  sx={{ py: 5, color: 'text.secondary' }}
                >
                  Chưa có agent nào kết nối.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              sessions.map((s) => {
                const st = mcpSessionState(s);
                const isOpen = open === s.id;
                return (
                  <Fragment key={s.id}>
                    <TableRow
                      hover
                      onClick={() => setOpen(isOpen ? null : s.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <IconButton size="small" aria-label={isOpen ? 'Thu gọn' : 'Xem lượt gọi'}>
                          <Iconify
                            icon={
                              isOpen ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
                            }
                          />
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="subtitle2">{s.clientName || 'Không rõ'}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {[s.clientVersion, s.ipAddress].filter(Boolean).join(' · ')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {s.keyName}
                        <Typography
                          variant="caption"
                          component="div"
                          sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                        >
                          {s.keyPrefix}
                        </Typography>
                      </TableCell>
                      <TableCell>{fDateTime(s.createdAt)}</TableCell>
                      <TableCell>{fDateTime(s.lastActivityAt)}</TableCell>
                      <TableCell align="right">
                        {s.callCount}
                        {s.errorCount > 0 && (
                          <Typography
                            variant="caption"
                            component="div"
                            sx={{ color: 'error.main' }}
                          >
                            {s.errorCount} lỗi / từ chối
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Label variant="soft" color={st.color}>
                          {st.label}
                        </Label>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        colSpan={HEAD.length}
                        sx={{ py: 0, borderBottom: isOpen ? undefined : 0 }}
                      >
                        <Collapse in={isOpen} unmountOnExit>
                          <Box sx={{ py: 2 }}>
                            <McpSessionCalls sessionId={s.id} />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
          </TableBody>
        </Table>
      </Scrollbar>
    </Card>
  );
}
