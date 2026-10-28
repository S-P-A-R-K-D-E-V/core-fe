'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';


import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getMySchedule } from 'src/api/attendance';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import {
  cancelShiftLeave,
  createShiftLeave,
  getShiftLeaves,
  getMyShiftLeaves,
  reviewShiftLeave,
  getPendingShiftLeaves,
} from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IShiftAssignment } from 'src/types/corecms-api';
import type { IShiftLeave, ShiftLeaveStatus } from 'src/types/hr';
import { SHIFT_LEAVE_STATUS_LABEL } from 'src/types/hr';

import { useActiveHrRules } from 'src/api/hr-rules';

import { monthEnd, MonthField, monthStart } from '../hr-common';

// ----------------------------------------------------------------------
// Xin nghỉ ca đã xếp: báo trước theo cấu hình cửa hàng (Cấu hình luật; trống = không yêu cầu), trừ khẩn cấp có lý do; phải được
// duyệt. Duyệt = ca được gỡ khỏi lịch, không tính vắng. Quyền duyệt shift.leave.review (tạm thời chỉ Admin).
// ----------------------------------------------------------------------

type TabKey = 'mine' | 'pending' | 'all';

const STATUS_COLOR: Record<ShiftLeaveStatus, 'warning' | 'success' | 'error' | 'default'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'error',
  Cancelled: 'default',
};


function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Số giờ còn tới giờ vào ca (giờ máy = giờ Việt Nam). */
export function hoursUntil(date: string, startTime: string, now: Date = new Date()): number {
  const start = new Date(`${date}T${startTime.slice(0, 5)}:00`);
  return (start.getTime() - now.getTime()) / 3_600_000;
}

export default function HrLeaveView({ initialTab }: { initialTab?: string }) {
  const settings = useSettingsContext();
  const noticeHours = useActiveHrRules()?.leaveMinNoticeHours ?? null;
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const canReview = hasPermission(user, PERMISSIONS.shift.leaveReview);

  const [tab, setTab] = useState<TabKey>(
    initialTab === 'mine' || !canReview ? 'mine' : 'pending'
  );
  const [rows, setRows] = useState<IShiftLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(monthStart());

  const [createOpen, setCreateOpen] = useState(false);
  const [review, setReview] = useState<{ leave: IShiftLeave; approve: boolean } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'mine') setRows(await getMyShiftLeaves());
      else if (tab === 'pending') setRows(await getPendingShiftLeaves());
      else setRows(await getShiftLeaves({ from: month, to: monthEnd(month) }));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được đơn xin nghỉ'), { variant: 'error' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, month, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (leave: IShiftLeave) => {
    setBusy(true);
    try {
      await cancelShiftLeave(leave.id);
      enqueueSnackbar('Đã huỷ đơn');
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không huỷ được đơn'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    if (!review) return;
    setBusy(true);
    try {
      await reviewShiftLeave(review.leave.id, review.approve, reviewNote.trim());
      enqueueSnackbar(review.approve ? 'Đã duyệt — ca đã gỡ khỏi lịch' : 'Đã từ chối');
      setReview(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không xử lý được đơn'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Xin nghỉ ca"
        links={[{ name: 'Nhân sự' }, { name: 'Xin nghỉ ca' }]}
        action={
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            Xin nghỉ ca
          </Button>
        }
        sx={{ mb: 2 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {noticeHours
          ? `Xin nghỉ một ca đã xếp phải báo trước ít nhất ${noticeHours} giờ. Ốm đau hoặc việc gia đình khẩn cấp thì đánh dấu "Khẩn cấp" và ghi rõ lý do. `
          : ''}
        Đơn được duyệt thì ca được gỡ khỏi lịch, không tính vắng.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="mine" label="Đơn của tôi" />
        {canReview && <Tab value="pending" label="Chờ duyệt" />}
        {canReview && <Tab value="all" label="Tất cả" />}
      </Tabs>

      {tab === 'all' && (
        <Stack direction="row" sx={{ mb: 2 }}>
          <MonthField value={month} onChange={setMonth} />
        </Stack>
      )}

      <Card>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            {tab === 'pending' ? 'Không có đơn chờ duyệt.' : 'Chưa có đơn nào.'}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {tab !== 'mine' && <TableCell>Nhân viên</TableCell>}
                  <TableCell>Ca</TableCell>
                  <TableCell>Lý do</TableCell>
                  <TableCell>Gửi lúc</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((l) => (
                  <TableRow key={l.id} hover>
                    {tab !== 'mine' && <TableCell>{l.staffName}</TableCell>}
                    <TableCell>
                      <Typography variant="subtitle2">
                        {l.shiftName} · {fDate(l.shiftDate, 'EEE dd/MM')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {l.startTime.slice(0, 5)}–{l.endTime.slice(0, 5)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography variant="body2">{l.reason}</Typography>
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                        {l.isEmergency && <Chip size="small" color="error" variant="outlined" label="Khẩn cấp" />}
                        {l.isLateNotice && <Chip size="small" color="warning" variant="outlined" label="Báo dưới 24 giờ" />}
                      </Stack>
                      {l.reviewNote && (
                        <Typography variant="caption" color="text.secondary">
                          Ghi chú duyệt: {l.reviewNote}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{fDateTime(l.createdAt, 'dd/MM HH:mm')}</TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS_COLOR[l.status]} label={SHIFT_LEAVE_STATUS_LABEL[l.status]} />
                    </TableCell>
                    <TableCell align="right">
                      {tab === 'mine' && l.status === 'Pending' && (
                        <Button size="small" color="inherit" disabled={busy} onClick={() => cancel(l)}>
                          Huỷ đơn
                        </Button>
                      )}
                      {tab !== 'mine' && canReview && l.status === 'Pending' && (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              setReview({ leave: l, approve: false });
                              setReviewNote('');
                            }}
                          >
                            Từ chối
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              setReview({ leave: l, approve: true });
                              setReviewNote('');
                            }}
                          >
                            Duyệt
                          </Button>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <CreateLeaveDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setTab('mine');
          load();
        }}
      />

      <Dialog open={!!review} onClose={() => !busy && setReview(null)} fullWidth maxWidth="xs">
        <DialogTitle>{review?.approve ? 'Duyệt đơn xin nghỉ' : 'Từ chối đơn xin nghỉ'}</DialogTitle>
        <DialogContent>
          {review && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2">
                {review.leave.staffName} · {review.leave.shiftName} {fDate(review.leave.shiftDate, 'dd/MM')}
              </Typography>
              {review.approve && (
                <Alert severity="info">Ca sẽ được gỡ khỏi lịch của nhân viên. Nhớ xếp người khác nếu ca thiếu người.</Alert>
              )}
              <TextField
                label={review.approve ? 'Ghi chú (tuỳ chọn)' : 'Lý do từ chối'}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                multiline
                minRows={2}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReview(null)} disabled={busy}>
            Đóng
          </Button>
          <LoadingButton
            variant="contained"
            color={review?.approve ? 'primary' : 'error'}
            loading={busy}
            disabled={!review?.approve && !reviewNote.trim()}
            onClick={submitReview}
          >
            {review?.approve ? 'Duyệt' : 'Từ chối'}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

// ----------------------------------------------------------------------

function CreateLeaveDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const noticeHours = useActiveHrRules()?.leaveMinNoticeHours ?? null;
  const { enqueueSnackbar } = useSnackbar();
  const [shifts, setShifts] = useState<IShiftAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignmentId, setAssignmentId] = useState('');
  const [reason, setReason] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAssignmentId('');
    setReason('');
    setEmergency(false);
    setLoading(true);
    const today = new Date();
    const to = new Date(today);
    to.setDate(to.getDate() + 45);
    getMySchedule(toIsoDate(today), toIsoDate(to))
      .then((list) =>
        setShifts(
          list
            .filter((s) => !s.hasCheckedIn && hoursUntil(s.date, s.startTime) > 0)
            .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
        )
      )
      .catch(() => setShifts([]))
      .finally(() => setLoading(false));
  }, [open]);

  const selected = useMemo(() => shifts.find((s) => (s.assignmentId || s.id) === assignmentId), [shifts, assignmentId]);
  const lateNotice = !!selected && noticeHours != null && hoursUntil(selected.date, selected.startTime) < noticeHours;

  const save = async () => {
    setSaving(true);
    try {
      await createShiftLeave({ shiftAssignmentId: assignmentId, reason: reason.trim(), isEmergency: emergency });
      enqueueSnackbar('Đã gửi đơn — chờ duyệt');
      onCreated();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không gửi được đơn'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Xin nghỉ ca</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {loading ? (
            <CircularProgress size={24} />
          ) : shifts.length === 0 ? (
            <Alert severity="info">Bạn không có ca nào sắp tới trong 45 ngày.</Alert>
          ) : (
            <TextField select label="Ca muốn nghỉ" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
              {shifts.map((s) => (
                <MenuItem key={s.assignmentId || s.id} value={s.assignmentId || s.id}>
                  {s.scheduleName} · {fDate(s.date, 'EEE dd/MM')} · {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                </MenuItem>
              ))}
            </TextField>
          )}
          {lateNotice && (
            <Alert severity="warning">
              Còn dưới {noticeHours} giờ tới giờ ca. Chỉ xin được khi ốm đau hoặc việc gia đình khẩn cấp — đánh dấu &quot;Khẩn cấp&quot; và
              ghi rõ lý do.
            </Alert>
          )}
          <TextField label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} />
          <FormControlLabel
            control={<Checkbox checked={emergency} onChange={(e) => setEmergency(e.target.checked)} />}
            label="Khẩn cấp (ốm đau, việc gia đình)"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={!assignmentId || !reason.trim() || (lateNotice && !emergency)}
          onClick={save}
        >
          Gửi đơn
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
