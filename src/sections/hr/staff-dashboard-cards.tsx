'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { getMySchedule } from 'src/api/attendance';
import { getMyQuarterBonus } from 'src/api/quarter-bonus';
import { getMyWorkTasks, getMyViolations, getMyWeeklyBonus, complainViolation, getMyCurrentEstimate } from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';

import { WORK_TASK_STATUS_LABEL } from 'src/types/hr';

import type { IWorkTask, IMyViolations, IMyWeeklyBonus, IViolationEntry, ICurrentPayrollEstimate } from 'src/types/hr';
import type { IMyQuarterBonus, QuarterBonusStatus } from 'src/types/quarter-bonus';
import type { IShiftAssignment } from 'src/types/corecms-api';

import { fVnd, monthStart } from './hr-common';

// ----------------------------------------------------------------------
// Các thẻ trên trang tổng quan của nhân viên: ca sắp tới, việc của tuần, target tuần của cửa hàng, điểm trừ tháng, thưởng quý, phiếu
// lương tạm tính. Tiền quy đổi từ điểm trừ chỉ để nhân viên thấy mức độ, không bao giờ trừ vào lương.
// ----------------------------------------------------------------------

const isoDay = (d: Date) => fDate(d, 'yyyy-MM-dd') as string;

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function Row({ label, value, strong, note }: { label: string; value: string; strong?: boolean; note?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Box>
        <Typography variant="body2" color={strong ? 'text.primary' : 'text.secondary'}>
          {label}
        </Typography>
        {note && (
          <Typography variant="caption" color="text.secondary">
            {note}
          </Typography>
        )}
      </Box>
      <Typography variant={strong ? 'subtitle1' : 'body2'} sx={{ whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {children}
    </Typography>
  );
}

/** Tải dữ liệu một thẻ; lỗi hiện ngay trong thẻ để các thẻ khác vẫn dùng được. */
function useCardData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    load()
      .then((value) => {
        setData(value);
        setError('');
      })
      .catch((err) => setError(apiErrorMessage(err, 'Không tải được dữ liệu')));
  }, [load]);

  useEffect(reload, [reload]);

  return { data, error, reload };
}

function DashCard({ title, action, error, children }: { title: string; action?: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <Card sx={{ height: 1 }}>
      <CardHeader title={title} action={action} titleTypographyProps={{ variant: 'subtitle1' }} sx={{ pb: 0 }} />
      <CardContent>{error ? <Typography variant="body2" color="error">{error}</Typography> : children}</CardContent>
    </Card>
  );
}

const loadShifts = () => {
  const today = new Date();
  return getMySchedule(isoDay(today), isoDay(addDays(today, 7)));
};

function UpcomingShiftsCard() {
  const { data, error } = useCardData<IShiftAssignment[]>(loadShifts);
  const shifts = (data ?? []).filter((s) => !s.hasCheckedOut).slice(0, 5);

  return (
    <DashCard title="Ca sắp tới" error={error}>
      {shifts.length === 0 ? (
        <Empty>{data ? 'Không có ca trong 7 ngày tới.' : 'Đang tải…'}</Empty>
      ) : (
        <Stack spacing={1}>
          {shifts.map((s) => (
            <Row
              key={s.id}
              label={`${fDate(s.date, 'EEE dd/MM')}, ${s.scheduleName ?? s.shiftName ?? 'Ca'}`}
              value={`${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`}
            />
          ))}
        </Stack>
      )}
    </DashCard>
  );
}

const loadTasks = () => getMyWorkTasks();

function WeeklyTasksCard() {
  const { data, error } = useCardData<IWorkTask[]>(loadTasks);
  const weekEnd = isoDay(addDays(new Date(), 7));
  const tasks = (data ?? [])
    .filter((t) => (t.status === 'Assigned' || t.status === 'Rejected') && (!t.dueAt || t.dueAt.slice(0, 10) <= weekEnd))
    .sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'))
    .slice(0, 5);

  return (
    <DashCard
      title="Nhiệm vụ tuần"
      error={error}
      action={
        <Link href={paths.dashboard.hr.tasks} variant="caption" sx={{ pr: 1 }}>
          Xem tất cả
        </Link>
      }
    >
      {tasks.length === 0 ? (
        <Empty>{data ? 'Không có việc cần làm trong tuần.' : 'Đang tải…'}</Empty>
      ) : (
        <Stack spacing={1}>
          {tasks.map((t) => (
            <Row
              key={t.id}
              label={t.title}
              note={WORK_TASK_STATUS_LABEL[t.status]}
              value={t.dueAt ? `Hạn ${fDate(t.dueAt, 'dd/MM')}` : 'Không hạn'}
            />
          ))}
        </Stack>
      )}
    </DashCard>
  );
}

const loadWeekly = () => {
  const today = isoDay(new Date());
  return getMyWeeklyBonus(today, today);
};

function StoreTargetCard() {
  const { data, error } = useCardData<IMyWeeklyBonus[]>(loadWeekly);
  const week = data?.[0];

  return (
    <DashCard title="Target tuần cửa hàng" error={error}>
      {!week ? (
        <Empty>{data ? 'Tuần này chưa có target.' : 'Đang tải…'}</Empty>
      ) : (
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="h5">{week.achievementPct}%</Typography>
            <Typography variant="caption" color="text.secondary">
              đạt target, tuần từ {fDate(week.weekStart, 'dd/MM')}
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={Math.min(100, week.achievementPct)} sx={{ height: 6, borderRadius: 1 }} />
          <Row label="Quỹ tạm tính" value={fVnd(week.fund)} />
          <Row label="Phần của tôi ước tính" value={fVnd(week.myAmount)} note={`${week.myHours}/${week.totalHours} giờ`} />
          {!week.paidInPayroll && (
            <Typography variant="caption" color="text.secondary">
              Tuần này chỉ tính thử, chưa vào lương.
            </Typography>
          )}
        </Stack>
      )}
    </DashCard>
  );
}

const loadViolations = () => getMyViolations(monthStart());

function ViolationPointsCard() {
  const { enqueueSnackbar } = useSnackbar();
  const { data, error, reload } = useCardData<IMyViolations>(loadViolations);
  const [complaining, setComplaining] = useState<IViolationEntry | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const points = data?.summary.points ?? 0;
  const marks = [data?.policy?.halfBonusFromPoints, data?.policy?.noBonusFromPoints, data?.policy?.notCompleteFromPoints].filter(
    (m): m is number => m != null
  );
  const max = Math.max(marks[marks.length - 1] ?? 15, points);
  const today = isoDay(new Date());

  const send = async () => {
    if (!complaining) return;
    setBusy(true);
    try {
      await complainViolation(complaining.id, text.trim());
      enqueueSnackbar('Đã gửi khiếu nại, quản lý sẽ trả lời');
      setComplaining(null);
      setText('');
      reload();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không gửi được khiếu nại'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashCard title="Điểm trừ tháng" error={error}>
      <Stack spacing={1.5}>
        <Typography variant="h5">{points} điểm</Typography>
        <Box sx={{ position: 'relative', pb: 2.5 }}>
          <LinearProgress
            variant="determinate"
            color={points >= (marks[1] ?? Infinity) ? 'error' : points >= (marks[0] ?? Infinity) ? 'warning' : 'primary'}
            value={max > 0 ? Math.min(100, (points / max) * 100) : 0}
            sx={{ height: 6, borderRadius: 1 }}
          />
          {marks.map((m) => (
            <Box key={m} sx={{ position: 'absolute', top: 0, left: `${(m / max) * 100}%`, transform: 'translateX(-1px)' }}>
              <Box sx={{ width: 2, height: 10, bgcolor: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', transform: 'translateX(-50%)' }}>
                {m}
              </Typography>
            </Box>
          ))}
        </Box>
        {(data?.entries ?? []).length === 0 ? (
          <Empty>{data ? 'Tháng này chưa có lỗi nào.' : 'Đang tải…'}</Empty>
        ) : (
          (data?.entries ?? []).slice(0, 5).map((e) => (
            <Stack key={e.id} direction="row" spacing={1} justifyContent="space-between" alignItems="center">
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {e.ruleName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {fDate(e.occurredOn, 'dd/MM')} · {e.points} điểm{e.status === 'Disputed' ? ' · đang khiếu nại' : ''}
                  {e.status === 'Cancelled' ? ' · đã huỷ' : ''}
                </Typography>
              </Box>
              {e.status === 'Active' && !e.complainedAt && (!e.complaintDeadline || e.complaintDeadline >= today) && (
                <Button size="small" color="warning" onClick={() => setComplaining(e)} sx={{ flexShrink: 0 }}>
                  Khiếu nại
                </Button>
              )}
            </Stack>
          ))
        )}
      </Stack>

      <Dialog open={!!complaining} onClose={() => setComplaining(null)} fullWidth maxWidth="xs">
        <DialogTitle>Khiếu nại lần ghi nhận</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {complaining?.ruleName}, ngày {complaining ? fDate(complaining.occurredOn, 'dd/MM') : ''}, trừ {complaining?.points} điểm.
          </Typography>
          <TextField fullWidth required multiline minRows={3} label="Lý do khiếu nại" value={text} onChange={(e) => setText(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setComplaining(null)}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={busy} disabled={!text.trim()} onClick={send}>
            Gửi khiếu nại
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </DashCard>
  );
}

const QUARTER_STATUS: Record<QuarterBonusStatus, { label: string; color: 'success' | 'warning' | 'error' }> = {
  Eligible: { label: 'Đủ', color: 'success' },
  AtRisk: { label: 'Rủi ro', color: 'warning' },
  Lost: { label: 'Mất', color: 'error' },
};

function QuarterBonusCard() {
  const { data, error } = useCardData<IMyQuarterBonus | null>(getMyQuarterBonus);

  return (
    <DashCard
      title="Thưởng quý"
      error={error}
      action={data ? <Chip size="small" color={QUARTER_STATUS[data.status].color} label={QUARTER_STATUS[data.status].label} sx={{ mr: 1 }} /> : undefined}
    >
      {!data ? (
        <Empty>{data === null ? 'Chưa có kết quả thưởng quý.' : 'Đang tải…'}</Empty>
      ) : (
        <Stack spacing={1}>
          <Row label="Giờ đã làm / ngưỡng" value={`${data.hours} / ${data.minHours}`} note={`Tính từ ${fDate(data.windowStart, 'dd/MM')}`} />
          <LinearProgress
            variant="determinate"
            value={data.minHours > 0 ? Math.min(100, (data.hours / data.minHours) * 100) : 0}
            sx={{ height: 6, borderRadius: 1 }}
          />
          <Row label="Điểm trừ cao nhất trong tháng" value={`${data.maxMonthlyPoints} (mất từ ${data.monthlyPointsLimit})`} />
          <Row label="Mức dự kiến" value={fVnd(data.expectedAmount)} strong />
          {data.reasons.map((r) => (
            <Typography key={r} variant="caption" color="text.secondary">
              {r}
            </Typography>
          ))}
        </Stack>
      )}
    </DashCard>
  );
}

const loadEstimate = async () => {
  const [estimate, violations] = await Promise.all([getMyCurrentEstimate(), getMyViolations(monthStart()).catch(() => null)]);
  return { estimate, simulated: violations?.summary.simulatedAmount ?? 0 };
};

function PayslipEstimateCard() {
  const { data, error } = useCardData<{ estimate: ICurrentPayrollEstimate; simulated: number }>(loadEstimate);
  const estimate = data?.estimate;

  return (
    <DashCard
      title="Phiếu lương tạm tính"
      error={error}
      action={
        <Link href={paths.dashboard.payroll.myPayroll} variant="caption" sx={{ pr: 1 }}>
          Xem phiếu lương
        </Link>
      }
    >
      {!estimate ? (
        <Empty>Đang tải…</Empty>
      ) : !estimate.configured ? (
        <Empty>Chưa có cấu hình lương.</Empty>
      ) : (
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            Từ {fDate(estimate.fromDate, 'dd/MM')} đến {fDate(estimate.asOf, 'dd/MM')} · {estimate.hoursWorked} giờ
          </Typography>
          <Row label="Lương" value={fVnd(estimate.baseSalary)} />
          <Row label="Phụ cấp, làm hộ" value={fVnd(estimate.overtimeSalary)} />
          <Row label="Thưởng" value={fVnd(estimate.bonus)} />
          {estimate.deduction > 0 && <Row label="Khấu trừ" value={`−${fVnd(estimate.deduction)}`} />}
          <Row label="Tạm tính" value={fVnd(estimate.estimatedSalary)} strong />
          {data.simulated > 0 && (
            <Row label="Quy đổi điểm trừ (mô phỏng – không trừ)" value={fVnd(data.simulated)} note="Chỉ để thấy mức độ, không trừ vào lương." />
          )}
        </Stack>
      )}
    </DashCard>
  );
}

export function StaffDashboardCards() {
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' } }}>
      <UpcomingShiftsCard />
      <WeeklyTasksCard />
      <StoreTargetCard />
      <ViolationPointsCard />
      <QuarterBonusCard />
      <PayslipEstimateCard />
    </Box>
  );
}
