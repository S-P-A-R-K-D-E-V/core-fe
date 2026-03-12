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

import { IShiftTemplate } from 'src/types/corecms-api';
import { createShiftTemplate, updateShiftTemplate } from 'src/api/attendance';

// ----------------------------------------------------------------------

type Props = {
  currentTemplate?: IShiftTemplate;
};

export default function ShiftTemplateNewEditForm({ currentTemplate }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const NewTemplateSchema = Yup.object().shape({
    name: Yup.string().required('Name is required'),
    description: Yup.string().nullable(),
    shiftType: Yup.string().required('Shift type is required'),
    color: Yup.string().nullable(),
    isActive: Yup.boolean(),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentTemplate?.name || '',
      description: currentTemplate?.description || '',
      shiftType: currentTemplate?.shiftType || 'Main',
      color: currentTemplate?.color || '#1976d2',
      isActive: currentTemplate?.isActive ?? true,
    }),
    [currentTemplate]
  );

  const methods = useForm({
    resolver: yupResolver(NewTemplateSchema),
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
        shiftType: data.shiftType,
        color: data.color || undefined,
        isActive: data.isActive ?? true,
      };

      if (currentTemplate) {
        await updateShiftTemplate(currentTemplate.id, payload);
        enqueueSnackbar('Update success!');
      } else {
        await createShiftTemplate(payload);
        enqueueSnackbar('Create success!');
      }
      router.push(paths.dashboard.shift.templates.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar(currentTemplate ? 'Update failed!' : 'Create failed!', { variant: 'error' });
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
              <RHFTextField name="name" label="Template Name" />

              <RHFSelect name="shiftType" label="Shift Type">
                <MenuItem value="Main">Chính</MenuItem>
                <MenuItem value="Extra">Phụ</MenuItem>
              </RHFSelect>

              <RHFTextField
                name="color"
                label="Color"
                type="color"
                InputLabelProps={{ shrink: true }}
              />

              <Box />
            </Box>

            <Stack spacing={2} sx={{ mt: 3 }}>
              <RHFTextField name="description" label="Description" multiline rows={3} />

              {currentTemplate && <RHFSwitch name="isActive" label="Active" />}
            </Stack>

            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                {!currentTemplate ? 'Create Template' : 'Save Changes'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
