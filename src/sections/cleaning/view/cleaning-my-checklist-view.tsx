'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import imageCompression from 'browser-image-compression';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Lightbox, { useLightBox } from 'src/components/lightbox';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';

import { parseDateStr, toDateStr } from 'src/utils/format-time';
import { getStorageUrl } from 'src/utils/storage';

import type { CleaningTaskStatus, ICleaningTaskInstance, IMyCleaningChecklist } from 'src/types/corecms-api';
import { completeCleaningTask, getMyCleaningChecklist } from 'src/api/cleaning';

// ----------------------------------------------------------------------

const MAX_PHOTOS = 5;
const MAX_PHOTO_SIZE_MB = 3.5; // dưới giới hạn 4MB/ảnh của backend, chừa dư cho overhead nén

const BLOCK_LABEL: Record<string, string> = { Morning: 'Sáng', Afternoon: 'Chiều', Evening: 'Tối' };

const STATUS_LABEL: Record<CleaningTaskStatus, { label: string; color: 'default' | 'info' | 'success' | 'error' }> = {
  Pending: { label: 'Chưa làm', color: 'default' },
  Done: { label: 'Chờ chấm', color: 'info' },
  Passed: { label: 'Đạt', color: 'success' },
  Failed: { label: 'Không đạt', color: 'error' },
};

function TaskPhotoThumbnails({ objectKeys }: { objectKeys: string[] }) {
  const slides = objectKeys.map((key) => ({ src: getStorageUrl(key) }));
  const lightbox = useLightBox(slides);

  if (objectKeys.length === 0) return null;

  return (
    <>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
        {objectKeys.map((key) => (
          <Box
            key={key}
            component="img"
            src={getStorageUrl(key)}
            onClick={() => lightbox.onOpen(getStorageUrl(key))}
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1,
              objectFit: 'cover',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
        ))}
      </Stack>
      <Lightbox index={lightbox.selected} slides={slides} open={lightbox.open} close={lightbox.onClose} />
    </>
  );
}

function TaskRow({
  task,
  currentUserId,
  onComplete,
  busy,
}: {
  task: ICleaningTaskInstance;
  currentUserId?: string;
  onComplete: (taskId: string, files: File[]) => void;
  busy: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const canComplete = task.status === 'Pending' || task.status === 'Done';
  const myPenalties = task.penalties.filter((p) => !p.voidedAt && p.userId === currentUserId);

  const handlePick = () => fileInputRef.current?.click();

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (files.length > MAX_PHOTOS) {
      // eslint-disable-next-line no-alert
      alert(`Chỉ chọn tối đa ${MAX_PHOTOS} ảnh`);
      return;
    }
    setCompressing(true);
    try {
      const compressed = await Promise.all(
        files.map(async (file) => {
          if (file.size <= MAX_PHOTO_SIZE_MB * 1024 * 1024) return file;
          try {
            return await imageCompression(file, {
              maxSizeMB: MAX_PHOTO_SIZE_MB,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            });
          } catch {
            return file;
          }
        })
      );
      onComplete(task.id, compressed);
    } finally {
      setCompressing(false);
    }
  };

  return (
    <Box sx={{ py: 1.5 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="subtitle2">{task.name}</Typography>
          {task.area && (
            <Typography variant="caption" color="text.secondary">
              {task.area}
            </Typography>
          )}
        </Box>
        <Label color={STATUS_LABEL[task.status]?.color || 'default'}>
          {STATUS_LABEL[task.status]?.label || task.status}
        </Label>
      </Stack>

      {task.status === 'Done' && (
        <Typography variant="caption" color="info.main" sx={{ display: 'block', mt: 0.5 }}>
          Đã gửi ảnh, đang chờ Quản lý chấm điểm.
        </Typography>
      )}
      {task.status === 'Failed' && task.reviewNote && (
        <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
          Ghi chú: {task.reviewNote}
        </Typography>
      )}
      {myPenalties.map((p) => (
        <Typography key={p.id} variant="caption" color="error.main" sx={{ display: 'block', fontWeight: 600 }}>
          Bị phạt {p.amount.toLocaleString('vi-VN')}đ{p.reason ? ` — ${p.reason}` : ''}
        </Typography>
      ))}

      <TaskPhotoThumbnails objectKeys={task.photoObjectKeys} />

      {canComplete && (
        <Box sx={{ mt: 1 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFilesSelected}
          />
          <Button
            size="small"
            variant={task.status === 'Done' ? 'outlined' : 'contained'}
            startIcon={<Iconify icon="solar:camera-bold" />}
            loading={busy || compressing}
            disabled={busy || compressing}
            onClick={handlePick}
          >
            {compressing
              ? 'Đang xử lý ảnh...'
              : task.status === 'Done'
                ? 'Chụp lại ảnh'
                : `Chọn ảnh & hoàn thành (tối đa ${MAX_PHOTOS})`}
          </Button>
        </Box>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

export default function CleaningMyChecklistView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user: authUser } = useAuthContext();

  const [date, setDate] = useState(toDateStr(new Date()));
  const [shifts, setShifts] = useState<IMyCleaningChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const fetchChecklist = useCallback(async () => {
    if (!date) return;
    try {
      setLoading(true);
      const data = await getMyCleaningChecklist(date);
      setShifts(data);
    } catch (error) {
      console.error('Error fetching my cleaning checklist:', error);
      enqueueSnackbar('Không thể tải checklist vệ sinh', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [date, enqueueSnackbar]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const handleComplete = async (taskId: string, files: File[]) => {
    setBusyTaskId(taskId);
    try {
      await completeCleaningTask(taskId, files);
      enqueueSnackbar('Đã ghi nhận hoàn thành, chờ Quản lý chấm điểm.');
      fetchChecklist();
    } catch (error: any) {
      enqueueSnackbar(error?.title || 'Có lỗi xảy ra', { variant: 'error' });
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'md'}>
      <CustomBreadcrumbs
        heading="Checklist vệ sinh của tôi"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Vệ sinh', href: paths.dashboard.cleaning.root },
          { name: 'Checklist của tôi' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ mb: 3, p: 2 }}>
        <DatePicker
          label="Ngày"
          value={parseDateStr(date)}
          onChange={(val) => setDate(toDateStr(val))}
          format="dd/MM/yyyy"
          slotProps={{ textField: { sx: { width: 220 } } }}
        />
      </Card>

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
          <CircularProgress />
        </Stack>
      ) : shifts.length === 0 ? (
        <Card sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Không có checklist vệ sinh cho ca nào của bạn trong ngày này.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={2}>
          {shifts.map((shift) => (
            <Card key={shift.shiftAssignmentId} sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                {shift.shiftName} · {BLOCK_LABEL[shift.cleaningBlock] ?? shift.cleaningBlock}
              </Typography>
              <Stack divider={<Box sx={{ height: '1px', bgcolor: 'divider' }} />}>
                {shift.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    currentUserId={authUser?.id}
                    onComplete={handleComplete}
                    busy={busyTaskId === task.id}
                  />
                ))}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
