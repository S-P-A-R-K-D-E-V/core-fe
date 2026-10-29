'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getShiftSchedulesByDateRange } from 'src/api/attendance';
import { shortTime, useActiveHrRules } from 'src/api/hr-rules';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import {
  getSupportShifts,
  claimSupportShift,
  cancelSupportShift,
  createSupportShift,
  reviewSupportClaim,
  withdrawSupportClaim,
} from 'src/api/hr';
import {
  SUPPORT_CLAIM_STATUS_LABEL,
  SUPPORT_OPENING_STATUS_LABEL,
  type ISupportShiftClaim,
  type ISupportShiftOpening,
} from 'src/types/hr';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import type { IShiftSchedule } from 'src/types/corecms-api';

import { fVnd } from 'src/sections/hr/hr-common';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

// ----------------------------------------------------------------------
// Ca hỗ trợ mở trên chợ ca (C11). Quản lý (shift.assignment.manage) đăng một lịch ca phụ vào một ngày, cần bao nhiêu
// người; ai cũng nhận được; duyệt = ca vào lịch người nhận. Giờ muộn nhất và số ca / tháng theo Cấu hình luật của cửa hàng.
// ----------------------------------------------------------------------

const CLAIM_COLOR: Record<ISupportShiftClaim['status'], 'warning' | 'success' | 'default' | 'error'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'error',
  Withdrawn: 'default',
};

const hhmm = (t: string) => t.slice(0, 5);

const todayStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

function payText(o: ISupportShiftOpening) {
  if (!o.fixedHourlyRate) return 'Trả theo lương giờ của người làm';
  const min = o.minimumPaidHours ? ` · trả tối thiểu ${o.minimumPaidHours} giờ` : '';
  return `${fVnd(o.fixedHourlyRate)}/giờ${min}`;
}

// ── Đăng ca hỗ trợ ──────────────────────────────────────────────────────

function CreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const latestEnd = shortTime(useActiveHrRules()?.supportShiftLatestEnd) || null;
  const { enqueueSnackbar } = useSnackbar();
  const [date, setDate] = useState(todayStr());
  const [schedules, setSchedules] = useState<IShiftSchedule[]>([]);
  const [scheduleId, setScheduleId] = useState('');
  const [slots, setSlots] = useState(1);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !date) return;
    setLoading(true);
    getShiftSchedulesByDateRange(date, date)
      .then((list) => {
        const extra = list.filter((s) => s.templateType === 'Extra' && s.isActive);
        setSchedules(extra);
        setScheduleId((current) => (extra.some((s) => s.id === current) ? current : (extra[0]?.id ?? '')));
      })
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được lịch ca'), { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [open, date, enqueueSnackbar]);

  const selected = schedules.find((s) => s.id === scheduleId);
  const overnight = !!selected && selected.endTime <= selected.startTime;
  const tooLate = !!selected && (overnight || (latestEnd != null && hhmm(selected.endTime) > latestEnd));

  const submit = async () => {
    setSaving(true);
    try {
      await createSupportShift({ shiftScheduleId: scheduleId, date, slots, note: note.trim() || null });
      enqueueSnackbar('Đã đăng ca hỗ trợ — mọi người nhận được thông báo');
      setNote('');
      onCreated();
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không đăng được ca hỗ trợ'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Đăng ca hỗ trợ</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            type="date"
            label="Ngày"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: todayStr() }}
          />
          <TextField
            select
            label="Lịch ca phụ"
            value={scheduleId}
            onChange={(e) => setScheduleId(e.target.value)}
            disabled={loading || schedules.length === 0}
            helperText={
              loading
                ? 'Đang tải…'
                : schedules.length === 0
                  ? 'Ngày này chưa có lịch của mẫu ca phụ — tạo mẫu ca loại "Ca phụ" và lịch ca trước.'
                  : 'Giờ vào / ra lấy theo lịch ca. Đơn giá đặt ở mẫu ca.'
            }
          >
            {schedules.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.templateName} · {hhmm(s.startTime)}–{hhmm(s.endTime)}
              </MenuItem>
            ))}
          </TextField>
          {tooLate ? (
            <Alert severity="error">
              {overnight ? 'Ca hỗ trợ phải kết thúc trong ngày.' : `Ca hỗ trợ không được kéo sau ${latestEnd}.`}
            </Alert>
          ) : null}
          <TextField
            type="number"
            label="Số người cần"
            value={slots}
            onChange={(e) => setSlots(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            inputProps={{ min: 1, max: 10 }}
          />
          <TextField
            label="Ghi chú (khu cần người, lý do…)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
        <LoadingButton variant="contained" loading={saving} disabled={!scheduleId || tooLate} onClick={submit}>
          Đăng lên chợ ca
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ── Thẻ ca hỗ trợ ───────────────────────────────────────────────────────

export function SupportShiftsCard() {
  const { user } = useAuthContext();
  const canManage = hasPermission(user, PERMISSIONS.shift.assignmentManage);
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();

  const [list, setList] = useState<ISupportShiftOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [rejecting, setRejecting] = useState<ISupportShiftClaim | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    try {
      setList(await getSupportShifts());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được ca hỗ trợ'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  // Nhân viên chỉ cần thấy ca còn nhận người hoặc ca mình đã nhận; quản lý thấy cả ca đã đủ / đã huỷ trong 14 ngày.
  const visible = useMemo(
    () => (canManage ? list : list.filter((o) => o.status === 'Open' || o.claims.length > 0)),
    [list, canManage]
  );

  const run = async (key: string, action: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(key);
    try {
      await action();
      enqueueSnackbar(done);
      await load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, failed), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (o: ISupportShiftOpening) => {
    const ok = await confirm({
      title: 'Huỷ ca hỗ trợ?',
      content: 'Đơn nhận đang chờ sẽ bị từ chối. Người đã được duyệt vẫn giữ ca trong lịch (gỡ ở trang xếp ca nếu cần).',
      confirmText: 'Huỷ ca',
      destructive: true,
    });
    if (ok) await run(o.id, () => cancelSupportShift(o.id), 'Đã huỷ ca hỗ trợ', 'Không huỷ được');
  };

  const reject = async () => {
    if (!rejecting) return;
    const claim = rejecting;
    setRejecting(null);
    await run(claim.id, () => reviewSupportClaim(claim.id, false, rejectNote.trim()), 'Đã từ chối', 'Không từ chối được');
    setRejectNote('');
  };

  if (!loading && visible.length === 0 && !canManage) return null;

  return (
    <Card sx={{ mb: 2.5 }}>
      {confirmDialog}
      <CardHeader
        title="Ca hỗ trợ"
        subheader="Quản lý đăng khi đông khách — ai rảnh thì nhận, được duyệt là ca vào lịch. Tối đa 10 ca hỗ trợ / tháng."
        action={
          canManage ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => setCreating(true)}
            >
              Đăng ca hỗ trợ
            </Button>
          ) : null
        }
      />
      <Box sx={{ p: 2.5, pt: 1.5 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={24} />
          </Stack>
        ) : visible.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Chưa có ca hỗ trợ nào trong 14 ngày tới.
          </Typography>
        ) : (
          <Stack spacing={1.5} divider={<Divider flexItem />}>
            {visible.map((o) => {
              const mine = o.claims.find((c) => c.staffId === user?.id);
              const myActive = mine && (mine.status === 'Pending' || mine.status === 'Approved');
              return (
                <Stack key={o.id} spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle2">
                      {o.shiftName} · {hhmm(o.startTime)}–{hhmm(o.endTime)} · {fDate(o.date)}
                    </Typography>
                    <Chip
                      size="small"
                      variant="soft"
                      color={o.status === 'Open' ? 'info' : o.status === 'Filled' ? 'success' : 'default'}
                      label={`${SUPPORT_OPENING_STATUS_LABEL[o.status]} · ${o.approvedCount}/${o.slots} người`}
                    />
                    {mine ? (
                      <Chip size="small" color={CLAIM_COLOR[mine.status]} label={`Bạn: ${SUPPORT_CLAIM_STATUS_LABEL[mine.status]}`} />
                    ) : null}
                    <Box sx={{ flexGrow: 1 }} />
                    {o.status === 'Open' && !myActive ? (
                      <LoadingButton
                        size="small"
                        variant="contained"
                        loading={busy === o.id}
                        onClick={() => run(o.id, () => claimSupportShift(o.id), 'Đã nhận — chờ quản lý duyệt', 'Không nhận được ca')}
                      >
                        Nhận ca
                      </LoadingButton>
                    ) : null}
                    {mine?.status === 'Pending' ? (
                      <LoadingButton
                        size="small"
                        color="inherit"
                        loading={busy === mine.id}
                        onClick={() => run(mine.id, () => withdrawSupportClaim(mine.id), 'Đã rút đơn', 'Không rút được')}
                      >
                        Rút
                      </LoadingButton>
                    ) : null}
                    {canManage && o.status === 'Open' ? (
                      <Button size="small" color="error" disabled={busy === o.id} onClick={() => cancel(o)}>
                        Huỷ ca
                      </Button>
                    ) : null}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {payText(o)}
                    {o.note ? ` · ${o.note}` : ''}
                    {mine?.reviewNote ? ` · Ghi chú duyệt: ${mine.reviewNote}` : ''}
                  </Typography>
                  {canManage && o.claims.length > 0 ? (
                    <Stack spacing={0.75} sx={{ pl: 1 }}>
                      {o.claims.map((c) => (
                        <Stack key={c.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="body2">{c.staffName}</Typography>
                          <Chip size="small" variant="outlined" color={CLAIM_COLOR[c.status]} label={SUPPORT_CLAIM_STATUS_LABEL[c.status]} />
                          {c.reviewNote ? (
                            <Typography variant="caption" color="text.secondary">
                              {c.reviewNote}
                            </Typography>
                          ) : null}
                          {c.status === 'Pending' && o.status === 'Open' ? (
                            <>
                              <Box sx={{ flexGrow: 1 }} />
                              <LoadingButton
                                size="small"
                                variant="contained"
                                color="success"
                                loading={busy === c.id}
                                onClick={() =>
                                  run(c.id, () => reviewSupportClaim(c.id, true), 'Đã duyệt — ca đã vào lịch', 'Không duyệt được')
                                }
                              >
                                Duyệt
                              </LoadingButton>
                              <Button size="small" color="inherit" disabled={busy === c.id} onClick={() => setRejecting(c)}>
                                Từ chối
                              </Button>
                            </>
                          ) : null}
                        </Stack>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>

      {canManage ? <CreateDialog open={creating} onClose={() => setCreating(false)} onCreated={load} /> : null}

      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} fullWidth maxWidth="xs">
        <DialogTitle>Từ chối {rejecting?.staffName}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Lý do"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            sx={{ mt: 1 }}
            inputProps={{ maxLength: 500 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>Đóng</Button>
          <Button variant="contained" color="error" disabled={!rejectNote.trim()} onClick={reject}>
            Từ chối
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
