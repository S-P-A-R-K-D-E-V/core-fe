import { DialogProps } from '@mui/material/Dialog';

// ----------------------------------------------------------------------

export type ConfirmDialogProps = Omit<DialogProps, 'title' | 'content'> & {
  title: React.ReactNode;
  content?: React.ReactNode;
  action: React.ReactNode;
  onClose: VoidFunction;
  /** Chữ nút đóng; mặc định "Cancel" (giữ như cũ cho các chỗ đang dùng) */
  cancelText?: React.ReactNode;
};
