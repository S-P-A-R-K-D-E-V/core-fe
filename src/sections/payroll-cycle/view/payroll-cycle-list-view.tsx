'use client';

import { useCallback, useEffect, useState } from 'react';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';

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
  useTable,
} from 'src/components/table';

import type { IPayrollCycle } from 'src/types/corecms-api';

import {
  createPayrollCycle,
  getAllPayrollCycles,
  lockPayrollCycle,
  unlockPayrollCycle,
  updatePayrollCycle,
} from 'src/api/payrollCycle';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên chu kỳ', width: 200 },
  { id: 'cycleType', label: 'Loại', width: 120 },
  { id: 'period', label: 'Thời gian', width: 200 },
  { id: 'workDays', label: 'Công chuẩn', width: 100 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: 'actions', label: 'Hành động', width: 200 },
];

const CYCLE_TYPES = [
  { value: 'Monthly', label: 'Theo tháng' },
  { value: 'Custom', label: 'Tùy chỉnh' },
];

// ----------------------------------------------------------------------

export default function PayrollCycleListView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [cycles, setCycles] = useState<IPayrollCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCycle, setEditingCycle] = useState<IPayrollCycle | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    cycleType: 'Monthly',
    fromDate: '',
    toDate: '',
    standardWorkDays: 26,
  });

  const fetchCycles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllPayrollCycles();
      setCycles(data);
    } catch (error) {
      console.error('Error fetching payroll cycles:', error);
      enqueueSnackbar('Không thể tải danh sách chu kỳ lương', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  const handleOpenDialog = (cycle?: IPayrollCycle) => {
    if (cycle) {
      setEditingCycle(cycle);
      setFormData({
        name: cycle.name,
        cycleType: cycle.cycleType,
        fromDate: cycle.fromDate,
        toDate: cycle.toDate,
        standardWorkDays: cycle.standardWorkDays,
      });
    } else {
      setEditingCycle(null);
      setFormData({
        name: '',
        cycleType: 'Monthly',
        fromDate: '',
        toDate: '',
        standardWorkDays: 26,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCycle(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingCycle) {
        await updatePayrollCycle(editingCycle.id, formData);
        enqueueSnackbar('Cập nhật chu kỳ thành công');
      } else {
        await createPayrollCycle(formData);
        enqueueSnackbar('Tạo chu kỳ thành công');
      }
      handleCloseDialog();
      fetchCycles();
    } catch (error) {
      console.error('Error saving cycle:', error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleToggleLock = async (cycle: IPayrollCycle) => {
    try {
      if (cycle.isLocked) {
        await unlockPayrollCycle(cycle.id, { isLocked: false });
        enqueueSnackbar('Mở khóa chu kỳ thành công');
      } else {
        await lockPayrollCycle(cycle.id, { isLocked: true });
        enqueueSnackbar('Khóa chu kỳ thành công');
      }
      fetchCycles();
    } catch (error) {
      console.error('Error toggling lock:', error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Quản lý chu kỳ tính lương"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Quản lý lương', href: paths.dashboard.salary.root },
          { name: 'Chu kỳ lương' },
        ]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => handleOpenDialog()}
          >
            Thêm chu kỳ
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
                    {cycles.map((cycle) => (
                      <TableRow key={cycle.id}>
                        <TableCell>{cycle.name}</TableCell>
                        <TableCell>
                          {CYCLE_TYPES.find((t) => t.value === cycle.cycleType)?.label}
                        </TableCell>
                        <TableCell>
                          {cycle.fromDate} ~ {cycle.toDate}
                        </TableCell>
                        <TableCell>{cycle.standardWorkDays} ngày</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Label color={cycle.isLocked ? 'error' : 'success'}>
                              {cycle.isLocked ? 'Đã khóa' : 'Mở'}
                            </Label>
                            {cycle.isLocked && cycle.lockedByName && (
                              <Label variant="soft" color="warning">
                                {cycle.lockedByName}
                              </Label>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            {!cycle.isLocked && (
                              <Button size="small" onClick={() => handleOpenDialog(cycle)}>
                                Sửa
                              </Button>
                            )}
                            <Button
                              size="small"
                              color={cycle.isLocked ? 'success' : 'warning'}
                              variant="outlined"
                              onClick={() => handleToggleLock(cycle)}
                              startIcon={
                                <Iconify
                                  icon={cycle.isLocked ? 'solar:lock-unlocked-bold' : 'solar:lock-bold'}
                                />
                              }
                            >
                              {cycle.isLocked ? 'Mở khóa' : 'Khóa'}
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {cycles.length === 0 && <TableNoData notFound />}
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>

            <TablePaginationCustom
              count={cycles.length}
              page={table.page}
              rowsPerPage={table.rowsPerPage}
              onPageChange={table.onChangePage}
              onRowsPerPageChange={table.onChangeRowsPerPage}
            />
          </>
        )}
      </Card>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingCycle ? 'Cập nhật' : 'Thêm'} chu kỳ lương</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Tên chu kỳ"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ví dụ: Lương tháng 3/2026"
              fullWidth
            />

            <TextField
              select
              label="Loại chu kỳ"
              value={formData.cycleType}
              onChange={(e) => setFormData({ ...formData, cycleType: e.target.value })}
              fullWidth
            >
              {CYCLE_TYPES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction="row" spacing={2}>
              <DatePicker
                label="Từ ngày"
                value={parseDateStr(formData.fromDate)}
                onChange={(val) => setFormData({ ...formData, fromDate: toDateStr(val) })}
                format="dd/MM/yyyy"
                slotProps={{ textField: { fullWidth: true } }}
              />
              <DatePicker
                label="Đến ngày"
                value={parseDateStr(formData.toDate)}
                onChange={(val) => setFormData({ ...formData, toDate: toDateStr(val) })}
                format="dd/MM/yyyy"
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Stack>

            <TextField
              label="Số ngày công chuẩn"
              type="number"
              value={formData.standardWorkDays}
              onChange={(e) =>
                setFormData({ ...formData, standardWorkDays: Number(e.target.value) })
              }
              helperText="Số ngày công chuẩn trong chu kỳ này (dùng để tính % công)"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Hủy</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingCycle ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
