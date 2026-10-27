'use client';

import { useMemo, useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';

import { setAssignmentZoneLead } from 'src/api/attendance';

import { useSnackbar } from 'src/components/snackbar';

import { STORE_ZONE_CODES, type StoreZoneCode, type IShiftAssignment } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Khu phụ trách + trưởng ca của một ca (PUT /shift-assignments/{id}/zone-lead). Một người được nhận nhiều khu; trong ca
// mỗi khu tối đa một người, tối đa một trưởng ca. Lỗi của bảng kiểm tra cửa hàng ở khu nào giao cho người giữ khu đó.

type Row = { zones: StoreZoneCode[]; lead: boolean };

const sameZones = (a: StoreZoneCode[], b: StoreZoneCode[]) =>
  a.length === b.length && a.every((z) => b.includes(z));

const ordered = (zones: StoreZoneCode[]) => STORE_ZONE_CODES.filter((z) => zones.includes(z));

/**
 * Thứ tự gọi API để không vướng ràng buộc "mỗi khu một người": lượt 1 nhả những gì từng dòng bỏ đi (giữ phần chung cũ ∩
 * mới), lượt 2 gán giá trị cuối. Đổi khu A giữa hai người vì vậy không bao giờ bị 409.
 */
export function planZoneSaves(
  assignments: IShiftAssignment[],
  rows: Record<string, Row>
): { id: string; zones: StoreZoneCode[]; lead: boolean }[] {
  const releases: { id: string; zones: StoreZoneCode[]; lead: boolean }[] = [];
  const finals: { id: string; zones: StoreZoneCode[]; lead: boolean }[] = [];
  assignments.forEach((a) => {
    const before: Row = { zones: a.zones ?? [], lead: !!a.isShiftLead };
    const after = rows[a.id] ?? before;
    if (sameZones(before.zones, after.zones) && before.lead === after.lead) return;

    const kept = ordered(before.zones.filter((z) => after.zones.includes(z)));
    const keptLead = before.lead && after.lead;
    if (!sameZones(kept, before.zones) || keptLead !== before.lead) {
      releases.push({ id: a.id, zones: kept, lead: keptLead });
    }
    if (!sameZones(kept, after.zones) || keptLead !== after.lead) {
      finals.push({ id: a.id, zones: ordered(after.zones), lead: after.lead });
    }
  });
  return [...releases, ...finals];
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Ví dụ "Tối (18:00 - 22:30) · 02/11/2026". */
  title: string;
  /** Các phân ca ĐÃ LƯU của ca này. */
  assignments: IShiftAssignment[];
  onSaved: () => void;
};

export function AssignmentZonesDialog({ open, onClose, title, assignments, onSaved }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);

  // Nạp lại khi mở hoặc khi dữ liệu đã lưu đổi (sau khi lưu / tải lại) — không theo từng lần trang cha vẽ lại, để không
  // mất chỗ đang sửa.
  const savedKey = assignments.map((a) => `${a.id}:${(a.zones ?? []).join('')}:${!!a.isShiftLead}`).join('|');
  useEffect(() => {
    if (!open) return;
    setRows(
      Object.fromEntries(
        assignments.map((a) => [a.id, { zones: a.zones ?? [], lead: !!a.isShiftLead }])
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, savedKey]);

  const clashes = useMemo(() => {
    const holders: Partial<Record<StoreZoneCode, number>> = {};
    Object.values(rows).forEach((r) => r.zones.forEach((z) => { holders[z] = (holders[z] ?? 0) + 1; }));
    return STORE_ZONE_CODES.filter((z) => (holders[z] ?? 0) > 1);
  }, [rows]);

  const toggleZone = (id: string, zone: StoreZoneCode) =>
    setRows((prev) => {
      const row = prev[id];
      const zones = row.zones.includes(zone) ? row.zones.filter((z) => z !== zone) : [...row.zones, zone];
      return { ...prev, [id]: { ...row, zones } };
    });

  const setLead = (id: string) =>
    setRows((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([key, row]) => [key, { ...row, lead: key === id ? !row.lead : false }])
      )
    );

  const handleSave = async () => {
    const plan = planZoneSaves(assignments, rows);
    if (!plan.length) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      // Tuần tự: lượt nhả phải xong trước lượt gán.
      // eslint-disable-next-line no-restricted-syntax
      for (const step of plan) {
        // eslint-disable-next-line no-await-in-loop
        await setAssignmentZoneLead(step.id, step.zones, step.lead);
      }
      enqueueSnackbar('Đã lưu khu và trưởng ca', { variant: 'success' });
      onSaved();
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được khu'), { variant: 'error' });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Khu & trưởng ca
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {!assignments.length ? (
          <Typography variant="body2" color="text.secondary">
            Ca này chưa có ai được phân (đã lưu). Lưu phân công trước rồi đặt khu.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {assignments.map((a) => {
              const row = rows[a.id] ?? { zones: [], lead: false };
              return (
                <Stack key={a.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <Typography variant="subtitle2" sx={{ minWidth: 160 }}>
                    {a.staffName}
                  </Typography>
                  <Stack direction="row" spacing={0.75}>
                    {STORE_ZONE_CODES.map((z) => (
                      <Chip
                        key={z}
                        label={z}
                        size="small"
                        clickable
                        color={row.zones.includes(z) ? (clashes.includes(z) ? 'error' : 'primary') : 'default'}
                        variant={row.zones.includes(z) ? 'filled' : 'outlined'}
                        onClick={() => toggleZone(a.id, z)}
                      />
                    ))}
                  </Stack>
                  <FormControlLabel
                    control={<Radio size="small" checked={row.lead} onClick={() => setLead(a.id)} />}
                    label="Trưởng ca"
                    sx={{ ml: { sm: 'auto' } }}
                  />
                </Stack>
              );
            })}
            {clashes.length > 0 && (
              <Alert severity="error">Khu {clashes.join(', ')} đang giao cho hơn một người.</Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Huỷ</Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={!assignments.length || clashes.length > 0}
          onClick={handleSave}
        >
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
