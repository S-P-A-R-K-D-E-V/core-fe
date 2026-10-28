'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
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
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';


import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getActiveStaffUsers } from 'src/api/users';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import {
  getWorkTasks,
  reviewWorkTask,
  submitWorkTask,
  assignWorkTask,
  cancelWorkTask,
  getMyWorkTasks,
  createInitiative,
  uploadWorkTaskPhotos,
} from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IWorkTask, WorkTaskGroup, WorkTaskStatus } from 'src/types/hr';
import { ASSIGNABLE_TASK_GROUPS, WORK_TASK_GROUP_LABEL, WORK_TASK_STATUS_LABEL } from 'src/types/hr';

import { MonthField, monthStart } from '../hr-common';

// ----------------------------------------------------------------------
// Nhiệm vụ trong giờ ca (Quy chế Điều 14a): đăng nội dung, trả lời khách, đóng gói đơn online, trang trí; chấm 20 điểm
// nhiệm vụ theo tỷ lệ được duyệt đúng hạn. Phiếu sáng kiến: +1 điểm mỗi phiếu được duyệt (tối đa 2), +3 khi được chọn
// triển khai. Không giao việc ngoài giờ ca.
// ----------------------------------------------------------------------

const STATUS_COLOR: Record<WorkTaskStatus, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  Assigned: 'info',
  Submitted: 'warning',
  Approved: 'success',
  Rejected: 'error',
  Cancelled: 'default',
};

const MAX_PHOTOS = 5;

type AssignDraft = { group: WorkTaskGroup; title: string; description: string; assigneeId: string; dueAt: string };

export default function HrTasksView({ initialTab }: { initialTab?: string }) {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const canManage = hasPermission(user, PERMISSIONS.hr.taskManage);

  const [tab, setTab] = useState<'mine' | 'manage'>(initialTab === 'mine' || !canManage ? 'mine' : 'manage');
  const [month, setMonth] = useState(monthStart());
  const [statusFilter, setStatusFilter] = useState<WorkTaskStatus | ''>('');
  const [tasks, setTasks] = useState<IWorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);

  const [assign, setAssign] = useState<AssignDraft | null>(null);
  const [initiative, setInitiative] = useState<{ title: string; description: string } | null>(null);
  const [submitTask, setSubmitTask] = useState<IWorkTask | null>(null);
  const [reviewTask, setReviewTask] = useState<IWorkTask | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(
        tab === 'mine'
          ? await getMyWorkTasks(month)
          : await getWorkTasks({ month, status: statusFilter || undefined })
      );
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được nhiệm vụ'), { variant: 'error' });
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [tab, month, statusFilter, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    getActiveStaffUsers()
      .then((users) => setStaff(users.map((u) => ({ id: u.id, name: u.fullName }))))
      .catch(() => setStaff([]));
  }, [canManage]);

  const run = async (action: () => Promise<unknown>, done: string, fail: string) => {
    setBusy(true);
    try {
      await action();
      enqueueSnackbar(done);
      return true;
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, fail), { variant: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveAssign = async () => {
    if (!assign) return;
    const ok = await run(
      () =>
        assignWorkTask({
          group: assign.group,
          title: assign.title.trim(),
          description: assign.description.trim() || null,
          assigneeId: assign.assigneeId,
          dueAt: assign.dueAt ? new Date(assign.dueAt).toISOString() : null,
        }),
      'Đã giao — nhân viên được báo',
      'Không giao được'
    );
    if (ok) {
      setAssign(null);
      load();
    }
  };

  const saveInitiative = async () => {
    if (!initiative) return;
    setBusy(true);
    try {
      const created = await createInitiative(initiative.title.trim(), initiative.description.trim());
      setInitiative(null);
      setSubmitTask(created);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tạo được phiếu'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Nhiệm vụ"
        links={[{ name: 'Nhân sự' }, { name: 'Nhiệm vụ' }]}
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => setInitiative({ title: '', description: '' })}>
              Phiếu sáng kiến
            </Button>
            {canManage && (
              <Button
                variant="contained"
                onClick={() => setAssign({ group: 'Content', title: '', description: '', assigneeId: '', dueAt: '' })}
              >
                Giao nhiệm vụ
              </Button>
            )}
          </Stack>
        }
        sx={{ mb: 2 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Nhiệm vụ làm trong giờ ca, nộp kèm ảnh nghiệm thu; quản lý duyệt.
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        {canManage && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab value="manage" label="Quản lý" />
            <Tab value="mine" label="Của tôi" />
          </Tabs>
        )}
        <MonthField value={month} onChange={setMonth} />
        {tab === 'manage' && (
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
        )}
      </Stack>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : tasks.length === 0 ? (
        <Card>
          <Typography color="text.secondary" sx={{ p: 3 }}>
            Không có nhiệm vụ nào.
          </Typography>
        </Card>
      ) : tab === 'mine' ? (
        <Stack spacing={1.5}>
          {tasks.map((t) => (
            <Card key={t.id}>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
                      <Chip size="small" variant="outlined" label={WORK_TASK_GROUP_LABEL[t.group]} />
                      <Chip size="small" color={STATUS_COLOR[t.status]} label={WORK_TASK_STATUS_LABEL[t.status]} />
                      {t.implemented && <Chip size="small" color="primary" label="Được triển khai" />}
                    </Stack>
                    <Typography variant="subtitle1">{t.title}</Typography>
                    {t.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                        {t.description}
                      </Typography>
                    )}
                    {t.dueAt && (
                      <Typography variant="caption" color="text.secondary">
                        Hạn {fDateTime(t.dueAt, 'HH:mm dd/MM')}
                      </Typography>
                    )}
                    {t.reviewNote && (
                      <Alert severity={t.status === 'Rejected' ? 'warning' : 'info'} sx={{ mt: 1 }}>
                        {t.reviewNote}
                      </Alert>
                    )}
                  </Box>
                  {(t.status === 'Assigned' || t.status === 'Rejected') && (
                    <Button variant="contained" sx={{ alignSelf: 'flex-start', flexShrink: 0 }} onClick={() => setSubmitTask(t)}>
                      {t.status === 'Rejected' ? 'Nộp lại' : 'Nộp'}
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nhiệm vụ</TableCell>
                  <TableCell>Nhóm</TableCell>
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
                    <TableCell>{WORK_TASK_GROUP_LABEL[t.group]}</TableCell>
                    <TableCell>{t.assigneeName}</TableCell>
                    <TableCell>{t.dueAt ? fDateTime(t.dueAt, 'HH:mm dd/MM') : '—'}</TableCell>
                    <TableCell>
                      {t.submittedAt ? fDateTime(t.submittedAt, 'HH:mm dd/MM') : '—'}
                      {t.submittedAt && !t.onTime && <Chip size="small" color="error" variant="outlined" label="Trễ" sx={{ ml: 0.5 }} />}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS_COLOR[t.status]} label={WORK_TASK_STATUS_LABEL[t.status]} />
                      {t.implemented && <Chip size="small" color="primary" label="Triển khai" sx={{ ml: 0.5 }} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Giao nhiệm vụ */}
      <Dialog open={!!assign} onClose={() => !busy && setAssign(null)} fullWidth maxWidth="sm">
        <DialogTitle>Giao nhiệm vụ</DialogTitle>
        <DialogContent>
          {assign && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                select
                label="Nhóm"
                value={assign.group}
                onChange={(e) => setAssign({ ...assign, group: e.target.value as WorkTaskGroup })}
              >
                {ASSIGNABLE_TASK_GROUPS.map((g) => (
                  <MenuItem key={g} value={g}>
                    {WORK_TASK_GROUP_LABEL[g]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Việc cần làm" value={assign.title} onChange={(e) => setAssign({ ...assign, title: e.target.value })} />
              <TextField
                label="Mô tả, tiêu chí đạt"
                value={assign.description}
                onChange={(e) => setAssign({ ...assign, description: e.target.value })}
                multiline
                minRows={3}
              />
              <TextField
                select
                label="Người làm"
                value={assign.assigneeId}
                onChange={(e) => setAssign({ ...assign, assigneeId: e.target.value })}
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
                value={assign.dueAt}
                onChange={(e) => setAssign({ ...assign, dueAt: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssign(null)} disabled={busy}>
            Đóng
          </Button>
          <LoadingButton
            variant="contained"
            loading={busy}
            disabled={!assign?.title.trim() || !assign?.assigneeId}
            onClick={saveAssign}
          >
            Giao
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Phiếu sáng kiến */}
      <Dialog open={!!initiative} onClose={() => !busy && setInitiative(null)} fullWidth maxWidth="sm">
        <DialogTitle>Phiếu đề xuất sáng kiến</DialogTitle>
        <DialogContent>
          {initiative && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Tên chương trình / sự kiện"
                value={initiative.title}
                onChange={(e) => setInitiative({ ...initiative, title: e.target.value })}
              />
              <TextField
                label="Mục tiêu, sản phẩm, cơ chế (combo, quà, giảm giá), thời gian, trang trí, chi phí, doanh thu dự kiến"
                value={initiative.description}
                onChange={(e) => setInitiative({ ...initiative, description: e.target.value })}
                multiline
                minRows={6}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInitiative(null)} disabled={busy}>
            Đóng
          </Button>
          <LoadingButton
            variant="contained"
            loading={busy}
            disabled={!initiative?.title.trim() || !initiative?.description.trim()}
            onClick={saveInitiative}
          >
            Tiếp tục
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <SubmitTaskDialog
        task={submitTask}
        onClose={() => setSubmitTask(null)}
        onDone={() => {
          setSubmitTask(null);
          if (tab !== 'mine') setTab('mine');
          else load();
        }}
      />

      <ReviewTaskDialog
        task={reviewTask}
        onClose={() => setReviewTask(null)}
        onDone={() => {
          setReviewTask(null);
          load();
        }}
        onCancel={async (t) => {
          if (await run(() => cancelWorkTask(t.id), 'Đã huỷ nhiệm vụ', 'Không huỷ được')) {
            setReviewTask(null);
            load();
          }
        }}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

function SubmitTaskDialog({ task, onClose, onDone }: { task: IWorkTask | null; onClose: () => void; onDone: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote('');
    setFiles([]);
  }, [task]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const isInitiative = task?.group === 'Initiative';
  const needsPhoto = !isInitiative && (task?.photos.length ?? 0) === 0;

  const save = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const keys = await uploadWorkTaskPhotos(task.id, files);
      await submitWorkTask(task.id, note.trim() || null, keys);
      enqueueSnackbar(isInitiative ? 'Đã gửi phiếu sáng kiến' : 'Đã nộp — chờ quản lý duyệt');
      onDone();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không nộp được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!task} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>{isInitiative ? 'Gửi phiếu sáng kiến' : `Nộp: ${task?.title ?? ''}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={isInitiative ? 'Ghi chú thêm (tuỳ chọn)' : 'Ghi chú (link bài đăng, số đơn…)'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
          />
          <Button variant="outlined" component="label" sx={{ alignSelf: 'flex-start' }}>
            {isInitiative ? 'Thêm ảnh minh hoạ (tuỳ chọn)' : 'Chọn ảnh nghiệm thu'}
            <input
              hidden
              multiple
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))}
            />
          </Button>
          {previews.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {previews.map((src) => (
                <Box key={src} component="img" src={src} alt="" sx={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 1 }} />
              ))}
            </Stack>
          )}
          {(task?.photos.length ?? 0) > 0 && (
            <Typography variant="caption" color="text.secondary">
              Đã có {task?.photos.length} ảnh từ lần nộp trước.
            </Typography>
          )}
          {!isInitiative && (
            <Typography variant="caption" color="text.secondary">
              Ảnh chỉ dùng nội bộ. Không chụp khách hàng, không chụp khu thay đồ / WC khi có người.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={needsPhoto && files.length === 0} onClick={save}>
          {isInitiative ? 'Gửi phiếu' : 'Nộp'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

function ReviewTaskDialog({
  task,
  onClose,
  onDone,
  onCancel,
}: {
  task: IWorkTask | null;
  onClose: () => void;
  onDone: () => void;
  onCancel: (task: IWorkTask) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [note, setNote] = useState('');
  const [implemented, setImplemented] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote(task?.reviewNote ?? '');
    setImplemented(task?.implemented ?? false);
  }, [task]);

  const isInitiative = task?.group === 'Initiative';
  const canReview = task?.status === 'Submitted';
  const canMarkImplemented = isInitiative && task?.status === 'Approved' && !task.implemented;

  const review = async (approve: boolean) => {
    if (!task) return;
    setSaving(true);
    try {
      await reviewWorkTask(task.id, approve, note.trim() || null, isInitiative && approve && implemented);
      enqueueSnackbar(approve ? 'Đã duyệt' : 'Đã trả lại');
      onDone();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không duyệt được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!task} onClose={() => !saving && onClose()} fullWidth maxWidth="md">
      <DialogTitle>{task?.title}</DialogTitle>
      <DialogContent>
        {task && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label={WORK_TASK_GROUP_LABEL[task.group]} />
              <Chip size="small" color={STATUS_COLOR[task.status]} label={WORK_TASK_STATUS_LABEL[task.status]} />
              <Chip size="small" label={task.assigneeName} />
              {task.dueAt && <Chip size="small" variant="outlined" label={`Hạn ${fDateTime(task.dueAt, 'HH:mm dd/MM')}`} />}
              {task.submittedAt && !task.onTime && <Chip size="small" color="error" variant="outlined" label="Nộp trễ" />}
            </Stack>
            {task.description && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {task.description}
              </Typography>
            )}
            {task.submissionNote && <Alert severity="info">{task.submissionNote}</Alert>}
            {task.photos.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {task.photos.map((p) => (
                  <Box
                    key={p.id}
                    component="a"
                    href={p.url}
                    target="_blank"
                    rel="noopener"
                    sx={{ display: 'block', width: 140, height: 140, borderRadius: 1, overflow: 'hidden' }}
                  >
                    <Box component="img" src={p.url} alt="" sx={{ width: 1, height: 1, objectFit: 'cover' }} />
                  </Box>
                ))}
              </Stack>
            )}
            {(canReview || canMarkImplemented) && (
              <>
                <TextField
                  label="Nhận xét (bắt buộc khi trả lại)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  multiline
                  minRows={2}
                  disabled={canMarkImplemented}
                />
                {isInitiative && (
                  <FormControlLabel
                    control={<Checkbox checked={implemented} onChange={(e) => setImplemented(e.target.checked)} />}
                    label="Chọn triển khai (+3 điểm)"
                  />
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {task && task.status !== 'Approved' && task.status !== 'Cancelled' && (
          <Button color="inherit" disabled={saving} onClick={() => onCancel(task)} sx={{ mr: 'auto' }}>
            Huỷ nhiệm vụ
          </Button>
        )}
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        {canReview && (
          <Button color="error" disabled={saving || !note.trim()} onClick={() => review(false)}>
            Trả lại
          </Button>
        )}
        {(canReview || canMarkImplemented) && (
          <LoadingButton
            variant="contained"
            loading={saving}
            disabled={canMarkImplemented && !implemented}
            onClick={() => review(true)}
          >
            {canMarkImplemented ? 'Lưu' : 'Duyệt'}
          </LoadingButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
