'use client';

import * as Yup from 'yup';
import { useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Unstable_Grid2';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField } from 'src/components/hook-form';

import { ISupplier } from 'src/types/corecms-api';
import { createSupplier, updateSupplier } from 'src/api/suppliers';

// ----------------------------------------------------------------------

type Props = {
  currentSupplier?: ISupplier;
};

export default function SupplierNewEditForm({ currentSupplier }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const Schema = Yup.object().shape({
    name: Yup.string().required('Tên nhà cung cấp là bắt buộc'),
    code: Yup.string().default(''),
    contactPerson: Yup.string().default(''),
    phone: Yup.string().default(''),
    email: Yup.string().email('Email không hợp lệ').default(''),
    address: Yup.string().default(''),
    taxCode: Yup.string().default(''),
    bankAccount: Yup.string().default(''),
    bankName: Yup.string().default(''),
    note: Yup.string().default(''),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentSupplier?.name || '',
      code: currentSupplier?.code || '',
      contactPerson: currentSupplier?.contactPerson || '',
      phone: currentSupplier?.phone || '',
      email: currentSupplier?.email || '',
      address: currentSupplier?.address || '',
      taxCode: currentSupplier?.taxCode || '',
      bankAccount: currentSupplier?.bankAccount || '',
      bankName: currentSupplier?.bankName || '',
      note: currentSupplier?.note || '',
    }),
    [currentSupplier]
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });

  const { reset, handleSubmit, formState: { isSubmitting } } = methods;

  useEffect(() => {
    if (currentSupplier) reset(defaultValues);
  }, [currentSupplier, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (currentSupplier) {
        await updateSupplier(currentSupplier.id, {
          name: data.name,
          code: data.code || undefined,
          contactPerson: data.contactPerson || undefined,
          phone: data.phone || undefined,
          email: data.email || undefined,
          address: data.address || undefined,
          taxCode: data.taxCode || undefined,
          bankAccount: data.bankAccount || undefined,
          bankName: data.bankName || undefined,
          note: data.note || undefined,
          isActive: currentSupplier.isActive,
        });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createSupplier({
          name: data.name,
          code: data.code || undefined,
          contactPerson: data.contactPerson || undefined,
          phone: data.phone || undefined,
          email: data.email || undefined,
          address: data.address || undefined,
          taxCode: data.taxCode || undefined,
          bankAccount: data.bankAccount || undefined,
          bankName: data.bankName || undefined,
          note: data.note || undefined,
        });
        enqueueSnackbar('Tạo thành công!');
      }
      router.push(paths.dashboard.pos.supplier.list);
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
            <Typography variant="h6" sx={{ mb: 3 }}>Thông tin nhà cung cấp</Typography>
            <Box rowGap={3} columnGap={2} display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }}>
              <RHFTextField name="name" label="Tên nhà cung cấp" />
              <RHFTextField name="code" label="Mã NCC" />
              <RHFTextField name="contactPerson" label="Người liên hệ" />
              <RHFTextField name="phone" label="Số điện thoại" />
              <RHFTextField name="email" label="Email" />
              <RHFTextField name="taxCode" label="Mã số thuế" />
            </Box>
            <RHFTextField name="address" label="Địa chỉ" sx={{ mt: 3 }} />
            <RHFTextField name="note" label="Ghi chú" multiline rows={3} sx={{ mt: 3 }} />
          </Card>
        </Grid>

        <Grid xs={12} md={4}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>Thông tin ngân hàng</Typography>
            <Stack spacing={3}>
              <RHFTextField name="bankName" label="Tên ngân hàng" />
              <RHFTextField name="bankAccount" label="Số tài khoản" />
            </Stack>

            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                {!currentSupplier ? 'Tạo NCC' : 'Lưu thay đổi'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
