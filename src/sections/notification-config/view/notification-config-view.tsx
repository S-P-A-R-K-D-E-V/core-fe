'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { useBoolean } from 'src/hooks/use-boolean';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';

import { INotificationConfig } from 'src/types/corecms-api';
import {
  getNotificationConfigs,
  createNotificationConfig,
  updateNotificationConfig,
} from 'src/api/checkinFace';

// ----------------------------------------------------------------------

export default function NotificationConfigView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const createDialog = useBoolean();
  const editDialog = useBoolean();

  const [configs, setConfigs] = useState<INotificationConfig[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [formType, setFormType] = useState<string>('telegram');
  const [formToken, setFormToken] = useState('');
  const [formChatId, setFormChatId] = useState('');
  const [formName, setFormName] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationConfigs();
      setConfigs(data);
    } catch (error) {
      enqueueSnackbar('Không thể tải cấu hình thông báo', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const resetForm = () => {
    setFormType('telegram');
    setFormToken('');
    setFormChatId('');
    setFormName('');
    setFormIsActive(true);
    setEditingId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    createDialog.onTrue();
  };

  const handleOpenEdit = (config: INotificationConfig) => {
    setEditingId(config.id);
    setFormType(config.type);
    setFormToken(config.token);
    setFormChatId(config.chatId);
    setFormName(config.name || '');
    setFormIsActive(config.isActive);
    editDialog.onTrue();
  };

  const handleCreate = async () => {
    if (!formToken || !formChatId) {
      enqueueSnackbar('Vui lòng nhập Token và Chat ID', { variant: 'warning' });
      return;
    }
    try {
      await createNotificationConfig({
        type: formType,
        token: formToken,
        chatId: formChatId,
        name: formName || undefined,
        isActive: formIsActive,
      });
      enqueueSnackbar('Tạo cấu hình thành công');
      createDialog.onFalse();
      resetForm();
      await fetchConfigs();
    } catch (error) {
      enqueueSnackbar('Tạo cấu hình thất bại', { variant: 'error' });
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      await updateNotificationConfig(editingId, {
        token: formToken || undefined,
        chatId: formChatId || undefined,
        name: formName || undefined,
        isActive: formIsActive,
      });
      enqueueSnackbar('Cập nhật thành công');
      editDialog.onFalse();
      resetForm();
      await fetchConfigs();
    } catch (error) {
      enqueueSnackbar('Cập nhật thất bại', { variant: 'error' });
    }
  };

  const handleToggleActive = async (config: INotificationConfig) => {
    try {
      await updateNotificationConfig(config.id, { isActive: !config.isActive });
      await fetchConfigs();
    } catch (error) {
      enqueueSnackbar('Cập nhật thất bại', { variant: 'error' });
    }
  };

  const renderForm = (isEdit: boolean) => (
    <Stack spacing={2.5} sx={{ pt: 1 }}>
      {!isEdit && (
        <TextField
          select
          label="Loại"
          value={formType}
          onChange={(e) => setFormType(e.target.value)}
          fullWidth
        >
          <MenuItem value="telegram">Telegram</MenuItem>
          <MenuItem value="zalo">Zalo OA</MenuItem>
        </TextField>
      )}
      <TextField
        label="Tên gợi nhớ"
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
        placeholder="VD: Bot thông báo quầy"
        fullWidth
      />
      <TextField
        label="Bot Token *"
        value={formToken}
        onChange={(e) => setFormToken(e.target.value)}
        placeholder={formType === 'telegram' ? 'VD: 123456:ABC-DEF...' : 'Zalo OA Token'}
        fullWidth
      />
      <TextField
        label="Chat ID *"
        value={formChatId}
        onChange={(e) => setFormChatId(e.target.value)}
        placeholder={formType === 'telegram' ? 'VD: -1001234567890' : 'Zalo User ID'}
        fullWidth
      />
      <Stack direction="row" alignItems="center" spacing={1}>
        <Switch checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} />
        <Typography variant="body2">Kích hoạt</Typography>
      </Stack>
    </Stack>
  );

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Cấu hình thông báo"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Cấu hình thông báo' },
        ]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={handleOpenCreate}
          >
            Thêm cấu hình
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <TableContainer sx={{ overflow: 'unset' }}>
          <Table size="medium" sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Loại</TableCell>
                <TableCell>Chat ID</TableCell>
                <TableCell>Token</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id} hover>
                  <TableCell>{config.name || '—'}</TableCell>
                  <TableCell>
                    <Label color={config.type === 'telegram' ? 'info' : 'primary'}>
                      {config.type === 'telegram' ? '🤖 Telegram' : '💬 Zalo'}
                    </Label>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {config.chatId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', maxWidth: 200 }} noWrap>
                      {config.token.slice(0, 15)}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={config.isActive}
                      onChange={() => handleToggleActive(config)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenEdit(config)}>
                      <Iconify icon="solar:pen-bold" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {configs.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Chưa có cấu hình thông báo nào
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialog.value} onClose={createDialog.onFalse} maxWidth="sm" fullWidth>
        <DialogTitle>Thêm cấu hình thông báo</DialogTitle>
        <DialogContent>{renderForm(false)}</DialogContent>
        <DialogActions>
          <Button onClick={createDialog.onFalse} color="inherit">
            Hủy
          </Button>
          <Button onClick={handleCreate} variant="contained">
            Tạo
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog.value} onClose={editDialog.onFalse} maxWidth="sm" fullWidth>
        <DialogTitle>Chỉnh sửa cấu hình</DialogTitle>
        <DialogContent>{renderForm(true)}</DialogContent>
        <DialogActions>
          <Button onClick={editDialog.onFalse} color="inherit">
            Hủy
          </Button>
          <Button onClick={handleUpdate} variant="contained">
            Cập nhật
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
