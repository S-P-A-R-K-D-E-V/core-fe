'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { toDateStr, parseDateStr } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { completeCleaningTask, getMyCleaningChecklist } from 'src/api/cleaning';
import { getMyShiftWork, completeShiftWork, uploadShiftWorkPhotos } from 'src/api/inspection';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IMyCleaningChecklist } from 'src/types/corecms-api';
import type { IShiftWorkItem, IShiftWorkShift } from 'src/types/inspection';
import { WORK_BLOCK_LABEL, INSPECTION_OUTCOME_LABEL } from 'src/types/inspection';

import { TaskRow, BLOCK_LABEL } from 'src/sections/cleaning/cleaning-task-row';
import { MyOpenFaults } from 'src/sections/inspection/view/inspection-my-faults-view';
import { MyAssignedTasks, MyCorrectiveActions } from 'src/sections/cleaning/assigned-tasks';
import { PhotoPicker, ShiftWorkDoneInfo, InspectionPhotoRules } from 'src/sections/inspection/inspection-common';

// ----------------------------------------------------------------------
// Việc của tôi (Công việc): hạng mục nhân viên tự làm trong các ca của tôi theo ngày (làm xong chụp ảnh, trưởng ca chấm
// khi kiểm), lỗi cần sửa, việc giao riêng và việc sửa tận gốc giao cho tôi. Lịch vệ sinh cũ chỉ hiện khi còn việc.
// ----------------------------------------------------------------------

const MAX_PHOTOS = 5;

const OUTCOME_COLOR = { Pass: 'success', Fail: 'error', NotApplicable: 'default' } as const;

type Doing = { shift: IShiftWorkShift; item: IShiftWorkItem };

export default function CleaningMyChecklistView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user: authUser } = useAuthContext();

  const [date, setDate] = useState(toDateStr(new Date()));
  const [shifts, setShifts] = useState<IShiftWorkShift[]>([]);
  const [legacy, setLegacy] = useState<IMyCleaningChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [doing, setDoing] = useState<Doing | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      // Lịch vệ sinh cũ: không bắt lỗi to — cửa hàng đã chuyển sang hạng mục thì danh sách rỗng.
      const [work, old] = await Promise.all([
        getMyShiftWork(date),
        getMyCleaningChecklist(date).catch(() => [] as IMyCleaningChecklist[]),
      ]);
      setShifts(work);
      setLegacy(old.filter((s) => s.tasks.length > 0));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được việc trong ca'), { variant: 'error' });
      setShifts([]);
    } finally {
      setLoading(false);
    }
  }, [date, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const completeLegacy = async (taskId: string, files: File[]) => {
    setBusyTaskId(taskId);
    try {
      await completeCleaningTask(taskId, files);
      enqueueSnackbar('Đã ghi nhận xong, chờ quản lý chấm.');
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Có lỗi xảy ra'), { variant: 'error' });
    } finally {
      setBusyTaskId(null);
    }
  };

  const withItems = shifts.filter((s) => s.items.length > 0);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'md'}>
      <CustomBreadcrumbs
        heading="Việc của tôi"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Công việc', href: paths.dashboard.cleaning.myChecklist },
          { name: 'Việc của tôi' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Stack spacing={5}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Typography variant="h6">Việc trong ca</Typography>
            <DatePicker
              label="Ngày"
              value={parseDateStr(date)}
              onChange={(val) => setDate(toDateStr(val))}
              format="dd/MM/yyyy"
              slotProps={{ textField: { size: 'small', sx: { width: 180 } } }}
            />
          </Stack>

          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : withItems.length === 0 ? (
            <Card sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Không có việc nào trong ca của bạn ngày này.
              </Typography>
            </Card>
          ) : (
            withItems.map((shift) => (
              <Card key={shift.shiftScheduleId} sx={{ p: 2 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  {shift.shiftName} · {shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}
                  {shift.block ? ` · ${WORK_BLOCK_LABEL[shift.block]}` : ''}
                </Typography>
                <Stack divider={<Box sx={{ height: '1px', bgcolor: 'divider' }} />}>
                  {shift.items.map((item) => (
                    <ShiftWorkRow key={item.itemId} item={item} onDo={() => setDoing({ shift, item })} />
                  ))}
                </Stack>
              </Card>
            ))
          )}

          {!loading && legacy.length > 0 && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Việc theo lịch cũ
              </Typography>
              {legacy.map((shift) => (
                <Card key={`${shift.shiftAssignmentId}-${shift.cleaningBlock}`} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    {shift.shiftName} · {BLOCK_LABEL[shift.cleaningBlock] ?? shift.cleaningBlock}
                  </Typography>
                  <Stack divider={<Box sx={{ height: '1px', bgcolor: 'divider' }} />}>
                    {shift.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        currentUserId={authUser?.id}
                        onComplete={completeLegacy}
                        busy={busyTaskId === task.id}
                      />
                    ))}
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>

        <MyOpenFaults />

        <MyAssignedTasks />

        <MyCorrectiveActions />
      </Stack>

      <DoneDialog
        doing={doing}
        date={date}
        onClose={() => setDoing(null)}
        onDone={() => {
          setDoing(null);
          load();
        }}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

function ShiftWorkRow({ item, onDo }: { item: IShiftWorkItem; onDo: () => void }) {
  // Đã kiểm hạng mục này trong ca thì không làm lại được nữa.
  const canDo = item.outcome === null;
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ py: 1.5 }} justifyContent="space-between">
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2">{item.title}</Typography>
          {item.zones.map((z) => (
            <Chip key={z} size="small" variant="outlined" label={`Khu ${z}`} />
          ))}
          {item.outcome && (
            <Chip
              size="small"
              color={OUTCOME_COLOR[item.outcome]}
              label={`Kiểm: ${INSPECTION_OUTCOME_LABEL[item.outcome]}`}
            />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Đạt khi: {item.passCriteria}
        </Typography>
        <ShiftWorkDoneInfo completion={item.completion} />
      </Stack>
      {canDo && (
        <Button
          size="small"
          variant={item.completion ? 'outlined' : 'contained'}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, flexShrink: 0 }}
          onClick={onDo}
        >
          {item.completion ? 'Làm lại' : 'Đã làm'}
        </Button>
      )}
    </Stack>
  );
}

function DoneDialog({
  doing,
  date,
  onClose,
  onDone,
}: {
  doing: Doing | null;
  date: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFiles([]);
    setNote(doing?.item.completion?.note ?? '');
  }, [doing]);

  const needPhoto = !!doing?.item.requiresPhoto && files.length === 0;

  const save = async () => {
    if (!doing) return;
    setSaving(true);
    try {
      const keys = await uploadShiftWorkPhotos(doing.shift.shiftScheduleId, date, files);
      await completeShiftWork({
        date,
        shiftScheduleId: doing.shift.shiftScheduleId,
        itemId: doing.item.itemId,
        note: note.trim() || null,
        photoKeys: keys,
      });
      enqueueSnackbar('Đã ghi nhận — trưởng ca chấm khi kiểm.');
      onDone();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Chưa lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!doing} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Đã làm: {doing?.item.title ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {doing && (
            <Typography variant="body2" color="text.secondary">
              Đạt khi: {doing.item.passCriteria}
            </Typography>
          )}
          <InspectionPhotoRules />
          <PhotoPicker
            photos={[]}
            files={files}
            max={MAX_PHOTOS}
            disabled={saving}
            onAdd={(picked) => setFiles((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS))}
            onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
          />
          {doing?.item.requiresPhoto && (
            <Typography variant="caption" color={needPhoto ? 'warning.main' : 'text.secondary'}>
              Cần ít nhất 1 ảnh{doing.item.completion ? ' (ảnh mới thay ảnh lần trước)' : ''}.
            </Typography>
          )}
          <TextField label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={needPhoto} onClick={save}>
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
