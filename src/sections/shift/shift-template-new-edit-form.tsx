'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
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
    cleaningBlock: Yup.string().nullable(),
    isActive: Yup.boolean(),
    // Ca hỗ trợ (chỉ ca phụ): bỏ trống = trả theo lương giờ của người làm như ca thường.
    breakMinutes: Yup.string()
      .nullable()
      .test('break', 'Từ 0 đến 120 phút', (v) => !v || (Number(v) >= 0 && Number(v) <= 120)),
    fixedHourlyRate: Yup.string()
      .nullable()
      .test('rate', 'Đơn giá phải lớn hơn 0', (v) => !v || Number(v) > 0),
    minimumPaidHours: Yup.string()
      .nullable()
      .test('min', 'Từ trên 0 đến 8 giờ', (v) => !v || (Number(v) > 0 && Number(v) <= 8))
      .test('needs-rate', 'Cần nhập đơn giá trước', function needsRate(v) {
        return !v || !!this.parent.fixedHourlyRate;
      }),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentTemplate?.name || '',
      description: currentTemplate?.description || '',
      shiftType: currentTemplate?.shiftType || 'Main',
      color: currentTemplate?.color || '#1976d2',
      cleaningBlock: currentTemplate?.cleaningBlock || '',
      isActive: currentTemplate?.isActive ?? true,
      breakMinutes: currentTemplate?.breakMinutes != null ? String(currentTemplate.breakMinutes) : '',
      fixedHourlyRate: currentTemplate?.fixedHourlyRate != null ? String(currentTemplate.fixedHourlyRate) : '',
      minimumPaidHours: currentTemplate?.minimumPaidHours != null ? String(currentTemplate.minimumPaidHours) : '',
    }),
    [currentTemplate]
  );

  const methods = useForm({
    resolver: yupResolver(NewTemplateSchema),
    defaultValues,
  });

  const {
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const isExtra = watch('shiftType') === 'Extra';

  const onSubmit = handleSubmit(async (data) => {
    try {
      const extra = data.shiftType === 'Extra';
      const payload = {
        name: data.name,
        description: data.description || undefined,
        shiftType: data.shiftType,
        color: data.color || undefined,
        cleaningBlock: data.cleaningBlock || null,
        isActive: data.isActive ?? true,
        // Bỏ trống = 0 (không có giờ nghỉ bố trí sẵn).
        breakMinutes: data.breakMinutes ? Number(data.breakMinutes) : 0,
        supportPay: {
          fixedHourlyRate: extra && data.fixedHourlyRate ? Number(data.fixedHourlyRate) : null,
          minimumPaidHours: extra && data.fixedHourlyRate && data.minimumPaidHours ? Number(data.minimumPaidHours) : null,
        },
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
        <Grid size={{ xs: 12, md: 8 }}>
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

              <RHFSelect name="cleaningBlock" label="Khung ca vệ sinh">
                <MenuItem value="">Không áp dụng</MenuItem>
                <MenuItem value="Morning">Sáng</MenuItem>
                <MenuItem value="Afternoon">Chiều</MenuItem>
                <MenuItem value="Evening">Tối</MenuItem>
              </RHFSelect>

              <RHFTextField
                name="breakMinutes"
                label="Phút nghỉ giữa ca"
                type="number"
                placeholder="30"
                helperText="Nội quy Điều 5: làm từ 6 giờ cần 30 phút nghỉ. Đặt ở đây thì hết cảnh báo khi xếp ca."
              />

              {isExtra && (
                <>
                  <RHFTextField
                    name="fixedHourlyRate"
                    label="Đơn giá ca hỗ trợ (đ/giờ)"
                    type="number"
                    placeholder="38500"
                    helperText="Bỏ trống = trả theo lương giờ của người làm. Có đơn giá = ca hỗ trợ (đăng lên chợ ca được)."
                  />
                  <RHFTextField
                    name="minimumPaidHours"
                    label="Giờ trả tối thiểu"
                    type="number"
                    placeholder="1.5"
                    inputProps={{ step: 0.5 }}
                    helperText="Có đi làm thì trả ít nhất số giờ này (quy chế: 1,5 giờ)."
                  />
                </>
              )}
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
