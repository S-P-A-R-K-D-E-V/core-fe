'use client';

import { format } from 'date-fns';
import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
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
import ToggleButton from '@mui/material/ToggleButton';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getActiveStaffUsers } from 'src/api/users';
import { getAllShiftTemplates } from 'src/api/attendance';
import { createCleaningTaskTemplate } from 'src/api/cleaning';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import { getWorkTasks, assignWorkTask, cancelWorkTask } from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IWorkTask, WorkTaskStatus } from 'src/types/hr';
import { WORK_TASK_STATUS_LABEL } from 'src/types/hr';
import type { CleaningShiftBlock } from 'src/types/corecms-api';

import { MonthField, monthStart } from 'src/sections/hr/hr-common';

import { TASK_STATUS_COLOR, ReviewTaskDialog } from '../assigned-tasks';

// ----------------------------------------------------------------------
// Giao việc: cho một người (work-tasks, cần hr.task.manage — người đó nộp kèm ảnh, duyệt ở danh sách dưới) hoặc cho cả ca
// một ngày (đầu việc theo ca chỉ áp dụng đúng ngày đó, cần cleaning.template.manage — ai làm ca đó thấy trong Việc của tôi,
// chấm ở Chấm việc theo ca). Việc lặp lại hằng tuần làm ở Lịch việc theo ca.
// ----------------------------------------------------------------------

const BLOCKS: { value: CleaningShiftBlock; label: string }[] = [
  { value: 'Morning', label: 'Sáng' },
  { value: 'Afternoon', label: 'Chiều' },
  { value: 'Evening', label: 'Tối' },
];

type Target = 'person' | 'shift';

type Draft = {
  target: Target;
  title: string;
  description: string;
  assigneeId: string;
  dueAt: string;
  date: string;
  block: CleaningShiftBlock;
};

export default function CleaningAssignedView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const canAssignPerson = hasPermission(user, PERMISSIONS.hr.taskManage);
  const canAssignShift = hasPermission(user, PERMISSIONS.cleaning.templateManage);
  const today = format(new Date(), 'yyyy-MM-dd');

  const [month, setMonth] = useState(monthStart());
  const [statusFilter, setStatusFilter] = useState<WorkTaskStatus | ''>('');
  const [tasks, setTasks] = useState<IWorkTask[]>([]);
  const [loading, setLoading] = useState(canAssignPerson);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reviewTask, setReviewTask] = useState<IWorkTask | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!canAssignPerson) return;
    setLoading(true);
    try {
      setTasks(await getWorkTasks({ month, status: statusFilter || undefined }));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được việc đã giao'), { variant: 'error' });
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [canAssignPerson, month, statusFilter, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAssignPerson) return;
    getActiveStaffUsers()
      .then((users) => setStaff(users.map((u) => ({ id: u.id, name: u.fullName }))))
      .catch(() => setStaff([]));
  }, [canAssignPerson]);

  const openDraft = () =>
    setDraft({
      target: canAssignPerson ? 'person' : 'shift',
      title: '',
      description: '',
      assigneeId: '',
      dueAt: '',
      date: today,
      block: 'Morning',
    });

  const assignToPerson = async (d: Draft) => {
    await assignWorkTask({
      title: d.title.trim(),
      description: d.description.trim() || null,
      assigneeId: d.assigneeId,
      dueAt: d.dueAt ? new Date(d.dueAt).toISOString() : null,
    });
    enqueueSnackbar('Đã giao — người làm được báo');
    load();
  };

  const assignToShift = async (d: Draft) => {
    // Đầu việc theo ca chỉ hiện với ca có khung ca này (Ca làm việc → Khung ca giao việc).
    const shifts = await getAllShiftTemplates();
    if (!shifts.some((s) => s.isActive && s.cleaningBlock === d.block)) {
      enqueueSnackbar('Chưa có ca làm việc nào gắn khung ca này — vào Ca làm việc chọn "Khung ca giao việc" trước.', {
        variant: 'error',
      });
      return false;
    }
    const day = new Date(`${d.date}T00:00:00`);
    await createCleaningTaskTemplate({
      dayOfWeek: format(day, 'EEEE'),
      cleaningBlock: d.block,
      name: d.title.trim(),
      area: d.description.trim() || undefined,
      sortOrder: 99,
      fromDate: d.date,
      toDate: d.date,
      shiftTemplateIds: [],
    });
    enqueueSnackbar(`Đã giao cho ca ${BLOCKS.find((b) => b.value === d.block)?.label.toLowerCase()} ngày ${format(day, 'dd/MM')}`);
    return true;
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      if (draft.target === 'person') await assignToPerson(draft);
      else if (!(await assignToShift(draft))) return;
      setDraft(null);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không giao được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (t: IWorkTask) => {
    setBusy(true);
    try {
      await cancelWorkTask(t.id);
      enqueueSnackbar('Đã huỷ việc');
      setReviewTask(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không huỷ được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const draftValid =
    !!draft?.title.trim() &&
    (draft.target === 'person' ? !!draft.assigneeId : !!draft.date && draft.date >= today);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Giao việc"
        links={[{ name: 'Việc được giao', href: paths.dashboard.cleaning.root }, { name: 'Giao việc' }]}
        action={
          (canAssignPerson || canAssignShift) && (
            <Button variant="contained" onClick={openDraft}>
              Giao việc
            </Button>
          )
        }
        sx={{ mb: 2 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Giao cho một người: người đó nộp kèm ảnh, bạn duyệt ở danh sách dưới. Giao cho cả ca: ai làm ca đó thấy trong Việc
        của tôi, chấm ở Chấm việc theo ca. Việc lặp lại hằng tuần: dùng Lịch việc theo ca.
      </Typography>

      {canAssignPerson ? (
        <>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
            <MonthField value={month} onChange={setMonth} />
            <TextField
              select
              size="small"
              label="Trạng thái"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as WorkTaskStatus | '')}
              sx={{ width: 180 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {(Object.keys(WORK_TASK_STATUS_LABEL) as WorkTaskStatus[]).map((s) => (
                <MenuItem key={s} value={s}>
                  {WORK_TASK_STATUS_LABEL[s]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : tasks.length === 0 ? (
            <Card>
              <Typography color="text.secondary" sx={{ p: 3 }}>
                Chưa giao việc riêng cho ai trong tháng này.
              </Typography>
            </Card>
          ) : (
            <Card>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Việc</TableCell>
                      <TableCell>Người làm</TableCell>
                      <TableCell>Hạn</TableCell>
                      <TableCell>Nộp lúc</TableCell>
                      <TableCell>Trạng thái</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tasks.map((t) => (
                      <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => setReviewTask(t)}>
                        <TableCell>{t.title}</TableCell>
                        <TableCell>{t.assigneeName}</TableCell>
                        <TableCell>{t.dueAt ? fDateTime(t.dueAt, 'HH:mm dd/MM') : '—'}</TableCell>
                        <TableCell>
                          {t.submittedAt ? fDateTime(t.submittedAt, 'HH:mm dd/MM') : '—'}
                          {t.submittedAt && !t.onTime && (
                            <Chip size="small" color="error" variant="outlined" label="Trễ" sx={{ ml: 0.5 }} />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" color={TASK_STATUS_COLOR[t.status]} label={WORK_TASK_STATUS_LABEL[t.status]} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </>
      ) : (
        <Alert severity="info">Bạn giao được việc cho cả ca. Danh sách việc giao riêng từng người cần quyền giao việc.</Alert>
      )}

      <Dialog open={!!draft} onClose={() => !busy && setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>Giao việc</DialogTitle>
        <DialogContent>
          {draft && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {canAssignPerson && canAssignShift && (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={draft.target}
                  onChange={(_, v: Target | null) => v && setDraft({ ...draft, target: v })}
                >
                  <ToggleButton value="person">Cho một người</ToggleButton>
                  <ToggleButton value="shift">Cho cả ca</ToggleButton>
                </ToggleButtonGroup>
              )}
              <TextField
                label="Việc cần làm"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Vd: Kiểm hàng khu B, lau kính mặt tiền"
              />
              <TextField
                label={draft.target === 'person' ? 'Mô tả, tiêu chí đạt' : 'Khu vực (tuỳ chọn)'}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                multiline={draft.target === 'person'}
                minRows={draft.target === 'person' ? 3 : undefined}
              />
              {draft.target === 'person' ? (
                <>
                  <TextField
                    select
                    label="Người làm"
                    value={draft.assigneeId}
                    onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
                  >
                    {staff.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    type="datetime-local"
                    label="Hạn (trong giờ ca)"
                    value={draft.dueAt}
                    onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </>
              ) : (
                <Stack direction="row" spacing={2}>
                  <TextField
                    type="date"
                    label="Ngày"
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    inputProps={{ min: today }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    select
                    label="Ca"
                    value={draft.block}
                    onChange={(e) => setDraft({ ...draft, block: e.target.value as CleaningShiftBlock })}
                    sx={{ flex: 1 }}
                  >
                    {BLOCKS.map((b) => (
                      <MenuItem key={b.value} value={b.value}>
                        {b.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)} disabled={busy}>
            Đóng
          </Button>
          <LoadingButton variant="contained" loading={busy} disabled={!draftValid} onClick={save}>
            Giao
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <ReviewTaskDialog
        task={reviewTask}
        onClose={() => setReviewTask(null)}
        onDone={() => {
          setReviewTask(null);
          load();
        }}
        onCancel={cancel}
      />
    </Container>
  );
}
