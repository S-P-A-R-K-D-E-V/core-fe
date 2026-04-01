'use client';

import { useCallback, useEffect, useState } from 'react';

import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import {
  TableHeadCustom,
  TableNoData,
  TablePaginationCustom,
} from 'src/components/table';

import type { ISalaryConfiguration } from 'src/types/corecms-api';

import {
  createSalaryConfiguration,
  deleteSalaryConfiguration,
  getAllSalaryConfigurations,
  updateSalaryConfiguration,
} from 'src/api/salary';
import { getAllUsers } from 'src/api/users';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'userName', label: 'Nhân viên', width: 200 },
  { id: 'salaryType', label: 'Hình thức', width: 120 },
  { id: 'amount', label: 'Mức lương', width: 150 },
  { id: 'effectiveFrom', label: 'Từ ngày', width: 120 },
  { id: 'effectiveTo', label: 'Đến ngày', width: 120 },
  { id: 'note', label: 'Ghi chú', width: 200 },
  { id: 'createdAt', label: 'Ngày tạo', width: 150 },
  { id: 'actions', label: '', width: 80 },
];

const SALARY_TYPES = [
  { value: 'PerShift', label: 'Theo ca' },
  { value: 'Hourly', label: 'Theo giờ' },
  { value: 'Monthly', label: 'Theo tháng' },
];

const EMPTY_FORM = {
  userId: '',
  salaryType: 'Monthly',
  amount: '',
  effectiveFrom: new Date().toISOString(),
  effectiveTo: '',
  note: '',
};

// ----------------------------------------------------------------------

export default function SalaryConfigurationView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [salaries, setSalaries] = useState<ISalaryConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);

  // Server-side pagination
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Create dialog
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [userInputValue, setUserInputValue] = useState('');

  // Edit dialog
  const [editRow, setEditRow] = useState<ISalaryConfiguration | null>(null);
  const [editFormData, setEditFormData] = useState({
    salaryType: 'Monthly',
    amount: '',
    effectiveFrom: '',
    effectiveTo: '',
    note: '',
  });

  // Delete dialog
  const [deleteRow, setDeleteRow] = useState<ISalaryConfiguration | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSalaries = useCallback(async (page: number, size: number) => {
    try {
      setLoading(true);
      const data = await getAllSalaryConfigurations({ pageNumber: page, pageSize: size });
      setSalaries(data.items);
      setTotalCount(data.totalCount);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchSalaries(pageNumber, pageSize);
  }, [fetchSalaries, pageNumber, pageSize]);

  useEffect(() => {
    getAllUsers().then(setUsers).catch(console.error);
  }, []);

  // --- Create ---
  const handleOpenCreateDialog = () => {
    setOpenCreateDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
    setFormData(EMPTY_FORM);
    setUserInputValue('');
  };

  const handleSubmitCreate = async () => {
    try {
      await createSalaryConfiguration({
        ...formData,
        amount: parseFloat(formData.amount),
        effectiveTo: formData.effectiveTo || undefined,
      });
      enqueueSnackbar('Tạo cấu hình lương thành công!', { variant: 'success' });
      handleCloseCreateDialog();
      fetchSalaries(pageNumber, pageSize);
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Tạo cấu hình lương thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  // --- Edit ---
  const handleOpenEdit = (row: ISalaryConfiguration) => {
    setEditRow(row);
    setEditFormData({
      salaryType: row.salaryType,
      amount: String(row.amount),
      effectiveFrom: row.effectiveFrom?.split('T')[0] ?? '',
      effectiveTo: row.effectiveTo?.split('T')[0] ?? '',
      note: row.note ?? '',
    });
  };

  const handleCloseEdit = () => {
    setEditRow(null);
  };

  const handleSubmitEdit = async () => {
    if (!editRow) return;
    try {
      await updateSalaryConfiguration(editRow.id, {
        salaryType: editFormData.salaryType,
        amount: parseFloat(editFormData.amount),
        effectiveFrom: editFormData.effectiveFrom,
        effectiveTo: editFormData.effectiveTo || undefined,
        note: editFormData.note || undefined,
      });
      enqueueSnackbar('Cập nhật cấu hình lương thành công!', { variant: 'success' });
      handleCloseEdit();
      fetchSalaries(pageNumber, pageSize);
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Cập nhật cấu hình lương thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  // --- Delete ---
  const handleOpenDelete = (row: ISalaryConfiguration) => {
    setDeleteRow(row);
  };

  const handleCloseDelete = () => {
    setDeleteRow(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteRow) return;
    try {
      setDeleting(true);
      await deleteSalaryConfiguration(deleteRow.id);
      enqueueSnackbar('Xóa cấu hình lương thành công!', { variant: 'success' });
      handleCloseDelete();
      fetchSalaries(pageNumber, pageSize);
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Xóa cấu hình lương thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  // --- Helpers ---
  const formatSalaryType = (type: string) => {
    const found = SALARY_TYPES.find((t) => t.value === type);
    return found ? found.label : type;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Quản lý cấu hình lương"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Lương' },
          { name: 'Cấu hình' },
        ]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={handleOpenCreateDialog}
          >
            Thêm cấu hình lương
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <>
            <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
              <Scrollbar>
                <Table size="medium">
                  <TableHeadCustom headLabel={TABLE_HEAD} />

                  <TableBody>
                    {salaries.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: '16px' }}>{row.userName}</td>
                        <td style={{ padding: '16px' }}>
                          <Label color="info">{formatSalaryType(row.salaryType)}</Label>
                        </td>
                        <td style={{ padding: '16px' }}>{formatCurrency(row.amount)}</td>
                        <td style={{ padding: '16px' }}>{formatDate(row.effectiveFrom)}</td>
                        <td style={{ padding: '16px' }}>{formatDate(row.effectiveTo)}</td>
                        <td style={{ padding: '16px' }}>{row.note || '-'}</td>
                        <td style={{ padding: '16px' }}>{formatDate(row.createdAt)}</td>
                        <td style={{ padding: '8px' }}>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Chỉnh sửa">
                              <IconButton size="small" onClick={() => handleOpenEdit(row)}>
                                <Iconify icon="solar:pen-bold" width={16} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Xóa">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleOpenDelete(row)}
                              >
                                <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </td>
                      </tr>
                    ))}

                    {salaries.length === 0 && <TableNoData notFound />}
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>

            <TablePaginationCustom
              count={totalCount}
              page={pageNumber - 1}
              rowsPerPage={pageSize}
              onPageChange={(_, newPage) => setPageNumber(newPage + 1)}
              onRowsPerPageChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPageNumber(1);
              }}
            />
          </>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Thêm cấu hình lương mới</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 2 }}>
            <Autocomplete
              fullWidth
              options={users}
              getOptionLabel={(option) => `${option.fullName} - ${option.email}`}
              value={users.find((u) => u.id === formData.userId) || null}
              onChange={(_, newValue) =>
                setFormData({ ...formData, userId: newValue?.id ?? '' })
              }
              inputValue={userInputValue}
              onInputChange={(_, newInputValue) => setUserInputValue(newInputValue)}
              renderInput={(params) => <TextField {...params} label="Nhân viên" />}
            />

            <TextField
              select
              fullWidth
              label="Hình thức lương"
              value={formData.salaryType}
              onChange={(e) => setFormData({ ...formData, salaryType: e.target.value })}
            >
              {SALARY_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              type="number"
              label="Mức lương (VND)"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />

            <DatePicker
              label="Hiệu lực từ ngày"
              value={parseDateStr(formData.effectiveFrom)}
              onChange={(val) => setFormData({ ...formData, effectiveFrom: toDateStr(val) })}
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true } }}
            />

            <DatePicker
              label="Hiệu lực đến ngày (tuỳ chọn)"
              value={parseDateStr(formData.effectiveTo)}
              onChange={(val) => setFormData({ ...formData, effectiveTo: toDateStr(val) })}
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true } }}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Ghi chú"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog}>Huỷ</Button>
          <Button
            variant="contained"
            onClick={handleSubmitCreate}
            disabled={!formData.userId || !formData.amount}
          >
            Tạo cấu hình
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Chỉnh sửa cấu hình lương</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 2 }}>
            <TextField
              select
              fullWidth
              label="Hình thức lương"
              value={editFormData.salaryType}
              onChange={(e) => setEditFormData({ ...editFormData, salaryType: e.target.value })}
            >
              {SALARY_TYPES.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              type="number"
              label="Mức lương (VND)"
              value={editFormData.amount}
              onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
            />

            <DatePicker
              label="Hiệu lực từ ngày"
              value={parseDateStr(editFormData.effectiveFrom)}
              onChange={(val) => setEditFormData({ ...editFormData, effectiveFrom: toDateStr(val) })}
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true } }}
            />

            <DatePicker
              label="Hiệu lực đến ngày (tuỳ chọn)"
              value={parseDateStr(editFormData.effectiveTo)}
              onChange={(val) => setEditFormData({ ...editFormData, effectiveTo: toDateStr(val) })}
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true } }}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Ghi chú"
              value={editFormData.note}
              onChange={(e) => setEditFormData({ ...editFormData, note: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit}>Huỷ</Button>
          <Button
            variant="contained"
            onClick={handleSubmitEdit}
            disabled={!editFormData.amount}
          >
            Lưu thay đổi
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteRow} onClose={handleCloseDelete} maxWidth="xs" fullWidth>
        <DialogTitle>Xác nhận xóa</DialogTitle>
        <DialogContent>
          <Typography>
            Bạn có chắc muốn xóa cấu hình lương của{' '}
            <strong>{deleteRow?.userName}</strong> không? Hành động này không thể hoàn tác.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete} disabled={deleting}>
            Huỷ
          </Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deleting}>
            {deleting ? 'Đang xóa...' : 'Xóa'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
