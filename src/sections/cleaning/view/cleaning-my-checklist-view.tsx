'use client';

import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

import { BLOCK_LABEL, TaskRow } from 'src/sections/cleaning/cleaning-task-row';

import type { IMyCleaningChecklist } from 'src/types/corecms-api';
import { completeCleaningTask, getMyCleaningChecklist } from 'src/api/cleaning';

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
