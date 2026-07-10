'use client';

import * as Yup from 'yup';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Card from '@mui/material/Card';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
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
import FormProvider, { RHFTextField, RHFSwitch } from 'src/components/hook-form';
import { TableHeadCustom, TableNoData } from 'src/components/table';
import { fPercent } from 'src/utils/format-number';

import { IShareholder } from 'src/types/corecms-api';
import {
  getShareholders,
  createShareholder,
  updateShareholder,
  deleteShareholder,
} from 'src/api/shareholders';

import RevenueChannelTab from './revenue-channel-tab';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên cổ đông' },
  { id: 'equityPercent', label: 'Tỷ lệ sở hữu', width: 140, align: 'right' as const },
  { id: 'user', label: 'Tài khoản', width: 180 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: '', width: 88 },
];

const Schema = Yup.object().shape({
  name: Yup.string().required('Tên cổ đông là bắt buộc'),
  equityPercent: Yup.number()
    .typeError('Tỷ lệ phải là số')
    .min(0, 'Tối thiểu 0%')
    .max(100, 'Tối đa 100%')
    .required('Tỷ lệ sở hữu là bắt buộc'),
  isActive: Yup.boolean().default(true),
  note: Yup.string().nullable().default(null),
});

type FormValuesProps = Yup.InferType<typeof Schema>;

export default function ShareholderListView() {
  const { enqueueSnackbar } = useSnackbar();
  const dialog = useBoolean();
  const confirm = useBoolean();

  const [tab, setTab] = useState('shareholders');
  const [shareholders, setShareholders] = useState<IShareholder[]>([]);
  const [editing, setEditing] = useState<IShareholder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getShareholders();
      setShareholders(result);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải danh sách cổ đông', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalActivePercent = shareholders
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + s.equityPercent, 0);

  const defaultValues = useMemo(
    () => ({
      name: editing?.name || '',
      equityPercent: editing?.equityPercent ?? 0,
      isActive: editing?.isActive ?? true,
      note: editing?.note || null,
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

  const handleOpenEdit = (row: IShareholder) => {
    setEditing(row);
    dialog.onTrue();
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (editing) {
        await updateShareholder(editing.id, {
          name: data.name,
          equityPercent: data.equityPercent,
          userId: editing.userId,
          isActive: data.isActive,
          note: data.note,
        });
        enqueueSnackbar('Cập nhật thành công!');
      } else {
        await createShareholder({
          name: data.name,
          equityPercent: data.equityPercent,
          note: data.note,
        });
        enqueueSnackbar('Tạo thành công!');
      }
      dialog.onFalse();
      fetchData();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Có lỗi xảy ra — kiểm tra tổng tỷ lệ không vượt 100%', { variant: 'error' });
    }
  });

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await deleteShareholder(deleteId);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Cổ đông đã có giao dịch — chỉ có thể ngừng hoạt động', { variant: 'error' });
    } finally {
      setDeleteId(null);
      confirm.onFalse();
    }
  }, [deleteId, enqueueSnackbar, fetchData, confirm]);

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth="lg">
        <CustomBreadcrumbs
          heading="Cổ đông & Kênh thu tiền"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Hoạch toán cổ đông' },
          ]}
          action={
            tab === 'shareholders' && (
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={handleOpenCreate}
              >
                Thêm cổ đông
              </Button>
            )
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab value="shareholders" label="Cổ đông" />
          <Tab value="channels" label="Kênh thu tiền" />
        </Tabs>

        {tab === 'shareholders' && (
          <>
            {totalActivePercent !== 100 && shareholders.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Tổng tỷ lệ sở hữu đang là {fPercent(totalActivePercent)} — cần đủ 100% để chốt sổ
                chính xác.
              </Alert>
            )}

            <Card>
              <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
                <Scrollbar>
                  <Table sx={{ minWidth: 700 }}>
                    <TableHeadCustom headLabel={TABLE_HEAD} rowCount={shareholders.length} />
                    <TableBody>
                      {shareholders.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{row.name}</TableCell>
                          <TableCell align="right">
                            <Label variant="soft" color="info">
                              {fPercent(row.equityPercent)}
                            </Label>
                          </TableCell>
                          <TableCell>{row.userName || '—'}</TableCell>
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
                      <TableNoData notFound={!shareholders.length} />
                    </TableBody>
                  </Table>
                </Scrollbar>
              </TableContainer>
            </Card>
          </>
        )}

        {tab === 'channels' && <RevenueChannelTab shareholders={shareholders} />}
      </Container>

      <Dialog open={dialog.value} onClose={dialog.onFalse} maxWidth="xs" fullWidth>
        <FormProvider methods={methods} onSubmit={onSubmit}>
          <DialogTitle>{editing ? 'Sửa cổ đông' : 'Thêm cổ đông'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <RHFTextField name="name" label="Tên cổ đông" />
              <RHFTextField
                name="equityPercent"
                label="Tỷ lệ sở hữu (%)"
                type="number"
                helperText="Đổi tỷ lệ chỉ áp dụng cho kỳ chốt sổ sau — kỳ đã chốt giữ nguyên"
              />
              <RHFTextField name="note" label="Ghi chú" multiline rows={2} />
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
        title="Xóa cổ đông"
        content="Chỉ xóa được cổ đông chưa có giao dịch. Bạn có chắc muốn xóa?"
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Xóa
          </Button>
        }
      />
    </RoleBasedGuard>
  );
}
