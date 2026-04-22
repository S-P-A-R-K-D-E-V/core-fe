'use client';

import { useState } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { createGroupConversation, openPrivateConversation } from 'src/api/messenger';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void | Promise<void>;
};

export default function NewConversationDialog({ open, onClose, onCreated }: Props) {
  const [mode, setMode] = useState<'private' | 'group'>('private');
  const [otherUserId, setOtherUserId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setOtherUserId('');
    setGroupName('');
    setGroupMembers('');
    setError(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'private') {
        if (!otherUserId.trim()) throw new Error('Nhập UserId của đối phương');
        const conv = await openPrivateConversation(otherUserId.trim());
        await onCreated(conv.id);
      } else {
        const members = groupMembers
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (members.length < 1) throw new Error('Thêm ít nhất 1 thành viên khác');
        const conv = await createGroupConversation(groupName.trim() || null, members);
        await onCreated(conv.id);
      }
      reset();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Lỗi không xác định');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Tạo hội thoại mới</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <ToggleButtonGroup
            exclusive
            value={mode}
            onChange={(_, v) => v && setMode(v)}
            size="small"
          >
            <ToggleButton value="private">Chat 1:1</ToggleButton>
            <ToggleButton value="group">Nhóm</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'private' ? (
            <TextField
              label="UserId đối phương"
              fullWidth
              value={otherUserId}
              onChange={(e) => setOtherUserId(e.target.value)}
              helperText="Nhập UUID của người dùng"
            />
          ) : (
            <>
              <TextField
                label="Tên nhóm (tuỳ chọn)"
                fullWidth
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <TextField
                label="UserId các thành viên"
                fullWidth
                multiline
                rows={3}
                value={groupMembers}
                onChange={(e) => setGroupMembers(e.target.value)}
                helperText="Phân tách bằng dấu phẩy hoặc xuống dòng"
              />
            </>
          )}

          {error && (
            <div style={{ color: 'crimson', fontSize: 13 }}>{error}</div>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Huỷ</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          Tạo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
