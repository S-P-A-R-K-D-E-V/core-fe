'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';

import {
  type IAgentKey,
  listAgentKeys,
  createAgentKey,
  revokeAgentKey,
  getAgentPermissionCatalog,
} from 'src/api/store-settings';

// ----------------------------------------------------------------------

const EXPIRY_OPTIONS = [30, 90, 180, 365];

function domainOf(permission: string, domains: string[]): string {
  return domains.filter((d) => permission.startsWith(`${d}.`)).sort((a, b) => b.length - a.length)[0] ?? 'khác';
}

export default function AgentKeysTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [keys, setKeys] = useState<IAgentKey[]>([]);
  const [catalog, setCatalog] = useState<{ domains: string[]; permissions: string[] }>({ domains: [], permissions: [] });

  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<IAgentKey | null>(null);

  const load = useCallback(() => {
    listAgentKeys()
      .then(setKeys)
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được danh sách khoá'), { variant: 'error' }));
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
    getAgentPermissionCatalog().then(setCatalog).catch(() => {});
  }, [load]);

  const readOnly = useMemo(() => catalog.permissions.filter((p) => /\.read/.test(p)), [catalog.permissions]);

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
      setCreatedKey(res.key);
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

  const copyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      enqueueSnackbar('Đã sao chép khoá');
    } catch {
      enqueueSnackbar('Không sao chép được — hãy bôi đen và sao chép thủ công', { variant: 'warning' });
    }
  };

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Khoá API cho trợ lý AI / MCP (vd Claude, ChatGPT) truy cập dữ liệu <b>của riêng cửa hàng này</b>, chỉ trong
        phạm vi quyền đã chọn. Mỗi khoá gắn với cửa hàng — không dùng được ở cửa hàng khác.
      </Alert>

      <Card>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2.5 }}>
          <Typography variant="h6">Khoá API</Typography>
          <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => setOpenCreate(true)}>
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

      {/* Tạo khoá */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle>Tạo khoá API</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label="Tên khoá"
              placeholder="vd: Claude của chủ cửa hàng"
              value={name}
              inputProps={{ maxLength: 100 }}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField select label="Hạn dùng" value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))}>
              {EXPIRY_OPTIONS.map((d) => (
                <MenuItem key={d} value={d}>
                  {d} ngày
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={catalog.permissions}
              groupBy={(p) => domainOf(p, catalog.domains)}
              value={permissions}
              onChange={(_, value) => setPermissions(value)}
              renderOption={(props, option, { selected }) => (
                <li {...props} key={option}>
                  <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                  {option}
                </li>
              )}
              renderInput={(params) => <TextField {...params} label="Quyền" placeholder="Chọn quyền" />}
              limitTags={4}
            />
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => setPermissions(readOnly)}>
                Chỉ đọc (khuyên dùng)
              </Button>
              <Button size="small" onClick={() => setPermissions([])}>
                Bỏ chọn
              </Button>
            </Stack>
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
      <Dialog open={!!createdKey} fullWidth maxWidth="sm">
        <DialogTitle>Lưu khoá này ngay</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="warning">Khoá chỉ hiển thị một lần. Đóng hộp thoại này là không xem lại được nữa.</Alert>
            <TextField
              value={createdKey ?? ''}
              fullWidth
              InputProps={{ readOnly: true, sx: { fontFamily: 'monospace' } }}
              onFocus={(e) => e.target.select()}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button startIcon={<Iconify icon="solar:copy-bold" />} onClick={copyKey}>
            Sao chép
          </Button>
          <Button variant="contained" onClick={() => setCreatedKey(null)}>
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
