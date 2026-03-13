'use client';

import { useMemo, useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Unstable_Grid2';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import LoadingButton from '@mui/lab/LoadingButton';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { parseDateStr, toDateStr } from 'src/utils/format-time';

import { IShiftSchedule, IShiftTemplate } from 'src/types/corecms-api';
import {
  createShiftSchedule,
  updateShiftSchedule,
  getAllShiftTemplates,
} from 'src/api/attendance';

// ----------------------------------------------------------------------

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 4, label: 'Wednesday' },
  { value: 8, label: 'Thursday' },
  { value: 16, label: 'Friday' },
  { value: 32, label: 'Saturday' },
  { value: 64, label: 'Sunday' },
];

type Props = {
  currentSchedule?: IShiftSchedule;
};

export default function ShiftScheduleNewEditForm({ currentSchedule }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [templates, setTemplates] = useState<IShiftTemplate[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await getAllShiftTemplates();
        setTemplates(data);
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      }
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (currentSchedule) {
      const days: number[] = [];
      WEEKDAYS.forEach((day) => {
        if ((currentSchedule.repeatDays & day.value) === day.value) {
          days.push(day.value);
        }
      });
      setSelectedDays(days);
    }
  }, [currentSchedule]);

  const NewScheduleSchema = Yup.object().shape({
    shiftTemplateId: Yup.string().required('Template is required'),
    startTime: Yup.string().required('Start time is required'),
    endTime: Yup.string().required('End time is required'),
    fromDate: Yup.string().required('From date is required'),
    toDate: Yup.string().nullable(),
    checkInAllowedMinutesBefore: Yup.number().min(0).required('Required'),
  });

  const defaultValues = useMemo(
    () => ({
      shiftTemplateId: currentSchedule?.shiftTemplateId || '',
      startTime: currentSchedule?.startTime || '08:00',
      endTime: currentSchedule?.endTime || '17:00',
      fromDate: currentSchedule?.fromDate || new Date().toISOString().split('T')[0],
      toDate: currentSchedule?.toDate || '',
      checkInAllowedMinutesBefore: currentSchedule?.checkInAllowedMinutesBefore ?? 15,
    }),
    [currentSchedule]
  );

  const methods = useForm({
    resolver: yupResolver(NewScheduleSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const handleDayToggle = (dayValue: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayValue) ? prev.filter((d) => d !== dayValue) : [...prev, dayValue]
    );
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const repeatDays = selectedDays.reduce((acc, day) => acc | day, 0);

      const payload = {
        shiftTemplateId: data.shiftTemplateId,
        startTime: data.startTime,
        endTime: data.endTime,
        fromDate: data.fromDate,
        toDate: data.toDate || undefined,
        repeatDays,
        checkInAllowedMinutesBefore: data.checkInAllowedMinutesBefore,
      };

      if (currentSchedule) {
        await updateShiftSchedule(currentSchedule.id, payload);
        enqueueSnackbar('Update success! New version created.');
      } else {
        await createShiftSchedule(payload);
        enqueueSnackbar('Create success!');
      }
      router.push(paths.dashboard.shift.schedules.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar(currentSchedule ? 'Update failed!' : 'Create failed!', {
        variant: 'error',
      });
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid xs={12} md={8}>
          <Card sx={{ p: 3 }}>
            <Box
              rowGap={3}
              columnGap={2}
              display="grid"
              gridTemplateColumns={{ xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' }}
            >
              <RHFSelect name="shiftTemplateId" label="Shift Template" disabled={!!currentSchedule}>
                <MenuItem value="">Select Template</MenuItem>
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name} ({template.shiftType})
                  </MenuItem>
                ))}
              </RHFSelect>

              <Box />

              <RHFTextField
                name="startTime"
                label="Start Time"
                type="time"
                InputLabelProps={{ shrink: true }}
              />

              <RHFTextField
                name="endTime"
                label="End Time"
                type="time"
                InputLabelProps={{ shrink: true }}
              />

              <Controller
                name="fromDate"
                control={methods.control}
                render={({ field, fieldState: { error } }) => (
                  <DatePicker
                    label="From Date"
                    value={parseDateStr(field.value)}
                    onChange={(val) => field.onChange(toDateStr(val))}
                    format="dd/MM/yyyy"
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!error,
                        helperText: error?.message,
                      },
                    }}
                  />
                )}
              />

              <Controller
                name="toDate"
                control={methods.control}
                render={({ field, fieldState: { error } }) => (
                  <DatePicker
                    label="To Date (Optional)"
                    value={parseDateStr(field.value)}
                    onChange={(val) => field.onChange(toDateStr(val))}
                    format="dd/MM/yyyy"
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: !!error,
                        helperText: error?.message,
                      },
                    }}
                  />
                )}
              />

              <RHFTextField
                name="checkInAllowedMinutesBefore"
                label="Check-in Allowed Minutes Before"
                type="number"
              />
            </Box>

            <Stack spacing={2} sx={{ mt: 3 }}>
              <Typography variant="subtitle2">Repeat Days</Typography>
              <FormGroup row>
                {WEEKDAYS.map((day) => (
                  <FormControlLabel
                    key={day.value}
                    control={
                      <Checkbox
                        checked={selectedDays.includes(day.value)}
                        onChange={() => handleDayToggle(day.value)}
                      />
                    }
                    label={day.label}
                  />
                ))}
              </FormGroup>
            </Stack>

            {currentSchedule && (
              <Stack sx={{ mt: 3, p: 2, bgcolor: 'warning.lighter', borderRadius: 1 }}>
                <Typography variant="body2" color="warning.darker">
                  Note: Editing will create a new version (v{currentSchedule.version + 1})
                </Typography>
              </Stack>
            )}

            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                {!currentSchedule ? 'Create Schedule' : 'Save Changes (New Version)'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
