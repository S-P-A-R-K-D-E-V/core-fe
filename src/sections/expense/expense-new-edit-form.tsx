'use client';

import * as Yup from 'yup';
import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import MenuItem from '@mui/material/MenuItem';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';
import { RHFDatePicker } from 'src/components/hook-form/rhf-date-picker';

import { IExpense, IExpenseCategory } from 'src/types/corecms-api';
import { createExpense, updateExpense, getExpenseCategories } from 'src/api/expenses';

// ----------------------------------------------------------------------

type Props = {
  currentExpense?: IExpense;
};

export default function ExpenseNewEditForm({ currentExpense }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [categories, setCategories] = useState<IExpenseCategory[]>([]);

  useEffect(() => {
    getExpenseCategories(true).then(setCategories);
  }, []);

  const isReadOnly = Boolean(currentExpense?.sourceTemplateId);

  const Schema = Yup.object().shape({
    categoryId: Yup.string().required('Danh mục là bắt buộc'),
    amount: Yup.number().min(1, 'Số tiền phải lớn hơn 0').required('Số tiền là bắt buộc'),
    expenseDate: Yup.string().required('Ngày chi là bắt buộc'),
    note: Yup.string().default(''),
  });

  const defaultValues = useMemo(
    () => ({
      categoryId: currentExpense?.categoryId || '',
      amount: currentExpense?.amount || 0,
      expenseDate: currentExpense?.expenseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      note: currentExpense?.note || '',
    }),
    [currentExpense]
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (currentExpense) reset(defaultValues);
  }, [currentExpense, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (currentExpense) {
        await updateExpense(currentExpense.id, {
          categoryId: data.categoryId,
          amount: data.amount,
          expenseDate: data.expenseDate,
          note: data.note || undefined,
        });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createExpense({
          categoryId: data.categoryId,
          amount: data.amount,
          expenseDate: data.expenseDate,
          note: data.note || undefined,
        });
        enqueueSnackbar('Tạo thành công!');
      }
      router.push(paths.dashboard.pos.expense.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Card sx={{ p: 3 }}>
            {isReadOnly && (
              <Stack sx={{ mb: 2, color: 'warning.main', typography: 'body2' }}>
                Khoản chi này được sinh tự động từ chi phí định kỳ — sửa số tiền/danh mục tại mục Chi phí định kỳ.
              </Stack>
            )}
            <Stack spacing={3}>
              <RHFSelect name="categoryId" label="Danh mục chi phí" disabled={isReadOnly}>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name} (
                    {c.type === 'Fixed' ? 'Cố định' : c.type === 'Income' ? 'Khoản thu' : 'Biến đổi'})
                  </MenuItem>
                ))}
              </RHFSelect>

              <RHFTextField name="amount" label="Số tiền" type="number" disabled={isReadOnly} />

              <RHFDatePicker name="expenseDate" label="Ngày chi" />

              <RHFTextField name="note" label="Ghi chú" multiline rows={3} />
            </Stack>

            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                {!currentExpense ? 'Tạo chi phí' : 'Lưu thay đổi'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
