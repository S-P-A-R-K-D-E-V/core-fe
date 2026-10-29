'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { reviewWorkTask, submitWorkTask, getMyWorkTasks, uploadWorkTaskPhotos } from 'src/api/hr';
import { getMyCorrectiveActions, markCorrectiveActionDone } from 'src/api/inspection';

import { useSnackbar } from 'src/components/snackbar';

import type { IWorkTask, WorkTaskStatus } from 'src/types/hr';
import { WORK_TASK_STATUS_LABEL } from 'src/types/hr';
import type { ICorrectiveAction } from 'src/types/inspection';

import { MonthField, monthStart } from 'src/sections/hr/hr-common';

// ----------------------------------------------------------------------
// Việc giao riêng cho một người (work-tasks): người được giao nộp kèm ảnh nghiệm thu, quản lý duyệt / trả lại. Dùng chung
// cho "Việc của tôi" và trang "Giao việc".
// ----------------------------------------------------------------------

export const TASK_STATUS_COLOR: Record<WorkTaskStatus, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  Assigned: 'info',
  Submitted: 'warning',
  Approved: 'success',
  Rejected: 'error',
  Cancelled: 'default',
};

const MAX_PHOTOS = 5;

/** Việc giao riêng cho tôi trong tháng — nộp / nộp lại kèm ảnh. */
export function MyAssignedTasks() {
  const { enqueueSnackbar } = useSnackbar();
  const [month, setMonth] = useState(monthStart());
  const [tasks, setTasks] = useState<IWorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitTask, setSubmitTask] = useState<IWorkTask | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await getMyWorkTasks(month));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được việc giao riêng'), { variant: 'error' });
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [month, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
        <Typography variant="h6">Việc giao riêng cho tôi</Typography>
        <MonthField value={month} onChange={setMonth} />
      </Stack>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress />
        </Stack>
      ) : tasks.length === 0 ? (
        <Card>
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            Không có việc nào được giao riêng cho bạn trong tháng này.
          </Typography>
        </Card>
      ) : (
        tasks.map((t) => (
          <Card key={t.id}>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle1">{t.title}</Typography>
                    <Chip size="small" color={TASK_STATUS_COLOR[t.status]} label={WORK_TASK_STATUS_LABEL[t.status]} />
                  </Stack>
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
        ))
      )}

      <SubmitTaskDialog
        task={submitTask}
        onClose={() => setSubmitTask(null)}
        onDone={() => {
          setSubmitTask(null);
          load();
        }}
      />
    </Stack>
  );
}

// ----------------------------------------------------------------------

export function SubmitTaskDialog({
  task,
  onClose,
  onDone,
}: {
  task: IWorkTask | null;
  onClose: () => void;
  onDone: () => void;
}) {
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

  // Phiếu sáng kiến cũ (tạo từ app bản trước) không bắt buộc ảnh.
  const needsPhoto = task?.group !== 'Initiative' && (task?.photos.length ?? 0) === 0;

  const save = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const keys = await uploadWorkTaskPhotos(task.id, files);
      await submitWorkTask(task.id, note.trim() || null, keys);
      enqueueSnackbar('Đã nộp — chờ quản lý duyệt');
      onDone();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không nộp được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!task} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Nộp: {task?.title ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
          <Button variant="outlined" component="label" sx={{ alignSelf: 'flex-start' }}>
            Chọn ảnh nghiệm thu
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
          <Typography variant="caption" color="text.secondary">
            Ảnh chỉ dùng nội bộ. Không chụp khách hàng, không chụp khu thay đồ / WC khi có người.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={needsPhoto && files.length === 0} onClick={save}>
          Nộp
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

export function ReviewTaskDialog({
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote(task?.reviewNote ?? '');
  }, [task]);

  const canReview = task?.status === 'Submitted';

  const review = async (approve: boolean) => {
    if (!task) return;
    setSaving(true);
    try {
      await reviewWorkTask(task.id, approve, note.trim() || null);
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
              <Chip size="small" color={TASK_STATUS_COLOR[task.status]} label={WORK_TASK_STATUS_LABEL[task.status]} />
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
            {canReview && (
              <TextField
                label="Nhận xét (bắt buộc khi trả lại)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                multiline
                minRows={2}
              />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {task && task.status !== 'Approved' && task.status !== 'Cancelled' && (
          <Button color="inherit" disabled={saving} onClick={() => onCancel(task)} sx={{ mr: 'auto' }}>
            Huỷ việc
          </Button>
        )}
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        {canReview && (
          <>
            <Button color="error" disabled={saving || !note.trim()} onClick={() => review(false)}>
              Trả lại
            </Button>
            <LoadingButton variant="contained" loading={saving} onClick={() => review(true)}>
              Duyệt
            </LoadingButton>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

/** Việc sửa tận gốc đang mở giao cho tôi — làm xong bấm "Xong" (ghi chú tuỳ chọn). Không có việc nào thì không hiện. */
export function MyCorrectiveActions() {
  const { enqueueSnackbar } = useSnackbar();
  const [actions, setActions] = useState<ICorrectiveAction[]>([]);
  const [doneFor, setDoneFor] = useState<ICorrectiveAction | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setActions(await getMyCorrectiveActions());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được việc sửa tận gốc'), { variant: 'error' });
      setActions([]);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!doneFor) return;
    setSaving(true);
    try {
      await markCorrectiveActionDone(doneFor.id, note.trim() || null);
      enqueueSnackbar('Đã báo xong');
      setDoneFor(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Chưa lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (actions.length === 0) return null;

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">Sửa tận gốc giao cho tôi</Typography>
      {actions.map((a) => (
        <Card key={a.id}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
                  <Typography variant="subtitle1">{a.title}</Typography>
                  {a.itemCode && <Chip size="small" variant="outlined" label={a.itemCode} />}
                </Stack>
                {a.rootCause && (
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                    Nguyên nhân: {a.rootCause}
                  </Typography>
                )}
                {a.action && (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    Cách sửa: {a.action}
                  </Typography>
                )}
                {a.dueDate && (
                  <Typography variant="caption" color="text.secondary">
                    Hạn {fDate(a.dueDate)}
                  </Typography>
                )}
              </Box>
              <Button
                variant="contained"
                sx={{ alignSelf: 'flex-start', flexShrink: 0 }}
                onClick={() => {
                  setNote('');
                  setDoneFor(a);
                }}
              >
                Xong
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!doneFor} onClose={() => !saving && setDoneFor(null)} fullWidth maxWidth="sm">
        <DialogTitle>Xong: {doneFor?.title ?? ''}</DialogTitle>
        <DialogContent>
          <TextField
            label="Đã làm gì (tuỳ chọn)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDoneFor(null)} disabled={saving}>
            Đóng
          </Button>
          <LoadingButton variant="contained" loading={saving} onClick={save}>
            Báo xong
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
