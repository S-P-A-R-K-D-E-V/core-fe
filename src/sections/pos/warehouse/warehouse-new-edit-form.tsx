'use client';

import * as Yup from 'yup';
import { useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Unstable_Grid2';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField } from 'src/components/hook-form';

import { IWarehouse } from 'src/types/corecms-api';
import { createWarehouse, updateWarehouse } from 'src/api/warehouses';

// ----------------------------------------------------------------------

type Props = { currentWarehouse?: IWarehouse };

export default function WarehouseNewEditForm({ currentWarehouse }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const Schema = Yup.object().shape({
    name: Yup.string().required('Tên kho là bắt buộc'),
    address: Yup.string().default(''),
    phone: Yup.string().default(''),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentWarehouse?.name || '',
      address: currentWarehouse?.address || '',
      phone: currentWarehouse?.phone || '',
    }),
    [currentWarehouse]
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const { reset, handleSubmit, formState: { isSubmitting } } = methods;

  useEffect(() => {
    if (currentWarehouse) reset(defaultValues);
  }, [currentWarehouse, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (currentWarehouse) {
        await updateWarehouse(currentWarehouse.id, { name: data.name, address: data.address || undefined, phone: data.phone || undefined });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createWarehouse({ name: data.name, address: data.address || undefined, phone: data.phone || undefined });
        enqueueSnackbar('Tạo thành công!');
      }
      router.push(paths.dashboard.pos.warehouse.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid xs={12} md={8}>
          <Card sx={{ p: 3 }}>
            <Box rowGap={3} columnGap={2} display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}>
              <RHFTextField name="name" label="Tên kho" />
              <RHFTextField name="phone" label="Số điện thoại" />
            </Box>
            <RHFTextField name="address" label="Địa chỉ" multiline rows={3} sx={{ mt: 3 }} />
            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                {!currentWarehouse ? 'Tạo kho' : 'Lưu thay đổi'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
