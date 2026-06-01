'use client';

import { useState, useEffect, useCallback } from 'react';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import type { ISalaryConfigPreviewItem, IVersionedUpsertSalaryConfigRequest } from 'src/types/corecms-api';
import { getSalaryConfigPreview } from 'src/api/payroll';
import { versionedUpsertSalaryConfig } from 'src/api/salary';

// ──────────────────────────────────────────────────────────────────────────

const SALARY_TYPE_LABELS: Record<string, string> = {
  PerShift: 'Theo ca',
  Hourly: 'Theo giờ',
  Monthly: 'Tháng',
};

type EditState = {
  userId: string;
  salaryType: 'PerShift' | 'Hourly' | 'Monthly';
  amount: string;
  probationRate: string;
  note: string;
};

const DEFAULT_EDIT: Omit<EditState, 'userId'> = {
  salaryType: 'Hourly',
  amount: '',
  probationRate: '',
  note: '',
};

// ──────────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  fromDate: string; // yyyy-MM-dd
  onClose: VoidFunction;
  onProceed: VoidFunction; // called when user clicks "Tiếp tục"
};

export default function SalaryConfigPreviewDialog({ open, fromDate, onClose, onProceed }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [items, setItems] = useState<ISalaryConfigPreviewItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Which row is currently being edited (userId → null = none)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPreview = useCallback(async () => {
    if (!fromDate) return;
    setLoading(true);
    try {
      const data = await getSalaryConfigPreview(fromDate);
      // Defensive client-side filter using INCLUSIVE logic: show the item if
      // isStaff is true OR undefined (older BE that doesn't send the field).
      // isStaff === false only when a future BE explicitly marks a non-staff
      // user — in that case we hide them.
      // This mirrors the BE's .Any(ur => ur.Role.Name == "Staff") behavior:
      // a user with Admin+Staff roles still passes (inclusive, not exclusive).
      setItems(data.filter((item) => item.isStaff !== false));
    } catch {
      enqueueSnackbar('Không tải được cấu hình lương', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, enqueueSnackbar]);

  useEffect(() => {
    if (open) fetchPreview();
  }, [open, fetchPreview]);

  const missingCount = items.filter((i) => !i.hasActiveConfig).length;

  const handleStartEdit = (item: ISalaryConfigPreviewItem) => {
    setEditingUserId(item.userId);
    setEditState({
      userId: item.userId,
      salaryType: (item.activeConfig?.salaryType as EditState['salaryType']) ?? 'Hourly',
      amount: item.activeConfig?.amount?.toString() ?? '',
      probationRate: item.activeConfig?.probationRate?.toString() ?? '',
      note: item.activeConfig?.note ?? '',
    });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditState(null);
  };

  const handleSaveEdit = async () => {
    if (!editState) return;
    const amount = parseFloat(editState.amount);
    if (!editState.amount || isNaN(amount) || amount <= 0) {
      enqueueSnackbar('Mức lương phải lớn hơn 0', { variant: 'warning' });
      return;
    }
    const probationRate = editState.probationRate ? parseFloat(editState.probationRate) : undefined;
    if (probationRate !== undefined && (probationRate < 0 || probationRate > 1)) {
      enqueueSnackbar('Hệ số thử việc phải từ 0 đến 1', { variant: 'warning' });
      return;
    }

    try {
      setSaving(true);
      const req: IVersionedUpsertSalaryConfigRequest = {
        userId: editState.userId,
        salaryType: editState.salaryType,
        amount,
        probationRate,
        effectiveFrom: fromDate,
        note: editState.note || undefined,
      };
      await versionedUpsertSalaryConfig(req);
      enqueueSnackbar('Đã lưu cấu hình lương!', { variant: 'success' });
      setEditingUserId(null);
      setEditState(null);
      await fetchPreview(); // refresh list
    } catch {
      enqueueSnackbar('Lưu cấu hình thất bại', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Iconify icon="solar:settings-bold-duotone" width={28} sx={{ color: 'primary.main' }} />
          <Box>
            <Typography variant="h6" lineHeight={1.3}>
              Kiểm tra cấu hình lương
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Áp dụng từ ngày: <strong>{fromDate}</strong>
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : items.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            py={8}
            gap={1.5}
          >
            <Iconify
              icon="solar:users-group-two-rounded-bold-duotone"
              width={56}
              sx={{ color: 'text.disabled' }}
            />
            <Typography variant="subtitle1" color="text.secondary">
              Không có nhân viên nào cần cấu hình lương
            </Typography>
            <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth={320}>
              Tất cả nhân viên (Staff) đã có cấu hình lương hoặc chưa có tài khoản nào với role
              Staff.
            </Typography>
          </Box>
        ) : (
          <>
            {missingCount > 0 && (
              <Alert
                severity="warning"
                sx={{ m: 2, mb: 0 }}
                icon={<Iconify icon="solar:danger-bold" width={20} />}
              >
                <strong>{missingCount} nhân viên</strong> chưa có cấu hình lương hiệu lực. Vui lòng
                bổ sung trước khi tính lương.
              </Alert>
            )}

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nhân viên</TableCell>
                    <TableCell>Loại lương</TableCell>
                    <TableCell align="right">Mức lương</TableCell>
                    <TableCell>Hệ số TV</TableCell>
                    <TableCell>Hiệu lực</TableCell>
                    <TableCell align="center">Trạng thái</TableCell>
                    <TableCell align="center">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <>
                      <TableRow
                        key={item.userId}
                        hover
                        sx={{
                          bgcolor: !item.hasActiveConfig
                            ? (t) => `${t.palette.warning.lighter}22`
                            : undefined,
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                              {item.userName.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2">{item.userName}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {item.activeConfig
                              ? SALARY_TYPE_LABELS[item.activeConfig.salaryType] ?? item.activeConfig.salaryType
                              : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={item.activeConfig ? 600 : 400}>
                            {item.activeConfig
                              ? new Intl.NumberFormat('vi-VN').format(item.activeConfig.amount)
                              : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {item.activeConfig?.probationRate != null
                              ? `${(item.activeConfig.probationRate * 100).toFixed(0)}%`
                              : '100%'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {item.activeConfig ? item.activeConfig.effectiveFrom : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={item.hasActiveConfig ? 'Đã có' : 'Thiếu'}
                            color={item.hasActiveConfig ? 'success' : 'warning'}
                            variant="soft"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title={item.hasActiveConfig ? 'Cập nhật' : 'Thêm cấu hình'}>
                            <IconButton
                              size="small"
                              color={item.hasActiveConfig ? 'default' : 'warning'}
                              onClick={() =>
                                editingUserId === item.userId
                                  ? handleCancelEdit()
                                  : handleStartEdit(item)
                              }
                            >
                              <Iconify
                                icon={
                                  editingUserId === item.userId
                                    ? 'solar:close-circle-bold'
                                    : item.hasActiveConfig
                                    ? 'solar:pen-bold'
                                    : 'solar:add-circle-bold'
                                }
                                width={18}
                              />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>

                      {/* Inline edit row */}
                      <TableRow key={`${item.userId}-edit`}>
                        <TableCell colSpan={7} sx={{ p: 0, borderBottom: 0 }}>
                          <Collapse in={editingUserId === item.userId} unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: 'background.neutral', borderTop: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                                {item.hasActiveConfig
                                  ? `Cập nhật cấu hình — config cũ sẽ được đóng lại (EffectiveTo = ${fromDate} - 1 ngày)`
                                  : 'Thêm cấu hình lương mới'}
                              </Typography>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
                                <TextField
                                  select
                                  label="Loại lương"
                                  size="small"
                                  value={editState?.salaryType ?? 'Hourly'}
                                  onChange={(e) =>
                                    setEditState((s) =>
                                      s ? { ...s, salaryType: e.target.value as EditState['salaryType'] } : s
                                    )
                                  }
                                  sx={{ minWidth: 140 }}
                                >
                                  <MenuItem value="PerShift">Theo ca</MenuItem>
                                  <MenuItem value="Hourly">Theo giờ</MenuItem>
                                  <MenuItem value="Monthly">Tháng</MenuItem>
                                </TextField>

                                <TextField
                                  label="Mức lương"
                                  size="small"
                                  type="number"
                                  value={editState?.amount ?? ''}
                                  onChange={(e) =>
                                    setEditState((s) => s ? { ...s, amount: e.target.value } : s)
                                  }
                                  InputProps={{
                                    endAdornment: <InputAdornment position="end">đ</InputAdornment>,
                                  }}
                                  sx={{ minWidth: 160 }}
                                />

                                <TextField
                                  label="Hệ số thử việc"
                                  size="small"
                                  type="number"
                                  placeholder="0.8"
                                  value={editState?.probationRate ?? ''}
                                  onChange={(e) =>
                                    setEditState((s) => s ? { ...s, probationRate: e.target.value } : s)
                                  }
                                  helperText="Để trống = 100%"
                                  inputProps={{ step: 0.05, min: 0, max: 1 }}
                                  sx={{ minWidth: 160 }}
                                />

                                <TextField
                                  label="Ghi chú"
                                  size="small"
                                  value={editState?.note ?? ''}
                                  onChange={(e) =>
                                    setEditState((s) => s ? { ...s, note: e.target.value } : s)
                                  }
                                  sx={{ flex: 1, minWidth: 200 }}
                                />

                                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ pt: 0.5 }}>
                                  <LoadingButton
                                    variant="contained"
                                    size="small"
                                    loading={saving}
                                    onClick={handleSaveEdit}
                                    startIcon={<Iconify icon="solar:diskette-bold" width={16} />}
                                  >
                                    Lưu
                                  </LoadingButton>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={handleCancelEdit}
                                  >
                                    Huỷ
                                  </Button>
                                </Stack>
                              </Stack>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={onClose} sx={{ mr: 'auto' }}>
          Đóng
        </Button>
        <Button
          variant="contained"
          onClick={onProceed}
          endIcon={<Iconify icon="solar:arrow-right-bold" width={18} />}
        >
          Tiếp tục tính lương
        </Button>
      </DialogActions>
    </Dialog>
  );
}
