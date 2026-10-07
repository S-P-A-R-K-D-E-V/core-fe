'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';

import { useSnackbar } from 'src/components/snackbar';

import { IBranchLocation } from 'src/types/corecms-api';

import { getBranchLocations } from 'src/api/attendance';
import { getUserBranches, setUserBranches } from 'src/api/users';

// ----------------------------------------------------------------------
// Phân công chi nhánh làm việc (PUT /users/{id}/branches). Không chọn chi nhánh nào = làm mọi chi nhánh (như trước
// khi có phân công). Nhân viên được phân công một chi nhánh thì app tự khoá vào chi nhánh đó; máy chủ chặn bán hàng
// và F&B ở chi nhánh khác. Admin luôn làm mọi chi nhánh nên không mở hộp này cho Admin.
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
  userId: string;
  userName: string;
  onSaved?: VoidFunction;
};

export default function UserBranchesDialog({ open, onClose, userId, userName, onSaved }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [branches, setBranches] = useState<IBranchLocation[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    Promise.all([getBranchLocations(), getUserBranches(userId)])
      .then(([list, scope]) => {
        if (cancelled) return;
        // Chỉ chi nhánh đang hoạt động mới phân công được (BE trả 409 với chi nhánh đã tắt).
        setBranches(list.filter((b) => b.isActive !== false));
        setSelected(scope.allBranches ? [] : scope.branchIds);
      })
      .catch((error) => {
        if (!cancelled) enqueueSnackbar(apiErrorMessage(error, 'Không tải được chi nhánh'), { variant: 'error' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId, enqueueSnackbar]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSave = async () => {
    setSaving(true);
    try {
      await setUserBranches(userId, selected);
      enqueueSnackbar('Đã lưu chi nhánh làm việc');
      onSaved?.();
      onClose();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lưu được chi nhánh'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <DialogTitle>Chi nhánh làm việc</DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>{userName}</strong> chỉ bán hàng, gọi món và chấm công ở các chi nhánh được chọn. Không chọn chi nhánh
          nào = làm ở mọi chi nhánh.
        </Alert>

        {loading ? (
          <Typography variant="body2" sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
            Đang tải...
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {branches.map((branch) => (
              <FormControlLabel
                key={branch.id}
                label={branch.branchName}
                control={<Checkbox checked={selected.includes(branch.id)} onChange={() => toggle(branch.id)} />}
              />
            ))}
            {branches.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Cửa hàng chưa có chi nhánh đang hoạt động.
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={loading} onClick={handleSave}>
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
