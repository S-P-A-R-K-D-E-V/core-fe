'use client';

import * as Yup from 'yup';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import Stack from '@mui/material/Stack';
import LoadingButton from '@mui/lab/LoadingButton';

import Label from 'src/components/label';
import { paths } from 'src/routes/paths';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import FormProvider, { RHFTextField, RHFSelect } from 'src/components/hook-form';
import { RHFDatePicker } from 'src/components/hook-form/rhf-date-picker';
import { TableHeadCustom, TableNoData } from 'src/components/table';
import { fCurrency } from 'src/utils/format-number';

import { IExpenseCategory, IRecurringExpenseTemplate } from 'src/types/corecms-api';
import { getExpenseCategories } from 'src/api/expenses';
import {
  getRecurringExpenseTemplates,
  createRecurringExpenseTemplate,
  updateRecurringExpenseTemplate,
  deactivateRecurringExpenseTemplate,
} from 'src/api/expenses';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên' },
  { id: 'categoryName', label: 'Danh mục' },
  { id: 'amount', label: 'Số tiền', align: 'right' as const },
  { id: 'recurrenceType', label: 'Chu kỳ', width: 100 },
  { id: 'validFrom', label: 'Từ ngày', width: 110 },
  { id: 'validTo', label: 'Đến ngày', width: 110 },
  { id: 'status', label: 'Trạng thái', width: 110 },
  { id: '', width: 88 },
];

const Schema = Yup.object().shape({
  categoryId: Yup.string().required('Danh mục là bắt buộc'),
  name: Yup.string().required('Tên là bắt buộc'),
  amount: Yup.number().min(1, 'Số tiền phải lớn hơn 0').required(),
  recurrenceType: Yup.string().oneOf(['Monthly', 'Yearly']).required(),
  validFrom: Yup.string().required('Ngày bắt đầu là bắt buộc'),
  validTo: Yup.string().default(''),
});

type FormValuesProps = Yup.InferType<typeof Schema>;

export default function RecurringTemplateListView() {
  const { enqueueSnackbar } = useSnackbar();
  const dialog = useBoolean();
  const confirm = useBoolean();

  const [templates, setTemplates] = useState<IRecurringExpenseTemplate[]>([]);
  const [categories, setCategories] = useState<IExpenseCategory[]>([]);
  const [editing, setEditing] = useState<IRecurringExpenseTemplate | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [templateResult, categoryResult] = await Promise.all([
        getRecurringExpenseTemplates(),
        getExpenseCategories(true),
      ]);
      setTemplates(templateResult);
      setCategories(categoryResult);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải chi phí định kỳ', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const defaultValues = useMemo(
    () => ({
      categoryId: editing?.categoryId || '',
      name: editing?.name || '',
      amount: editing?.amount || 0,
      recurrenceType: editing?.recurrenceType || 'Monthly',
      validFrom: editing?.validFrom?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      validTo: editing?.validTo?.slice(0, 10) || '',
    }),
    [editing]
  );

  const methods = useForm<FormValuesProps>({ resolver: yupResolver(Schema), defaultValues });
  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const handleOpenCreate = () => {
    setEditing(null);
    dialog.onTrue();
  };

  const handleOpenEdit = (template: IRecurringExpenseTemplate) => {
    setEditing(template);
    dialog.onTrue();
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        categoryId: data.categoryId,
        name: data.name,
        amount: data.amount,
        recurrenceType: data.recurrenceType as 'Monthly' | 'Yearly',
        validFrom: data.validFrom,
        validTo: data.validTo || undefined,
      };
      if (editing) {
        await updateRecurringExpenseTemplate(editing.id, { ...payload, isActive: editing.isActive });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createRecurringExpenseTemplate(payload);
        enqueueSnackbar('Tạo thành công!');
      }
      dialog.onFalse();
      fetchData();
    } catch (error) {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  const handleDeactivate = useCallback(async () => {
    if (!deactivateId) return;
    try {
      await deactivateRecurringExpenseTemplate(deactivateId);
      enqueueSnackbar('Đã ngưng chi phí định kỳ!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    } finally {
      setDeactivateId(null);
      confirm.onFalse();
    }
  }, [deactivateId, enqueueSnackbar, fetchData, confirm]);

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth="lg">
        <CustomBreadcrumbs
          heading="Chi phí định kỳ"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Chi phí', href: paths.dashboard.pos.expense.list },
            { name: 'Định kỳ' },
          ]}
          action={
            <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={handleOpenCreate}>
              Thêm chi phí định kỳ
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table sx={{ minWidth: 900 }}>
                <TableHeadCustom headLabel={TABLE_HEAD} rowCount={templates.length} />
                <TableBody>
                  {templates.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.categoryName}</TableCell>
                      <TableCell align="right">{fCurrency(row.amount)}</TableCell>
                      <TableCell>{row.recurrenceType === 'Monthly' ? 'Hàng tháng' : 'Hàng năm'}</TableCell>
                      <TableCell>{new Date(row.validFrom).toLocaleDateString('vi-VN')}</TableCell>
                      <TableCell>{row.validTo ? new Date(row.validTo).toLocaleDateString('vi-VN') : '—'}</TableCell>
                      <TableCell>
                        <Label variant="soft" color={row.isActive ? 'success' : 'error'}>
                          {row.isActive ? 'Hoạt động' : 'Đã ngưng'}
                        </Label>
                      </TableCell>
                      <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                        <Tooltip title="Sửa">
                          <IconButton onClick={() => handleOpenEdit(row)}>
                            <Iconify icon="solar:pen-bold" />
                          </IconButton>
                        </Tooltip>
                        {row.isActive && (
                          <Tooltip title="Ngưng">
                            <IconButton
                              color="error"
                              onClick={() => {
                                setDeactivateId(row.id);
                                confirm.onTrue();
                              }}
                            >
                              <Iconify icon="solar:pause-circle-bold" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableNoData notFound={!templates.length} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        </Card>
      </Container>

      <Dialog open={dialog.value} onClose={dialog.onFalse} maxWidth="sm" fullWidth>
        <FormProvider methods={methods} onSubmit={onSubmit}>
          <DialogTitle>{editing ? 'Sửa chi phí định kỳ' : 'Thêm chi phí định kỳ'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <RHFTextField name="name" label="Tên (VD: Tiền thuê nhà)" />
              <RHFSelect name="categoryId" label="Danh mục chi phí">
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </RHFSelect>
              <RHFTextField name="amount" label="Số tiền / kỳ" type="number" />
              <RHFSelect name="recurrenceType" label="Chu kỳ lặp">
                <MenuItem value="Monthly">Hàng tháng</MenuItem>
                <MenuItem value="Yearly">Hàng năm</MenuItem>
              </RHFSelect>
              <Stack direction="row" spacing={2}>
                <RHFDatePicker name="validFrom" label="Áp dụng từ ngày" />
                <RHFDatePicker name="validTo" label="Áp dụng đến ngày (để trống = không giới hạn)" />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={dialog.onFalse}>Hủy</Button>
            <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
              {editing ? 'Lưu' : 'Tạo'}
            </LoadingButton>
          </DialogActions>
        </FormProvider>
      </Dialog>

      <ConfirmDialog
        open={confirm.value}
        onClose={() => {
          confirm.onFalse();
          setDeactivateId(null);
        }}
        title="Ngưng chi phí định kỳ"
        content="Sau khi ngưng, hệ thống sẽ không tự sinh chi phí cho các kỳ tiếp theo. Tiếp tục?"
        action={
          <Button variant="contained" color="error" onClick={handleDeactivate}>
            Ngưng
          </Button>
        }
      />
    </RoleBasedGuard>
  );
}
