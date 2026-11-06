'use client';

import QRCode from 'qrcode';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getBranchLocations } from 'src/api/attendance';
import { IBranchLocation } from 'src/types/corecms-api';
import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';
import {
  StaffInvite,
  StaffInviteRole,
  staffInviteUrl,
  listStaffInvites,
  createStaffInvite,
  revokeStaffInvite,
  STAFF_INVITE_ROLE_LABEL,
  STAFF_INVITE_STATUS_LABEL,
} from 'src/api/staff-invites';

import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
};

const EXPIRY_OPTIONS = [
  { hours: 24, label: '1 ngày' },
  { hours: 72, label: '3 ngày' },
  { hours: 168, label: '7 ngày' },
];

const EMPTY = { role: 'Staff' as StaffInviteRole, email: '', note: '', expiresInHours: 72, branchIds: [] as string[] };

const STATUS_COLOR = {
  Pending: 'info',
  Accepted: 'success',
  Revoked: 'default',
  Expired: 'warning',
} as const;

/**
 * Mời nhân viên bằng link: chọn vai trò (+ chi nhánh, email nếu muốn khoá), nhận link + mã QR gửi qua Zalo/Messenger.
 * Người nhận mở link, đăng nhập Google/Apple (hoặc đang đăng nhập sẵn) rồi bấm nhận là thành nhân viên. Link dùng
 * một lần, có hạn, thu hồi được ở tab "Đã tạo".
 */
export default function UserInviteDialog({ open, onClose }: Props) {
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const isAdmin = user?.role === 'Admin' || (user?.roles ?? []).includes('Admin');

  const [tab, setTab] = useState<'create' | 'list'>('create');
  const [form, setForm] = useState(EMPTY);
  const [branches, setBranches] = useState<IBranchLocation[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [created, setCreated] = useState<{ url: string; qr: string; invite: StaffInvite } | null>(null);

  const [invites, setInvites] = useState<StaffInvite[] | null>(null);
  const [listError, setListError] = useState('');

  useEffect(() => {
    if (!open) return;
    getBranchLocations()
      .then((list) => setBranches(list.filter((b) => b.isActive !== false)))
      .catch(() => setBranches([]));
  }, [open]);

  const loadInvites = useCallback(async () => {
    setListError('');
    try {
      setInvites(await listStaffInvites());
    } catch (err) {
      setListError(apiErrorMessage(err, 'Không tải được danh sách link mời'));
    }
  }, []);

  useEffect(() => {
    if (open && tab === 'list') loadInvites();
  }, [open, tab, loadInvites]);

  const handleClose = () => {
    if (saving) return;
    setForm(EMPTY);
    setCreated(null);
    setErrorMsg('');
    setTab('create');
    onClose();
  };

  const toggleBranch = (id: string) =>
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id) ? f.branchIds.filter((b) => b !== id) : [...f.branchIds, id],
    }));

  const handleCreate = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await createStaffInvite({
        role: form.role,
        branchIds: form.branchIds,
        email: form.email.trim() || undefined,
        note: form.note.trim() || undefined,
        expiresInHours: form.expiresInHours,
      });
      const url = staffInviteUrl(res.token);
      const qr = await QRCode.toDataURL(url, { width: 240, margin: 1 });
      setCreated({ url, qr, invite: res.invite });
      setInvites(null);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Không tạo được link mời'));
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      enqueueSnackbar('Đã chép link mời');
    } catch {
      enqueueSnackbar('Không chép được — giữ để chọn rồi chép tay', { variant: 'warning' });
    }
  };

  const share = async (url: string) => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'Lời mời làm nhân viên', text: 'Mở link để nhận lời mời làm nhân viên cửa hàng', url });
        return;
      } catch {
        // người dùng huỷ chia sẻ
        return;
      }
    }
    await copy(url);
  };

  const handleRevoke = async (invite: StaffInvite) => {
    if (
      !(await confirm({
        title: 'Thu hồi link mời',
        content: `Link ${invite.note ? `"${invite.note}" ` : ''}sẽ không dùng được nữa. Thu hồi?`,
        confirmText: 'Thu hồi',
        destructive: true,
      }))
    )
      return;
    try {
      await revokeStaffInvite(invite.id);
      enqueueSnackbar('Đã thu hồi link');
      loadInvites();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không thu hồi được'), { variant: 'error' });
    }
  };

  const branchName = (id: string) => branches.find((b) => b.id === id)?.branchName ?? 'Chi nhánh đã xoá';

  const renderCreate = created ? (
    <Stack spacing={2} alignItems="center" sx={{ pt: 1 }}>
      <Alert severity="success" sx={{ width: 1 }}>
        Đã tạo link mời {STAFF_INVITE_ROLE_LABEL[created.invite.role].toLowerCase()} — dùng được một lần, hết hạn{' '}
        {fDateTime(created.invite.expiresAt)}. Link chỉ hiện lần này, hãy gửi ngay.
      </Alert>
      <Box component="img" src={created.qr} alt="Mã QR link mời" sx={{ width: 200, height: 200 }} />
      <TextField
        value={created.url}
        fullWidth
        size="small"
        InputProps={{ readOnly: true }}
        onFocus={(e) => e.target.select()}
      />
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={() => copy(created.url)}>
          Chép link
        </Button>
        <Button variant="outlined" onClick={() => share(created.url)}>
          Chia sẻ
        </Button>
        <Button
          onClick={() => {
            setCreated(null);
            setForm(EMPTY);
          }}
        >
          Tạo link khác
        </Button>
      </Stack>
      <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        Người nhận mở link, đăng nhập bằng Google/Apple rồi bấm nhận. Sau đó mở app S Store, đăng nhập cùng tài khoản
        là vào thẳng cửa hàng.
      </Typography>
    </Stack>
  ) : (
    <Stack spacing={2} sx={{ pt: 1 }}>
      {!!errorMsg && <Alert severity="error">{errorMsg}</Alert>}
      <TextField
        select
        label="Vai trò"
        value={form.role}
        onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffInviteRole }))}
      >
        <MenuItem value="Staff">Nhân viên</MenuItem>
        <MenuItem value="Manager" disabled={!isAdmin}>
          Quản lý
        </MenuItem>
      </TextField>
      <TextField
        select
        label="Hạn dùng"
        value={form.expiresInHours}
        onChange={(e) => setForm((f) => ({ ...f, expiresInHours: Number(e.target.value) }))}
      >
        {EXPIRY_OPTIONS.map((o) => (
          <MenuItem key={o.hours} value={o.hours}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Ghi chú (vd tên người được mời)"
        value={form.note}
        onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        inputProps={{ maxLength: 200 }}
      />
      <TextField
        label="Chỉ cho email này nhận (không bắt buộc)"
        type="email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        helperText="Để trống: ai mở link trước sẽ nhận. Apple 'ẩn email' sẽ không khớp."
      />
      {branches.length > 1 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Chi nhánh làm việc
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
            Không chọn = làm mọi chi nhánh.
          </Typography>
          <Stack>
            {branches.map((b) => (
              <FormControlLabel
                key={b.id}
                label={b.branchName}
                control={<Checkbox checked={form.branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} />}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );

  const renderList = (
    <Stack spacing={1.5} sx={{ pt: 1 }}>
      {!!listError && <Alert severity="error">{listError}</Alert>}
      {invites === null && !listError && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      {invites?.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
          Chưa có link mời nào trong 30 ngày qua.
        </Typography>
      )}
      {invites?.map((invite, idx) => (
        <Box key={invite.id}>
          {idx > 0 && <Divider sx={{ mb: 1.5 }} />}
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="subtitle2">{invite.note || STAFF_INVITE_ROLE_LABEL[invite.role]}</Typography>
                <Chip size="small" label={STAFF_INVITE_STATUS_LABEL[invite.status]} color={STATUS_COLOR[invite.status]} />
                {invite.note && <Chip size="small" variant="outlined" label={STAFF_INVITE_ROLE_LABEL[invite.role]} />}
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Tạo {fDateTime(invite.createdAt)}
                {invite.createdByName ? ` bởi ${invite.createdByName}` : ''}
                {invite.status === 'Pending' ? ` · hết hạn ${fDateTime(invite.expiresAt)}` : ''}
              </Typography>
              {invite.email && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Chỉ cho: {invite.email}
                </Typography>
              )}
              {invite.branchIds.length > 0 && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Chi nhánh: {invite.branchIds.map(branchName).join(', ')}
                </Typography>
              )}
              {invite.acceptedBy && (
                <Typography variant="caption">
                  Đã nhận: {invite.acceptedBy.name || invite.acceptedBy.email} ({invite.acceptedBy.email})
                  {invite.acceptedAt ? ` · ${fDateTime(invite.acceptedAt)}` : ''}
                </Typography>
              )}
            </Stack>
            {invite.status === 'Pending' && (isAdmin || invite.role === 'Staff') && (
              <Button size="small" color="error" onClick={() => handleRevoke(invite)}>
                Thu hồi
              </Button>
            )}
          </Stack>
        </Box>
      ))}
    </Stack>
  );

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 0 }}>Mời nhân viên bằng link</DialogTitle>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3 }}>
          <Tab value="create" label="Tạo link" />
          <Tab value="list" label="Đã tạo" />
        </Tabs>
        <DialogContent>{tab === 'create' ? renderCreate : renderList}</DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={saving}>
            Đóng
          </Button>
          {tab === 'create' && !created && (
            <LoadingButton variant="contained" loading={saving} onClick={handleCreate}>
              Tạo link
            </LoadingButton>
          )}
        </DialogActions>
      </Dialog>
      {confirmDialog}
    </>
  );
}
