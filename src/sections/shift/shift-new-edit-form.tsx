'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Unstable_Grid2';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect, RHFSwitch } from 'src/components/hook-form';

import { IShift } from 'src/types/corecms-api';
import { createShift, updateShift } from 'src/api/attendance';

// ----------------------------------------------------------------------

type Props = {
  currentShift?: IShift;
};

export default function ShiftNewEditForm({ currentShift }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const NewShiftSchema = Yup.object().shape({
    name: Yup.string().required('Name is required'),
    description: Yup.string().nullable(),
    startTime: Yup.string().required('Start time is required'),
    endTime: Yup.string().required('End time is required'),
    shiftType: Yup.string().required('Shift type is required'),
    isRepeating: Yup.boolean().required(),
    repeatDays: Yup.string().nullable(),
    checkInAllowedMinutesBefore: Yup.number().min(0).required('Required'),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentShift?.name || '',
      description: currentShift?.description || '',
      startTime: currentShift?.startTime || '08:00',
      endTime: currentShift?.endTime || '17:00',
      shiftType: currentShift?.shiftType || 'Normal',
      isRepeating: currentShift?.isRepeating || false,
      repeatDays: currentShift?.repeatDays || '',
      checkInAllowedMinutesBefore: currentShift?.checkInAllowedMinutesBefore ?? 15,
    }),
    [currentShift]
  );

  const methods = useForm({
    resolver: yupResolver(NewShiftSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        startTime: data.startTime,
        endTime: data.endTime,
        shiftType: data.shiftType,
        isRepeating: data.isRepeating,
        repeatDays: data.repeatDays || undefined,
        checkInAllowedMinutesBefore: data.checkInAllowedMinutesBefore,
      };

      if (currentShift) {
        await updateShift(currentShift.id, payload);
        enqueueSnackbar('Update success!');
      } else {
        await createShift(payload);
        enqueueSnackbar('Create success!');
      }
      router.push(paths.dashboard.shift.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar(currentShift ? 'Update failed!' : 'Create failed!', { variant: 'error' });
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
              <RHFTextField name="name" label="Shift Name" />

              <RHFSelect name="shiftType" label="Shift Type">
                <MenuItem value="Main">Chính</MenuItem>
                <MenuItem value="Extra">Phụ</MenuItem>
              </RHFSelect>

              <RHFTextField name="startTime" label="Start Time" type="time" InputLabelProps={{ shrink: true }} />

              <RHFTextField name="endTime" label="End Time" type="time" InputLabelProps={{ shrink: true }} />

              <RHFTextField
                name="checkInAllowedMinutesBefore"
                label="Check-in Allowed Minutes Before"
                type="number"
              />

              <RHFTextField name="repeatDays" label="Repeat Days (e.g. 1,2,3,4,5)" />
            </Box>

            <Stack spacing={2} sx={{ mt: 3 }}>
              <RHFTextField name="description" label="Description" multiline rows={3} />

              <RHFSwitch name="isRepeating" label="Repeating Shift" />
            </Stack>

            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                {!currentShift ? 'Create Shift' : 'Save Changes'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
