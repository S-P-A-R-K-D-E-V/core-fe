import type { IUser } from 'src/types/corecms-api';
import type { IAgentDefinition } from 'src/api/agent-center';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { apiErrorMessage } from 'src/utils/api-error';

import { getAllUsers } from 'src/api/users';
import { useAgentTools, setAgentEnabled } from 'src/api/agent-center';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import EmptyContent from 'src/components/empty-content';

import { shortTokens } from './agent-center-utils';
import AgentDefinitionDialog from './agent-definition-dialog';

// ----------------------------------------------------------------------
// Danh sách agent: ai có agent.approve xem được; agent.manage thêm / sửa / bật tắt (công tắc = nút dừng từng agent).
// ----------------------------------------------------------------------

type Props = {
  agents: IAgentDefinition[];
  loading: boolean;
  error: unknown;
  canManage: boolean;
  onChanged: VoidFunction;
};

export default function AgentListTab({ agents, loading, error, canManage, onChanged }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { tools, loading: toolsLoading } = useAgentTools(canManage);
  const [users, setUsers] = useState<IUser[]>([]);
  const [editing, setEditing] = useState<IAgentDefinition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    getAllUsers()
      .then((list) => setUsers(list.filter((u) => u.status === 'Active')))
      .catch(() => setUsers([]));
  }, [canManage]);

  const openEdit = (agent: IAgentDefinition | null) => {
    setEditing(agent);
    setDialogOpen(true);
  };

  const handleToggle = async (agent: IAgentDefinition) => {
    setBusyId(agent.id);
    try {
      await setAgentEnabled(agent.id, !agent.enabled);
      enqueueSnackbar(
        agent.enabled
          ? `Đã tắt "${agent.name}" — việc đang chạy dừng sau bước hiện tại`
          : `Đã bật "${agent.name}"`
      );
      onChanged();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Đổi trạng thái agent thất bại'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1 }}>
          Mỗi agent chạy bằng một khoá riêng (chế độ Agent tự chạy). Lệnh ghi theo Mức tự chủ ở
          trang Duyệt việc agent.
        </Typography>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => openEdit(null)}
          >
            Thêm agent
          </Button>
        )}
      </Stack>

      {!!error && (
        <Alert severity="error">{apiErrorMessage(error, 'Không tải được danh sách agent')}</Alert>
      )}

      {loading && <Skeleton variant="rounded" height={200} />}

      {!loading && !error && agents.length === 0 && (
        <EmptyContent
          filled
          title="Chưa có agent nào"
          description={
            canManage ? 'Bấm "Thêm agent" để tạo agent đầu tiên.' : 'Chủ cửa hàng chưa tạo agent.'
          }
          sx={{ py: 10 }}
        />
      )}

      {!loading && agents.length > 0 && (
        <Card>
          <TableContainer>
            <Scrollbar>
              <Table sx={{ minWidth: 860 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Agent</TableCell>
                    <TableCell>Model</TableCell>
                    <TableCell align="center">Tool</TableCell>
                    <TableCell>Làm thay cho</TableCell>
                    <TableCell sx={{ width: 200 }}>Token hôm nay</TableCell>
                    <TableCell align="center">Bật</TableCell>
                    {canManage && <TableCell align="right" />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {agents.map((a) => {
                    const budget = a.dailyTokenBudget;
                    const percent = budget
                      ? Math.min(100, Math.round((a.todayTokens / budget) * 100))
                      : 0;
                    return (
                      <TableRow key={a.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                bgcolor: a.enabled ? 'primary.main' : 'grey.500',
                              }}
                            >
                              {(a.name || '?').charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle2">{a.name}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {a.key} · prompt v{a.promptVersion}
                              </Typography>
                              {a.description && (
                                <Typography
                                  variant="caption"
                                  component="div"
                                  sx={{ color: 'text.secondary', maxWidth: 320 }}
                                  noWrap
                                >
                                  {a.description}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontFamily: 'monospace', fontSize: 12 }}
                          >
                            {a.model}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={a.toolNames.join(', ') || 'Không có tool'}>
                            <Label variant="soft">{a.toolNames.length}</Label>
                          </Tooltip>
                        </TableCell>
                        <TableCell>{a.actsForName || '—'}</TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {shortTokens(a.todayTokens)}
                            {budget ? ` / ${shortTokens(budget)}` : ' · không giới hạn'}
                          </Typography>
                          {!!budget && (
                            <LinearProgress
                              variant="determinate"
                              value={percent}
                              color={
                                percent >= 100 ? 'error' : percent >= 80 ? 'warning' : 'primary'
                              }
                              sx={{ mt: 0.5, height: 4, borderRadius: 1 }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {canManage ? (
                            <Switch
                              checked={a.enabled}
                              disabled={busyId === a.id}
                              onChange={() => handleToggle(a)}
                              inputProps={{ 'aria-label': `Bật / tắt ${a.name}` }}
                            />
                          ) : (
                            <Label color={a.enabled ? 'success' : 'default'} variant="soft">
                              {a.enabled ? 'Bật' : 'Tắt'}
                            </Label>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell align="right">
                            <Tooltip title="Sửa">
                              <IconButton onClick={() => openEdit(a)}>
                                <Iconify icon="solar:pen-bold" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        </Card>
      )}

      {canManage && (
        <AgentDefinitionDialog
          open={dialogOpen}
          agent={editing}
          tools={tools}
          toolsLoading={toolsLoading}
          users={users}
          onClose={() => setDialogOpen(false)}
          onSaved={onChanged}
        />
      )}
    </Stack>
  );
}
