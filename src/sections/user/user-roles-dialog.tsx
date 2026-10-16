'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';

import { useSnackbar } from 'src/components/snackbar';

import type { IRole, ICustomRole } from 'src/types/corecms-api';

import { getAllRoles, assignRoles } from 'src/api/roles';
import {
  getCustomRoles,
  SYSTEM_ROLE_LABELS,
  setUserCustomRoles,
  getUserRoleAssignment,
} from 'src/api/custom-roles';

// ----------------------------------------------------------------------
// Gán vai trò cho một người ở cửa hàng hiện tại: vai trò hệ thống (/roles/assign) + vai trò tuỳ chỉnh
// (/custom-roles/users/{id}). Đọc vai trò ĐƯỢC GÁN từ /custom-roles/users/{id} — danh sách vai trò trong token / GET /users
// có cả vai trò gốc của vai trò tuỳ chỉnh, đọc từ đó là lưu nhầm vai trò gốc thành vai trò hệ thống.
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
  userId: string;
  userName: string;
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export default function UserRolesDialog({ open, onClose, userId, userName }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const { user } = useAuthContext();

  // Core-be chặn Admin tự gỡ Admin của chính mình (có thể là Admin cuối cùng) — khoá luôn ô đó trên giao diện.
  const isSelf = !!user?.id && user.id === userId;

  const [systemRoles, setSystemRoles] = useState<IRole[]>([]);
  const [customRoles, setCustomRoles] = useState<ICustomRole[]>([]);
  const [initialSystem, setInitialSystem] = useState<string[]>([]);
  const [initialCustom, setInitialCustom] = useState<string[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string[]>([]);
  const [selectedCustom, setSelectedCustom] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [roles, custom, assignment] = await Promise.all([
          getAllRoles(),
          getCustomRoles(),
          getUserRoleAssignment(userId),
        ]);
        setSystemRoles(roles);
        setCustomRoles(custom);

        const systemIds = roles.filter((r) => assignment.systemRoles.includes(r.name)).map((r) => r.id);
        setInitialSystem(systemIds);
        setSelectedSystem(systemIds);
        setInitialCustom(assignment.customRoleIds);
        setSelectedCustom(assignment.customRoleIds);
      } catch (error) {
        enqueueSnackbar(apiErrorMessage(error, 'Không tải được vai trò'), { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, userId, enqueueSnackbar]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Hai lệnh riêng: lệnh nào không đổi thì không gửi (mỗi lệnh có thể buộc người đó đăng nhập lại).
      if (!sameSet(selectedSystem, initialSystem)) await assignRoles({ userId, roleIds: selectedSystem });
      if (!sameSet(selectedCustom, initialCustom)) await setUserCustomRoles(userId, selectedCustom);
      enqueueSnackbar('Đã cập nhật vai trò');
      onClose();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không gán được vai trò'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (role: IRole) => SYSTEM_ROLE_LABELS[role.name] ?? role.name;

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <DialogTitle>Vai trò của {userName}</DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Typography variant="body2" sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
            Đang tải…
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Vai trò hệ thống
            </Typography>
            {systemRoles.map((role) => (
              <FormControlLabel
                key={role.id}
                label={
                  <Box>
                    <Typography variant="subtitle2">{roleLabel(role)}</Typography>
                    {role.description && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {role.description}
                      </Typography>
                    )}
                  </Box>
                }
                control={
                  <Checkbox
                    checked={selectedSystem.includes(role.id)}
                    onChange={() => setSelectedSystem((prev) => toggle(prev, role.id))}
                    disabled={isSelf && role.name === 'Admin' && selectedSystem.includes(role.id)}
                  />
                }
              />
            ))}

            <Divider sx={{ my: 1 }} />

            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Vai trò tuỳ chỉnh
            </Typography>
            {customRoles.map((role) => (
              <FormControlLabel
                key={role.id}
                label={
                  <Box>
                    <Typography variant="subtitle2">{role.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Gốc: {SYSTEM_ROLE_LABELS[role.baseRole] ?? role.baseRole} · {role.permissions.length} quyền
                    </Typography>
                  </Box>
                }
                control={
                  <Checkbox
                    checked={selectedCustom.includes(role.id)}
                    onChange={() => setSelectedCustom((prev) => toggle(prev, role.id))}
                  />
                }
              />
            ))}
            {customRoles.length === 0 && (
              <Alert severity="info">Cửa hàng chưa có vai trò tuỳ chỉnh — tạo trong mục Vai trò.</Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Huỷ
        </Button>

        <LoadingButton variant="contained" loading={saving} disabled={loading} onClick={handleSave}>
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
