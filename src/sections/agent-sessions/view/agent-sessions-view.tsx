'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import TableContainer from '@mui/material/TableContainer';

import { useAuthContext } from 'src/auth/hooks';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import {
  useTable,
  emptyRows,
  TableNoData,
  TableEmptyRows,
  TableHeadCustom,
  TablePaginationCustom,
} from 'src/components/table';

import { fToNow } from 'src/utils/format-time';

import {
  claimSession,
  releaseSession,
  listActiveSessions,
  sendHumanMessage,
  getSessionMessages,
  type AgentSessionSummary,
  type AgentSessionMessage,
} from 'src/api/agentSessions';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'sessionId', label: 'Phiên' },
  { id: 'preview', label: 'Tin nhắn gần nhất' },
  { id: 'control', label: 'Trạng thái' },
  { id: 'tokenUsage', label: 'Token ước tính', align: 'right' },
  { id: 'lastActive', label: 'Cập nhật' },
  { id: '', label: '' },
];

const REFRESH_INTERVAL_MS = 12000;

export default function AgentSessionsView() {
  const settings = useSettingsContext();
  const table = useTable({ defaultRowsPerPage: 10 });
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimTarget, setClaimTarget] = useState<AgentSessionSummary | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [replyTarget, setReplyTarget] = useState<AgentSessionSummary | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await listActiveSessions();
      setSessions(data);
    } catch (err) {
      console.error('[AgentSessions] fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleSubmitClaim = async () => {
    if (!claimTarget) return;
    setClaiming(true);
    try {
      await claimSession(claimTarget.sessionId);
      enqueueSnackbar('Đã nhận phiên — AI sẽ ngừng tự trả lời cho tới khi bạn trả lại.', {
        variant: 'success',
      });
      setClaimTarget(null);
      fetchSessions();
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Nhận phiên thất bại', { variant: 'error' });
    } finally {
      setClaiming(false);
    }
  };

  const handleRelease = async (session: AgentSessionSummary) => {
    try {
      await releaseSession(session.sessionId);
      enqueueSnackbar('Đã trả phiên lại cho AI', { variant: 'success' });
      fetchSessions();
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Trả phiên thất bại', { variant: 'error' });
    }
  };

  const notFound = !loading && sessions.length === 0;
  const pageRows = sessions.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  return (
    <RoleBasedGuard hasContent roles={['Admin', 'Manager']}>
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <CustomBreadcrumbs
          heading="Phiên chat AI"
          links={[{ name: 'Dashboard', href: '/dashboard' }, { name: 'Phiên chat AI' }]}
          action={
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:restart-bold" />}
              onClick={fetchSessions}
            >
              Làm mới
            </Button>
          }
          sx={{ mb: 3 }}
        />

        <Card>
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table sx={{ minWidth: 900 }}>
                <TableHeadCustom headLabel={TABLE_HEAD} rowCount={sessions.length} />

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={TABLE_HEAD.length} align="center" sx={{ py: 5 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((session) => {
                      const isMine = session.assignedUserId === user?.id;
                      return (
                        <TableRow key={session.sessionId} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                            {session.sessionId.slice(0, 16)}…
                          </TableCell>
                          <TableCell sx={{ maxWidth: 320 }}>
                            <Typography variant="body2" noWrap>
                              {session.preview || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {session.control === 'human' ? (
                              <Chip
                                size="small"
                                color={isMine ? 'primary' : 'warning'}
                                label={isMine ? 'Bạn đang trả lời' : `Người khác đang trả lời`}
                              />
                            ) : (
                              <Chip size="small" color="default" variant="outlined" label="AI" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {session.tokenUsage.total.toLocaleString('vi-VN')}
                          </TableCell>
                          <TableCell>
                            {session.lastActive ? fToNow(session.lastActive * 1000) : '—'}
                          </TableCell>
                          <TableCell align="right">
                            {session.control === 'human' && isMine ? (
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => setReplyTarget(session)}
                                >
                                  Trả lời
                                </Button>
                                <Button
                                  size="small"
                                  color="inherit"
                                  onClick={() => handleRelease(session)}
                                >
                                  Trả lại AI
                                </Button>
                              </Stack>
                            ) : session.control === 'human' ? (
                              <Typography variant="caption" color="text.secondary">
                                Đang bị nhận
                              </Typography>
                            ) : (
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => setClaimTarget(session)}
                              >
                                Nhận
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}

                  <TableEmptyRows
                    height={56}
                    emptyRows={emptyRows(table.page, table.rowsPerPage, sessions.length)}
                  />
                  <TableNoData notFound={notFound} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>

          <TablePaginationCustom
            count={sessions.length}
            page={table.page}
            rowsPerPage={table.rowsPerPage}
            onPageChange={table.onChangePage}
            onRowsPerPageChange={table.onChangeRowsPerPage}
          />
        </Card>

        <ConfirmDialog
          open={!!claimTarget}
          onClose={() => setClaimTarget(null)}
          title="Nhận phiên chat"
          content="AI sẽ ngừng tự trả lời cho khách trong phiên này cho tới khi bạn trả lại. Bạn cần tự gõ trả lời."
          action={
            <Button variant="contained" onClick={handleSubmitClaim} disabled={claiming}>
              Xác nhận nhận
            </Button>
          }
        />

        {replyTarget && (
          <ReplyDialog
            session={replyTarget}
            onClose={() => setReplyTarget(null)}
            onSent={fetchSessions}
          />
        )}
      </Container>
    </RoleBasedGuard>
  );
}

// ----------------------------------------------------------------------

function ReplyDialog({
  session,
  onClose,
  onSent,
}: {
  session: AgentSessionSummary;
  onClose: () => void;
  onSent: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [messages, setMessages] = useState<AgentSessionMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSessionMessages(session.sessionId)
      .then((items) => {
        if (!cancelled) setMessages(items);
      })
      .catch((err) => console.error('[AgentSessions] load messages failed', err))
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.sessionId]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    try {
      await sendHumanMessage(session.sessionId, content);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content, createdAt: new Date().toISOString() },
      ]);
      setDraft('');
      onSent();
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Gửi tin thất bại', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Trả lời khách — {session.sessionId.slice(0, 12)}…
        <IconButton onClick={onClose} size="small">
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ height: 420, display: 'flex', flexDirection: 'column' }}>
        <Stack spacing={1.5} sx={{ flexGrow: 1, overflowY: 'auto', py: 1 }}>
          {loadingHistory && <CircularProgress size={20} sx={{ alignSelf: 'center', mt: 4 }} />}
          {!loadingHistory && messages.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
              Chưa có lịch sử
            </Typography>
          )}
          {messages.map((m, idx) => (
            <Stack
              key={`${m.createdAt}-${idx}`}
              direction="row"
              justifyContent={m.role === 'user' ? 'flex-start' : 'flex-end'}
            >
              <Typography
                variant="body2"
                sx={{
                  px: 1.5,
                  py: 1,
                  maxWidth: '80%',
                  borderRadius: 1.5,
                  whiteSpace: 'pre-wrap',
                  bgcolor: m.role === 'user' ? 'action.hover' : 'primary.main',
                  color: m.role === 'user' ? 'text.primary' : 'primary.contrastText',
                }}
              >
                {m.content}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <TextField
          size="small"
          placeholder="Nhập trả lời…"
          fullWidth
          multiline
          maxRows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button variant="contained" onClick={handleSend} disabled={sending || !draft.trim()}>
          Gửi
        </Button>
      </DialogActions>
    </Dialog>
  );
}
