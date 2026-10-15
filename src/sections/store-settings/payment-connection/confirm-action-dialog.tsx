'use client';

import { useId } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

// ----------------------------------------------------------------------
// Hộp thoại xác nhận (chữ tiếng Việt) cho thao tác khó hoàn tác: tắt tài khoản / kết nối, tạo lại khoá webhook.
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  title: string;
  content: React.ReactNode;
  confirmLabel: string;
  color?: 'error' | 'warning' | 'primary';
  loading?: boolean;
  onClose: VoidFunction;
  onConfirm: VoidFunction;
};

export default function ConfirmActionDialog({
  open,
  title,
  content,
  confirmLabel,
  color = 'error',
  loading,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId();

  return (
    <Dialog
      fullWidth
      maxWidth="xs"
      open={open}
      onClose={loading ? undefined : onClose}
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent sx={{ typography: 'body2' }}>{content}</DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={loading}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" color={color} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
