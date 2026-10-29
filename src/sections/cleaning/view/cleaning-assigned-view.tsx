'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
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

import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getActiveStaffUsers } from 'src/api/users';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import { getWorkTasks, assignWorkTask, cancelWorkTask } from 'src/api/hr';
import { getCorrectiveActions, createCorrectiveAction, updateCorrectiveAction } from 'src/api/inspection';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IWorkTask } from 'src/types/hr';
import { WORK_TASK_STATUS_LABEL } from 'src/types/hr';
import type { ICorrectiveAction, CorrectiveActionStatus } from 'src/types/inspection';
import { CORRECTIVE_ACTION_STATUS_LABEL } from 'src/types/inspection';

import { MonthField, monthStart } from 'src/sections/hr/hr-common';

import { TASK_STATUS_COLOR, ReviewTaskDialog } from '../assigned-tasks';

// ----------------------------------------------------------------------
// Giao việc & sửa tận gốc: một danh sách cho việc giao riêng từng người (work-tasks, cần hr.task.manage — người làm nộp
// kèm ảnh, duyệt / trả lại ở đây) và việc sửa tận gốc lỗi lặp (corrective-actions; xem cần inspection.read, giao / sửa
// cần inspection.corrective-action.manage — cuối tuần hệ thống gợi ý mục lỗi nhiều nhất). Việc làm trong ca theo lịch nằm
// ở Hạng mục & lịch, không giao ở đây.
// ----------------------------------------------------------------------

type Target = 'person' | 'fix';
type Filter = 'open' | 'review' | 'done' | 'all';

type Row = { kind: 'task'; key: string; task: IWorkTask } | { kind: 'fix'; key: string; action: ICorrectiveAction };

type AssignDraft = {
  target: Target;
  title: string;
  description: string;
  assigneeId: string;
  dueAt: string;
  itemCode: string;
  rootCause: string;
  action: string;
  dueDate: string;
};

type FixDraft = {
  action: ICorrectiveAction;
  title: string;
  rootCause: string;
  fix: string;
  ownerUserId: string;
  dueDate: string;
  status: CorrectiveActionStatus;
};

const FIX_STATUSES: CorrectiveActionStatus[] = ['Suggested', 'Open', 'Done', 'Dismissed'];

const FIX_STATUS_COLOR: Record<CorrectiveActionStatus, 'default' | 'warning' | 'success' | 'info'> = {
  Suggested: 'warning',
  Open: 'info',
  Done: 'success',
  Dismissed: 'default',
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Đang mở' },
  { value: 'review', label: 'Chờ duyệt' },
  { value: 'done', label: 'Xong' },
  { value: 'all', label: 'Tất cả' },
];

function matches(row: Row, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (row.kind === 'task') {
    const s = row.task.status;
    if (filter === 'review') return s === 'Submitted';
    if (filter === 'done') return s === 'Approved';
    return s === 'Assigned' || s === 'Rejected' || s === 'Submitted';
  }
  const s = row.action.status;
  if (filter === 'review') return false;
  if (filter === 'done') return s === 'Done';
  return s === 'Suggested' || s === 'Open';
}

/** Chờ duyệt / gợi ý lên đầu, rồi đang làm theo hạn, cuối cùng việc đã đóng. */
function rank(row: Row): number {
  if (row.kind === 'task') {
    const s = row.task.status;
    return s === 'Submitted' ? 0 : s === 'Assigned' || s === 'Rejected' ? 2 : 3;
  }
  const s = row.action.status;
  return s === 'Suggested' ? 1 : s === 'Open' ? 2 : 3;
}

function due(row: Row): string {
  return (row.kind === 'task' ? row.task.dueAt : row.action.dueDate) ?? '9999';
}

export default function CleaningAssignedView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const canAssignPerson = hasPermission(user, PERMISSIONS.hr.taskManage);
  const canReadFix = hasPermission(user, PERMISSIONS.inspection.read);
  const canManageFix = hasPermission(user, PERMISSIONS.inspection.correctiveActionManage);

  const [month, setMonth] = useState(monthStart());
  const [filter, setFilter] = useState<Filter>('open');
  const [tasks, setTasks] = useState<IWorkTask[]>([]);
  const [fixes, setFixes] = useState<ICorrectiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [draft, setDraft] = useState<AssignDraft | null>(null);
  const [fixDraft, setFixDraft] = useState<FixDraft | null>(null);
  const [reviewTask, setReviewTask] = useState<IWorkTask | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, f] = await Promise.all([
        canAssignPerson ? getWorkTasks({ month }) : Promise.resolve([] as IWorkTask[]),
        canReadFix || canManageFix ? getCorrectiveActions() : Promise.resolve([] as ICorrectiveAction[]),
      ]);
      setTasks(t);
      setFixes(f);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được danh sách việc'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [canAssignPerson, canReadFix, canManageFix, month, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAssignPerson && !canManageFix) return;
    getActiveStaffUsers()
      .then((users) => setStaff(users.map((u) => ({ id: u.id, name: u.fullName }))))
      .catch(() => setStaff([]));
  }, [canAssignPerson, canManageFix]);

  const staffName = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s.name])), [staff]);

  const rows = useMemo(() => {
    // Sửa tận gốc không theo tháng giao: việc còn mở luôn hiện; việc đã đóng hiện theo tháng tạo.
    const inMonth = (iso: string) => iso.slice(0, 7) === month.slice(0, 7);
    const all: Row[] = [
      ...tasks.map((task): Row => ({ kind: 'task', key: `t-${task.id}`, task })),
      ...fixes
        .filter((a) => a.status === 'Suggested' || a.status === 'Open' || inMonth(a.createdAt))
        .map((action): Row => ({ kind: 'fix', key: `f-${action.id}`, action })),
    ];
    return all
      .filter((r) => matches(r, filter))
      .sort((a, b) => rank(a) - rank(b) || due(a).localeCompare(due(b)));
  }, [tasks, fixes, month, filter]);

  const openDraft = () =>
    setDraft({
      target: canAssignPerson ? 'person' : 'fix',
      title: '',
      description: '',
      assigneeId: '',
      dueAt: '',
      itemCode: '',
      rootCause: '',
      action: '',
      dueDate: '',
    });

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      if (draft.target === 'person') {
        await assignWorkTask({
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          assigneeId: draft.assigneeId,
          dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
        });
        enqueueSnackbar('Đã giao — người làm được báo');
      } else {
        await createCorrectiveAction({
          title: draft.title.trim(),
          itemCode: draft.itemCode.trim() || null,
          rootCause: draft.rootCause.trim() || null,
          action: draft.action.trim() || null,
          ownerUserId: draft.assigneeId || null,
          dueDate: draft.dueDate || null,
        });
        enqueueSnackbar('Đã thêm việc sửa tận gốc');
      }
      setDraft(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không giao được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const cancelTask = async (t: IWorkTask) => {
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

  const openFix = (a: ICorrectiveAction) =>
    setFixDraft({
      action: a,
      title: a.title,
      rootCause: a.rootCause ?? '',
      fix: a.action ?? '',
      ownerUserId: a.ownerUserId ?? '',
      dueDate: a.dueDate ?? '',
      // Mở một gợi ý để giao người thì chuyển sang "Đang làm".
      status: a.status === 'Suggested' ? 'Open' : a.status,
    });

  const saveFix = async () => {
    if (!fixDraft) return;
    setBusy(true);
    try {
      await updateCorrectiveAction(fixDraft.action.id, {
        title: fixDraft.title.trim(),
        rootCause: fixDraft.rootCause.trim() || null,
        action: fixDraft.fix.trim() || null,
        ownerUserId: fixDraft.ownerUserId || null,
        dueDate: fixDraft.dueDate || null,
        status: fixDraft.status,
      });
      enqueueSnackbar('Đã lưu');
      setFixDraft(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const draftValid =
    !!draft?.title.trim() && (draft.target === 'fix' || !!draft.assigneeId);
  const canCreate = canAssignPerson || canManageFix;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Giao việc & sửa tận gốc"
        links={[{ name: 'Công việc', href: paths.dashboard.cleaning.myChecklist }, { name: 'Giao việc & sửa tận gốc' }]}
        action={
          canCreate && (
            <Button variant="contained" onClick={openDraft}>
              Giao việc
            </Button>
          )
        }
        sx={{ mb: 2 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Việc giao cho một người: người đó nộp kèm ảnh, bạn duyệt ở đây. Sửa tận gốc: lỗi lặp nhiều lần thường do thiếu chỗ,
        dụng cụ hoặc người — cuối tuần hệ thống gợi ý mục lỗi nhiều nhất, mở gợi ý để giao người và đặt hạn. Việc làm trong
        ca theo lịch: dùng Hạng mục &amp; lịch.
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <MonthField value={month} onChange={setMonth} />
        <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, v: Filter | null) => v && setFilter(v)}>
          {FILTERS.map((f) => (
            <ToggleButton key={f.value} value={f.value}>
              {f.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : rows.length === 0 ? (
        <Card>
          <Typography color="text.secondary" sx={{ p: 3 }}>
            Không có việc nào.
          </Typography>
        </Card>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Loại</TableCell>
                  <TableCell>Việc</TableCell>
                  <TableCell>Người làm</TableCell>
                  <TableCell>Hạn</TableCell>
                  <TableCell>Nộp / xong lúc</TableCell>
                  <TableCell>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) =>
                  r.kind === 'task' ? (
                    <TableRow key={r.key} hover sx={{ cursor: 'pointer' }} onClick={() => setReviewTask(r.task)}>
                      <TableCell>
                        <Chip size="small" variant="outlined" label="Việc" />
                      </TableCell>
                      <TableCell>{r.task.title}</TableCell>
                      <TableCell>{r.task.assigneeName}</TableCell>
                      <TableCell>{r.task.dueAt ? fDateTime(r.task.dueAt, 'HH:mm dd/MM') : '—'}</TableCell>
                      <TableCell>
                        {r.task.submittedAt ? fDateTime(r.task.submittedAt, 'HH:mm dd/MM') : '—'}
                        {r.task.submittedAt && !r.task.onTime && (
                          <Chip size="small" color="error" variant="outlined" label="Trễ" sx={{ ml: 0.5 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={TASK_STATUS_COLOR[r.task.status]} label={WORK_TASK_STATUS_LABEL[r.task.status]} />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={r.key}
                      hover
                      sx={{ cursor: canManageFix ? 'pointer' : 'default' }}
                      onClick={() => canManageFix && openFix(r.action)}
                    >
                      <TableCell>
                        <Chip
                          size="small"
                          color={r.action.status === 'Suggested' ? 'warning' : 'secondary'}
                          variant="outlined"
                          label={r.action.status === 'Suggested' ? 'Gợi ý sửa tận gốc' : 'Sửa tận gốc'}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                          <span>{r.action.title}</span>
                          {r.action.itemCode && <Chip size="small" variant="outlined" label={r.action.itemCode} />}
                          {r.action.failCount != null && (
                            <Typography variant="caption" color="text.secondary">
                              {r.action.failCount} lần không đạt
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {r.action.ownerName ?? (r.action.ownerUserId ? staffName[r.action.ownerUserId] ?? 'Đã giao' : '—')}
                      </TableCell>
                      <TableCell>{r.action.dueDate ? fDate(r.action.dueDate) : '—'}</TableCell>
                      <TableCell>{r.action.completedAt ? fDateTime(r.action.completedAt, 'HH:mm dd/MM') : '—'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={FIX_STATUS_COLOR[r.action.status]}
                          label={CORRECTIVE_ACTION_STATUS_LABEL[r.action.status]}
                        />
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Giao việc: cho một người hoặc sửa tận gốc */}
      <Dialog open={!!draft} onClose={() => !busy && setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>Giao việc</DialogTitle>
        <DialogContent>
          {draft && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {canAssignPerson && canManageFix && (
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={draft.target}
                  onChange={(_, v: Target | null) => v && setDraft({ ...draft, target: v })}
                >
                  <ToggleButton value="person">Cho một người</ToggleButton>
                  <ToggleButton value="fix">Sửa tận gốc</ToggleButton>
                </ToggleButtonGroup>
              )}
              <TextField
                label="Việc cần làm"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder={draft.target === 'person' ? 'Vd: Kiểm hàng khu B, đóng gói đơn online' : 'Vd: Thêm kệ để túi ở quầy'}
              />
              {draft.target === 'person' ? (
                <TextField
                  label="Mô tả, tiêu chí đạt"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  multiline
                  minRows={3}
                />
              ) : (
                <>
                  <TextField
                    label="Mã hạng mục bị lỗi lặp (nếu có)"
                    value={draft.itemCode}
                    onChange={(e) => setDraft({ ...draft, itemCode: e.target.value })}
                    placeholder="Vd: Q07"
                  />
                  <TextField
                    label="Nguyên nhân gốc"
                    value={draft.rootCause}
                    onChange={(e) => setDraft({ ...draft, rootCause: e.target.value })}
                    multiline
                    minRows={2}
                  />
                  <TextField
                    label="Cách sửa"
                    value={draft.action}
                    onChange={(e) => setDraft({ ...draft, action: e.target.value })}
                    multiline
                    minRows={2}
                  />
                </>
              )}
              <TextField
                select
                label="Người làm"
                value={draft.assigneeId}
                onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
              >
                {draft.target === 'fix' && <MenuItem value="">— Chưa giao —</MenuItem>}
                {staff.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
              {draft.target === 'person' ? (
                <TextField
                  type="datetime-local"
                  label="Hạn (trong giờ ca)"
                  value={draft.dueAt}
                  onChange={(e) => setDraft({ ...draft, dueAt: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              ) : (
                <TextField
                  type="date"
                  label="Hạn"
                  value={draft.dueDate}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
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

      {/* Sửa / mở / đóng việc sửa tận gốc */}
      <Dialog open={!!fixDraft} onClose={() => !busy && setFixDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>Sửa tận gốc</DialogTitle>
        <DialogContent>
          {fixDraft && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {fixDraft.action.itemCode && (
                <Typography variant="body2" color="text.secondary">
                  Hạng mục {fixDraft.action.itemCode}
                  {fixDraft.action.failCount != null ? ` — ${fixDraft.action.failCount} lần không đạt` : ''}
                </Typography>
              )}
              <TextField
                label="Việc cần làm"
                value={fixDraft.title}
                onChange={(e) => setFixDraft({ ...fixDraft, title: e.target.value })}
              />
              <TextField
                label="Nguyên nhân gốc"
                value={fixDraft.rootCause}
                onChange={(e) => setFixDraft({ ...fixDraft, rootCause: e.target.value })}
                multiline
                minRows={2}
              />
              <TextField
                label="Cách sửa"
                value={fixDraft.fix}
                onChange={(e) => setFixDraft({ ...fixDraft, fix: e.target.value })}
                multiline
                minRows={2}
              />
              <TextField
                select
                label="Người làm"
                value={fixDraft.ownerUserId}
                onChange={(e) => setFixDraft({ ...fixDraft, ownerUserId: e.target.value })}
              >
                <MenuItem value="">— Chưa giao —</MenuItem>
                {staff.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="date"
                label="Hạn"
                value={fixDraft.dueDate}
                onChange={(e) => setFixDraft({ ...fixDraft, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                select
                label="Trạng thái"
                value={fixDraft.status}
                onChange={(e) => setFixDraft({ ...fixDraft, status: e.target.value as CorrectiveActionStatus })}
              >
                {FIX_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {CORRECTIVE_ACTION_STATUS_LABEL[s]}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFixDraft(null)} disabled={busy}>
            Đóng
          </Button>
          <LoadingButton variant="contained" loading={busy} disabled={!fixDraft?.title.trim()} onClick={saveFix}>
            Lưu
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
        onCancel={cancelTask}
      />
    </Container>
  );
}
