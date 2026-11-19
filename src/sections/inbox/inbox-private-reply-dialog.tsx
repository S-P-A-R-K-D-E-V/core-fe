'use client';

import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { MESSAGE_MAX_LENGTH } from 'src/lib/inbox';

// ----------------------------------------------------------------------
// Hội thoại bình luận: nhắn riêng Messenger cho người bình luận (POST conversations/{id}/private-reply). Facebook chỉ cho
// nhắn riêng 1 lần cho mỗi bình luận, trong 7 ngày — lỗi 409 do nơi gọi báo; dialog giữ nguyên nội dung để sửa / huỷ.

type Props = {
  open: boolean;
  customerName: string;
  onClose: VoidFunction;
  /** Ném lỗi = giữ dialog mở. */
  onSend: (text: string) => Promise<void>;
};

export default function InboxPrivateReplyDialog({ open, customerName, onClose, onSend }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  const trimmed = text.trim();
  const tooLong = text.length > MESSAGE_MAX_LENGTH;

  const handleSend = async () => {
    if (!trimmed || tooLong || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      onClose();
    } catch {
      // Nơi gọi đã báo lỗi; giữ nội dung.
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Nhắn riêng cho {customerName || 'khách'}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Gửi một tin Messenger riêng cho người bình luận (khách không phải nhắn trước). Facebook chỉ cho nhắn riêng 1 lần cho
          mỗi bình luận, trong 7 ngày kể từ lúc bình luận.
        </Alert>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          maxRows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ví dụ: Shop gửi bạn giá và ảnh mẫu qua tin nhắn nhé…"
          error={tooLong}
          helperText={tooLong ? `Tối đa ${MESSAGE_MAX_LENGTH} ký tự (${text.length})` : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={sending}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={sending} disabled={!trimmed || tooLong} onClick={handleSend}>
          Gửi nhắn riêng
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
