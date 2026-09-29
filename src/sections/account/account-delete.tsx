'use client';

import { useState } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { deleteMyAccount } from 'src/api/store-settings';

// ----------------------------------------------------------------------

const CONFIRM_TEXT = 'XOA';

export default function AccountDelete() {
  const { logout } = useAuthContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setErrorMsg('');
    try {
      await deleteMyAccount();
      try {
        await logout?.();
      } catch {
        // phiên đã bị vô hiệu ở server — bỏ qua lỗi đăng xuất
      }
      router.replace(paths.auth.jwt.login);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Không xoá được tài khoản'));
      setDeleting(false);
    }
  };

  return (
    <Card sx={{ p: 3, mt: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ color: 'error.main' }}>
          Xoá tài khoản
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Xoá vĩnh viễn thông tin đăng nhập, số điện thoại, địa chỉ, tài khoản ngân hàng, ảnh CCCD, dữ liệu khuôn mặt và
          liên kết Google/Apple. Họ tên vẫn được giữ trên bảng công, bảng lương và hoá đơn đã phát sinh vì cửa hàng phải
          lưu chứng từ. Không thể hoàn tác.
        </Typography>
        <Stack direction="row" justifyContent="flex-end">
          <Button color="error" variant="outlined" onClick={() => setOpen(true)}>
            Xoá tài khoản của tôi
          </Button>
        </Stack>
      </Stack>

      <Dialog open={open} onClose={() => !deleting && setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Xoá tài khoản?</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {!!errorMsg && <Alert severity="error">{errorMsg}</Alert>}
            <Typography variant="body2">
              Gõ <b>{CONFIRM_TEXT}</b> để xác nhận.
            </Typography>
            <TextField autoFocus value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setOpen(false)}>
            Huỷ
          </Button>
          <LoadingButton
            color="error"
            variant="contained"
            loading={deleting}
            disabled={confirm.trim().toUpperCase() !== CONFIRM_TEXT}
            onClick={handleDelete}
          >
            Xoá vĩnh viễn
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
