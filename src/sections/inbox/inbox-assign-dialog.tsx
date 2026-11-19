'use client';

import type { IUser } from 'src/types/corecms-api';

import { useState, useEffect } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { getAllUsers } from 'src/api/users';

import { userDisplayName } from 'src/sections/store-settings/agent-key-settings-dialog';

// ----------------------------------------------------------------------
// Giao hội thoại cho một nhân viên (quyền conversation.manage). Giao chưa đổi người giữ — người được giao bấm "Tôi trả lời".

type Props = {
  open: boolean;
  currentUserId: string | null;
  onClose: VoidFunction;
  onAssign: (userId: string | null) => Promise<void>;
};

export default function InboxAssignDialog({ open, currentUserId, onClose, onAssign }: Props) {
  const [users, setUsers] = useState<IUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selected, setSelected] = useState<IUser | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingUsers(true);
    getAllUsers()
      .then((list) => {
        const active = list.filter((u) => u.status === 'Active');
        setUsers(active);
        setSelected(active.find((u) => u.id === currentUserId) ?? null);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, [open, currentUserId]);

  const submit = async (userId: string | null) => {
    setSaving(true);
    try {
      await onAssign(userId);
      onClose();
    } catch {
      // nơi gọi đã báo lỗi
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Giao hội thoại</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Người được giao nhận thông báo và thấy hội thoại ở tab “Của tôi”. Người đang trả lời giữ nguyên tới khi người
          được giao bấm “Tôi trả lời”.
        </Typography>
        <Autocomplete
          options={users}
          loading={loadingUsers}
          value={selected}
          onChange={(_, v) => setSelected(v)}
          getOptionLabel={(u) => userDisplayName(u)}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => <TextField {...params} label="Nhân viên" autoFocus />}
        />
      </DialogContent>
      <DialogActions>
        {currentUserId && (
          <Button color="error" onClick={() => submit(null)} disabled={saving} sx={{ mr: 'auto' }}>
            Bỏ giao
          </Button>
        )}
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Huỷ
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={!selected || selected.id === currentUserId}
          onClick={() => selected && submit(selected.id)}
        >
          Giao
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
