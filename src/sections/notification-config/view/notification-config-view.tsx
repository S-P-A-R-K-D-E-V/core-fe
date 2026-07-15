'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useBoolean } from 'src/hooks/use-boolean';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';

import { INotificationConfig, IUser, IRole } from 'src/types/corecms-api';
import {
  getNotificationConfigs,
  createNotificationConfig,
  updateNotificationConfig,
} from 'src/api/checkinFace';
import { getAllUsers } from 'src/api/users';
import { getAllRoles } from 'src/api/roles';
import { sendManualNotification } from 'src/api/notifications';

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

  // Gửi thông báo thủ công — test luồng OpsBridge notification bridge
  const [users, setUsers] = useState<IUser[]>([]);
  const [roles, setRoles] = useState<IRole[]>([]);
  const [manualTargetUsers, setManualTargetUsers] = useState<IUser[]>([]);
  const [manualTargetRoles, setManualTargetRoles] = useState<string[]>([]);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualSending, setManualSending] = useState(false);

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
    getAllUsers()
      .then(setUsers)
      .catch(() => enqueueSnackbar('Không thể tải danh sách người dùng', { variant: 'error' }));
    getAllRoles()
      .then(setRoles)
      .catch(() => enqueueSnackbar('Không thể tải danh sách vai trò', { variant: 'error' }));
  }, [fetchConfigs, enqueueSnackbar]);

  const handleSendManual = async () => {
    const hasTargets = manualTargetUsers.length > 0 || manualTargetRoles.length > 0;
    if (!hasTargets || !manualTitle.trim() || !manualContent.trim()) {
      enqueueSnackbar('Vui lòng chọn người nhận hoặc vai trò, nhập tiêu đề và nội dung', {
        variant: 'warning',
      });
      return;
    }
    setManualSending(true);
    try {
      await sendManualNotification({
        userIds: manualTargetUsers.map((user) => user.id),
        roleNames: manualTargetRoles,
        title: manualTitle.trim(),
        content: manualContent.trim(),
      });
      const targetDescriptions = [
        manualTargetUsers.length > 0 ? `${manualTargetUsers.length} người dùng` : null,
        manualTargetRoles.length > 0 ? `vai trò ${manualTargetRoles.join(', ')}` : null,
      ].filter(Boolean);
      enqueueSnackbar(`Đã gửi thông báo tới ${targetDescriptions.join(' và ')}`);
      setManualTitle('');
      setManualContent('');
    } catch (error) {
      enqueueSnackbar('Gửi thông báo thất bại', { variant: 'error' });
    } finally {
      setManualSending(false);
    }
  };

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

      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Gửi thông báo thủ công (Test)"
          subheader="Giả lập thông báo đẩy tới app CiCi trên điện thoại test — dùng để kiểm tra OpsBridge (Notification Listener) khi chưa có app ngân hàng thật"
        />
        <Stack spacing={2.5} sx={{ p: 3 }}>
          <Autocomplete
            multiple
            fullWidth
            disableCloseOnSelect
            options={users}
            getOptionLabel={(option) => `${option.fullName} - ${option.email}`}
            value={manualTargetUsers}
            onChange={(_, value) => setManualTargetUsers(value)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderOption={(props, option, { selected }) => (
              <li {...props} key={option.id}>
                <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                {option.fullName} - {option.email}
              </li>
            )}
            renderTags={(selected, getTagProps) =>
              selected.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  size="small"
                  label={option.fullName}
                />
              ))
            }
            renderInput={(params) => <TextField {...params} label="Người nhận (theo user)" />}
          />
          <Autocomplete
            multiple
            fullWidth
            disableCloseOnSelect
            options={roles.map((role) => role.name)}
            value={manualTargetRoles}
            onChange={(_, value) => setManualTargetRoles(value)}
            renderOption={(props, option, { selected }) => (
              <li {...props} key={option}>
                <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                {option}
              </li>
            )}
            renderTags={(selected, getTagProps) =>
              selected.map((option, index) => (
                <Chip {...getTagProps({ index })} key={option} size="small" label={option} />
              ))
            }
            renderInput={(params) => <TextField {...params} label="Người nhận (theo vai trò)" />}
          />
          <TextField
            label="Tiêu đề *"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            fullWidth
          />
          <TextField
            label="Nội dung *"
            value={manualContent}
            onChange={(e) => setManualContent(e.target.value)}
            placeholder='VD: TK 1234567890 +500,000VND luc 14:32 08/07/2026. ND: NGUYEN VAN A CHUYEN KHOAN DH0000123'
            helperText="Gõ đúng format thông báo ngân hàng giả định để OpsBridge parse được (số tiền dạng +xxxVND, nội dung sau ND:)"
            multiline
            rows={3}
            fullWidth
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <LoadingButton
              variant="contained"
              loading={manualSending}
              onClick={handleSendManual}
              startIcon={<Iconify icon="solar:bell-bold" />}
            >
              Gửi thông báo
            </LoadingButton>
          </Box>
        </Stack>
      </Card>

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
