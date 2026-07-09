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
import FormProvider, { RHFTextField, RHFSelect, RHFSwitch } from 'src/components/hook-form';
import { TableHeadCustom, TableNoData } from 'src/components/table';

import { ExpenseType, IExpenseCategory } from 'src/types/corecms-api';
import {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from 'src/api/expenses';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên danh mục' },
  { id: 'type', label: 'Loại', width: 160 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: '', width: 88 },
];

const TYPE_LABEL: Record<ExpenseType, string> = {
  Fixed: 'Cố định',
  Variable: 'Biến đổi',
  Income: 'Khoản thu',
  Expense: 'Chi phí',
};

const TYPE_COLOR: Record<ExpenseType, 'warning' | 'info' | 'success' | 'default'> = {
  Fixed: 'warning',
  Variable: 'info',
  Income: 'success',
  Expense: 'default',
};

const Schema = Yup.object().shape({
  name: Yup.string().required('Tên danh mục là bắt buộc'),
  type: Yup.string().oneOf(['Fixed', 'Variable', 'Income', 'Expense']).required(),
  isActive: Yup.boolean().default(true),
});

type FormValuesProps = Yup.InferType<typeof Schema>;

export default function ExpenseCategoryListView() {
  const { enqueueSnackbar } = useSnackbar();
  const dialog = useBoolean();
  const confirm = useBoolean();

  const [categories, setCategories] = useState<IExpenseCategory[]>([]);
  const [editing, setEditing] = useState<IExpenseCategory | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getExpenseCategories();
      setCategories(result);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải danh mục chi phí', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const defaultValues = useMemo(
    () => ({
      name: editing?.name || '',
      type: editing?.type || 'Fixed',
      isActive: editing?.isActive ?? true,
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

  const handleOpenEdit = (category: IExpenseCategory) => {
    setEditing(category);
    dialog.onTrue();
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (editing) {
        await updateExpenseCategory(editing.id, {
          name: data.name,
          type: data.type as ExpenseType,
          isActive: data.isActive,
        });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createExpenseCategory({ name: data.name, type: data.type as ExpenseType });
        enqueueSnackbar('Tạo thành công!');
      }
      dialog.onFalse();
      fetchData();
    } catch (error) {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  });

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteExpenseCategory(deleteId);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Không thể xóa danh mục đang có chi phí', { variant: 'error' });
    } finally {
      setDeleteId(null);
      confirm.onFalse();
    }
  }, [deleteId, enqueueSnackbar, fetchData, confirm]);

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth="md">
        <CustomBreadcrumbs
          heading="Danh mục chi phí"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Chi phí', href: paths.dashboard.pos.expense.list },
            { name: 'Danh mục' },
          ]}
          action={
            <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={handleOpenCreate}>
              Thêm danh mục
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table sx={{ minWidth: 600 }}>
                <TableHeadCustom headLabel={TABLE_HEAD} rowCount={categories.length} />
                <TableBody>
                  {categories.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>
                        <Label variant="soft" color={TYPE_COLOR[row.type] ?? 'info'}>
                          {TYPE_LABEL[row.type] ?? row.type}
                        </Label>
                      </TableCell>
                      <TableCell>
                        <Label variant="soft" color={row.isActive ? 'success' : 'error'}>
                          {row.isActive ? 'Hoạt động' : 'Ngưng'}
                        </Label>
                      </TableCell>
                      <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                        <Tooltip title="Sửa">
                          <IconButton onClick={() => handleOpenEdit(row)}>
                            <Iconify icon="solar:pen-bold" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Xóa">
                          <IconButton
                            color="error"
                            onClick={() => {
                              setDeleteId(row.id);
                              confirm.onTrue();
                            }}
                          >
                            <Iconify icon="solar:trash-bin-trash-bold" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableNoData notFound={!categories.length} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        </Card>
      </Container>

      <Dialog open={dialog.value} onClose={dialog.onFalse} maxWidth="xs" fullWidth>
        <FormProvider methods={methods} onSubmit={onSubmit}>
          <DialogTitle>{editing ? 'Sửa danh mục' : 'Thêm danh mục'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <RHFTextField name="name" label="Tên danh mục" />
              <RHFSelect name="type" label="Loại chi phí">
                <MenuItem value="Fixed">Cố định (dùng để tính điểm hòa vốn)</MenuItem>
                <MenuItem value="Variable">Biến đổi</MenuItem>
                <MenuItem value="Income">Khoản thu</MenuItem>
                <MenuItem value="Expense">Chi phí</MenuItem>
              </RHFSelect>
              {editing && <RHFSwitch name="isActive" label="Đang hoạt động" />}
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
          setDeleteId(null);
        }}
        title="Xóa"
        content="Bạn có chắc muốn xóa danh mục này?"
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Xóa
          </Button>
        }
      />
    </RoleBasedGuard>
  );
}
