'use client';

import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { addStaff } from 'src/api/users';

import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
  onAdded: VoidFunction;
};

const EMPTY = { email: '', firstName: '', lastName: '', role: 'Staff', password: '' };

/**
 * Thêm người vào cửa hàng. Email đã có tài khoản (kể cả tài khoản chỉ đăng nhập Google/Apple) thì
 * chỉ được thêm vào cửa hàng — mật khẩu nhập ở đây bị bỏ qua. Manager chỉ thêm được nhân viên.
 */
export default function UserAddStaffDialog({ open, onClose, onAdded }: Props) {
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isAdmin = user?.role === 'Admin' || (user?.roles ?? []).includes('Admin');

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleClose = () => {
    if (saving) return;
    setForm(EMPTY);
    setErrorMsg('');
    onClose();
  };

  const handleSubmit = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await addStaff({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        role: form.role as 'Staff' | 'Manager' | 'Admin',
        password: form.password || undefined,
      });
      enqueueSnackbar(
        res.existingAccount
          ? 'Đã thêm tài khoản có sẵn vào cửa hàng (giữ nguyên mật khẩu của họ).'
          : 'Đã tạo tài khoản. Gửi email và mật khẩu tạm cho nhân viên.'
      );
      setForm(EMPTY);
      onAdded();
      onClose();
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Không thêm được nhân viên'));
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.email.trim() && form.firstName.trim() && form.lastName.trim();

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Thêm nhân viên</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {!!errorMsg && <Alert severity="error">{errorMsg}</Alert>}
          <TextField label="Email" type="email" value={form.email} onChange={set('email')} autoFocus />
          <Stack direction="row" spacing={2}>
            <TextField label="Họ" value={form.lastName} onChange={set('lastName')} fullWidth />
            <TextField label="Tên" value={form.firstName} onChange={set('firstName')} fullWidth />
          </Stack>
          <TextField select label="Vai trò" value={form.role} onChange={set('role')}>
            <MenuItem value="Staff">Nhân viên</MenuItem>
            <MenuItem value="Manager" disabled={!isAdmin}>
              Quản lý
            </MenuItem>
            <MenuItem value="Admin" disabled={!isAdmin}>
              Admin
            </MenuItem>
          </TextField>
          <TextField
            label="Mật khẩu tạm (tối thiểu 8 ký tự)"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Nếu email đã có tài khoản (hoặc người đó đăng nhập bằng Google/Apple), họ được thêm vào cửa hàng
            và giữ nguyên cách đăng nhập hiện tại — mật khẩu tạm bị bỏ qua.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!canSubmit} onClick={handleSubmit}>
          Thêm
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
