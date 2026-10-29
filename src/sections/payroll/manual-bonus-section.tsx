'use client';

import { useState, useEffect, useCallback } from 'react';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasAllPermissions } from 'src/auth/permissions';
import { voidManualBonus, getManualBonuses, createManualBonus } from 'src/api/payroll';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import type { IManualBonus, IPayrollRecord } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Thưởng nhập tay trong chi tiết phiếu lương: Admin (payroll.bonus-program.manage) nhập số tiền + lý do cho người này trong chu
// kỳ này; cộng cột Thưởng khi tính / tính lại chu kỳ. Phiếu đã chốt thì chỉ xem.
// ----------------------------------------------------------------------

const vnd = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

type Props = {
  record: IPayrollRecord | null;
};

export function ManualBonusSection({ record }: Props) {
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const canManage = hasAllPermissions(user, [PERMISSIONS.payroll.recordsRead, PERMISSIONS.payroll.bonusProgramManage]);
  const editable = !!record?.payrollCycleId && !record.isFinalized && canManage;

  const [bonuses, setBonuses] = useState<IManualBonus[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!record?.payrollCycleId) {
      setBonuses([]);
      return;
    }
    setBonuses(await getManualBonuses(record.id).catch(() => []));
  }, [record]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!record?.payrollCycleId) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      enqueueSnackbar('Số tiền thưởng phải lớn hơn 0', { variant: 'error' });
      return;
    }
    if (!description.trim()) {
      enqueueSnackbar('Ghi lý do thưởng', { variant: 'error' });
      return;
    }
    try {
      setSaving(true);
      await createManualBonus({
        userId: record.userId,
        payrollCycleId: record.payrollCycleId,
        amount: value,
        description: description.trim(),
      });
      enqueueSnackbar('Đã thêm thưởng nhập tay — tính lại lương để áp dụng', { variant: 'success' });
      setOpen(false);
      setAmount('');
      setDescription('');
      await load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Thêm thưởng thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await voidManualBonus(id);
      enqueueSnackbar('Đã huỷ khoản thưởng — tính lại lương để áp dụng', { variant: 'success' });
      await load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Huỷ thưởng thất bại'), { variant: 'error' });
    }
  };

  if (!editable && bonuses.length === 0) return null;

  return (
    <>
      <Stack spacing={0.5} sx={{ mt: 1, p: 1, bgcolor: 'success.lighter', borderRadius: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" fontWeight={700} color="success.dark" sx={{ flexGrow: 1 }}>
            Thưởng nhập tay
          </Typography>
          {editable && (
            <Button
              size="small"
              color="success"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => setOpen(true)}
            >
              Thêm thưởng
            </Button>
          )}
        </Stack>
        {bonuses.map((b) => (
          <Stack key={b.id} direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="caption"
              sx={{ textDecoration: b.voidedAt ? 'line-through' : 'none', flexGrow: 1 }}
              color={b.voidedAt ? 'text.disabled' : 'text.primary'}
            >
              {vnd(b.amount)} — {b.description}
              {b.createdByName ? ` (${b.createdByName})` : ''}
            </Typography>
            {!b.voidedAt && editable && (
              <Button size="small" color="inherit" onClick={() => remove(b.id)}>
                Huỷ
              </Button>
            )}
          </Stack>
        ))}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Thêm thưởng nhập tay</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Số tiền (đ)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputProps={{ min: 0 }}
              autoFocus
            />
            <TextField
              label="Lý do"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={2}
              inputProps={{ maxLength: 500 }}
            />
            <Typography variant="caption" color="text.secondary">
              Cộng vào cột Thưởng của phiếu lương sau khi tính lại.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={saving} onClick={submit}>
            Thêm
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
