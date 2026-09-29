'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useStoreBrand } from 'src/components/branding';
import { useSnackbar } from 'src/components/snackbar';

import {
  type IAgentKey,
  type ICreatedAgentKey,
  listAgentKeys,
  createAgentKey,
  revokeAgentKey,
  getAgentPermissionCatalog,
} from 'src/api/store-settings';

import { McpSessionsCard } from './mcp-sessions-card';
import AgentPermissionPicker from './agent-permission-picker';
import { CodeBlock, McpConnectCard } from './mcp-connect-card';
import { mcpUrl, copyText, mcpPrompt, mcpSnippet, mcpServerName } from './mcp-connect';

// ----------------------------------------------------------------------

const EXPIRY_OPTIONS = [30, 90, 180, 365];

export default function AgentKeysTab() {
  const { enqueueSnackbar } = useSnackbar();
  const { brandName, isCiCi, tenantCode } = useStoreBrand();
  const serverName = mcpServerName(isCiCi, tenantCode);
  // MCP nằm ngay trên tên miền cửa hàng đang mở (<tên miền>/api/mcp). Lấy sau khi mount để không lệch SSR.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const [keys, setKeys] = useState<IAgentKey[]>([]);
  const [catalog, setCatalog] = useState<{ domains: string[]; permissions: string[] }>({
    domains: [],
    permissions: [],
  });

  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ICreatedAgentKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<IAgentKey | null>(null);

  const load = useCallback(() => {
    listAgentKeys()
      .then(setKeys)
      .catch((err) =>
        enqueueSnackbar(apiErrorMessage(err, 'Không tải được danh sách khoá'), { variant: 'error' })
      );
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
    getAgentPermissionCatalog()
      .then(setCatalog)
      .catch(() => {});
  }, [load]);

  const resetForm = () => {
    setName('');
    setPermissions([]);
    setExpiresInDays(90);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await createAgentKey({ name: name.trim(), permissions, expiresInDays });
      setOpenCreate(false);
      resetForm();
      setCreated(res);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Tạo khoá thất bại'), { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const target = revokeTarget;
    setRevokeTarget(null);
    try {
      await revokeAgentKey(target.id);
      enqueueSnackbar(`Đã thu hồi khoá "${target.name}"`);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Thu hồi thất bại'), { variant: 'error' });
    }
  };

  const url = mcpUrl(origin);

  const copy = async (text: string, done: string) => {
    if (await copyText(text)) enqueueSnackbar(done);
    else
      enqueueSnackbar('Không sao chép được — hãy bôi đen và sao chép thủ công', {
        variant: 'warning',
      });
  };

  return (
    <Stack spacing={3}>
      {origin && <McpConnectCard origin={origin} storeName={brandName} serverName={serverName} />}

      <Card>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2.5 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6">Khoá API</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Mỗi khoá gắn với cửa hàng này và chỉ dùng được trong phạm vi quyền đã chọn. Nên dùng
              khoá Chỉ đọc cho agent hỏi đáp.
            </Typography>
          </Stack>
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => setOpenCreate(true)}
          >
            Tạo khoá
          </Button>
        </Stack>

        <TableContainer>
          <Scrollbar>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Tên</TableCell>
                  <TableCell>Khoá</TableCell>
                  <TableCell>Quyền</TableCell>
                  <TableCell>Hết hạn</TableCell>
                  <TableCell>Dùng lần cuối</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id} hover>
                    <TableCell>{k.name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{k.prefix}</TableCell>
                    <TableCell>
                      <Tooltip title={k.permissions.join(', ')}>
                        <span>{k.permissions.length} quyền</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{k.expiresAt ? fDateTime(k.expiresAt) : '—'}</TableCell>
                    <TableCell>{k.lastUsedAt ? fDateTime(k.lastUsedAt) : 'Chưa dùng'}</TableCell>
                    <TableCell>
                      <Label color={k.active ? 'success' : 'default'}>
                        {k.active ? 'Đang dùng' : k.revokedAt ? 'Đã thu hồi' : 'Hết hạn'}
                      </Label>
                    </TableCell>
                    <TableCell align="right">
                      {k.active && (
                        <Tooltip title="Thu hồi">
                          <IconButton color="error" onClick={() => setRevokeTarget(k)}>
                            <Iconify icon="solar:trash-bin-trash-bold" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {keys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Chưa có khoá nào
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>

      <McpSessionsCard />

      {/* Tạo khoá */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="lg">
        <DialogTitle>Tạo khoá API</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Tên khoá"
                sx={{ flex: 1 }}
                placeholder="vd: Claude của chủ cửa hàng"
                value={name}
                inputProps={{ maxLength: 100 }}
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                select
                label="Hạn dùng"
                sx={{ minWidth: 160 }}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
              >
                {EXPIRY_OPTIONS.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d} ngày
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <AgentPermissionPicker
              domains={catalog.domains}
              permissions={catalog.permissions}
              value={permissions}
              onChange={setPermissions}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Huỷ</Button>
          <LoadingButton
            variant="contained"
            loading={creating}
            disabled={!name.trim() || permissions.length === 0}
            onClick={handleCreate}
          >
            Tạo khoá
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Khoá vừa tạo — chỉ hiện 1 lần */}
      <Dialog open={!!created} fullWidth maxWidth="md">
        <DialogTitle>Lưu khoá này ngay</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="warning">
              Khoá chỉ hiển thị một lần. Đóng hộp thoại này là không xem lại được nữa. Không chụp
              màn hình hay dán khoá vào nơi người khác đọc được.
            </Alert>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                value={created?.key ?? ''}
                fullWidth
                size="small"
                InputProps={{ readOnly: true, sx: { fontFamily: 'monospace' } }}
                onFocus={(e) => e.target.select()}
              />
              <Button
                sx={{ flexShrink: 0 }}
                startIcon={<Iconify icon="solar:copy-bold" />}
                onClick={() => created && copy(created.key, 'Đã sao chép khoá')}
              >
                Sao chép khoá
              </Button>
            </Stack>

            {created && origin && (
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2">Kết nối agent bằng khoá này</Typography>
                  <Button
                    size="small"
                    variant="soft"
                    color="primary"
                    startIcon={<Iconify icon="solar:copy-bold" />}
                    onClick={() =>
                      copy(
                        mcpPrompt(brandName, serverName, url, created.key),
                        'Đã sao chép prompt kèm khoá — dán vào Claude Code, Cursor…'
                      )
                    }
                  >
                    Sao chép prompt kèm khoá
                  </Button>
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Dán prompt vào Claude Code, Cursor… để agent tự thêm MCP server {serverName}, hoặc
                  chạy lệnh dưới đây trong terminal (Claude Code).
                </Typography>
                <CodeBlock text={mcpSnippet('claude-code', serverName, url, created.key)} />
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCreated(null)}>
            Tôi đã lưu khoá
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)}>
        <DialogTitle>Thu hồi khoá &quot;{revokeTarget?.name}&quot;?</DialogTitle>
        <DialogContent>Mọi trợ lý đang dùng khoá này sẽ mất quyền truy cập ngay.</DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)}>Huỷ</Button>
          <Button color="error" variant="contained" onClick={handleRevoke}>
            Thu hồi
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
