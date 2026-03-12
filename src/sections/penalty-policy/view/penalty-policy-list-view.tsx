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

import type { IPenaltyPolicy } from 'src/types/corecms-api';

import {
  createPenaltyPolicy,
  deletePenaltyPolicy,
  getAllPenaltyPolicies,
  updatePenaltyPolicy,
} from 'src/api/penaltyPolicy';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên chính sách', width: 200 },
  { id: 'violationType', label: 'Loại vi phạm', width: 150 },
  { id: 'penaltyType', label: 'Loại phạt', width: 150 },
  { id: 'penaltyValue', label: 'Giá trị / Hệ số', width: 180 },
  { id: 'minMinutes', label: 'Số phút tối thiểu', width: 120 },
  { id: 'status', label: 'Trạng thái', width: 100 },
  { id: 'actions', label: 'Hành động', width: 120 },
];

const VIOLATION_TYPES = [
  { value: 'Late', label: 'Đi trễ' },
  { value: 'EarlyLeave', label: 'Về sớm' },
  { value: 'WrongShift', label: 'Sai ca' },
  { value: 'Absent', label: 'Vắng mặt' },
];

const PENALTY_TYPES = [
  { value: 'FixedAmount', label: 'Tiền cố định' },
  { value: 'Percentage', label: 'Theo % lương' },
  { value: 'PerHour', label: 'Theo giờ vi phạm' },
  { value: 'PerDay', label: 'Theo ngày vi phạm' },
];

// ----------------------------------------------------------------------

export default function PenaltyPolicyListView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [policies, setPolicies] = useState<IPenaltyPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<IPenaltyPolicy | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    violationType: 'Late',
    penaltyType: 'FixedAmount',
    penaltyValue: 0,
    hourlyCoefficient: undefined as number | undefined,
    minMinutes: 5,
    description: '',
  });

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllPenaltyPolicies();
      setPolicies(data);
    } catch (error) {
      console.error('Error fetching penalty policies:', error);
      enqueueSnackbar('Không thể tải danh sách chính sách chế tài', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleOpenDialog = (policy?: IPenaltyPolicy) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        name: policy.name,
        violationType: policy.violationType,
        penaltyType: policy.penaltyType,
        penaltyValue: policy.penaltyValue,
        hourlyCoefficient: policy.hourlyCoefficient,
        minMinutes: policy.minMinutes,
        description: policy.description || '',
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        name: '',
        violationType: 'Late',
        penaltyType: 'FixedAmount',
        penaltyValue: 0,
        hourlyCoefficient: undefined,
        minMinutes: 5,
        description: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingPolicy(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingPolicy) {
        await updatePenaltyPolicy(editingPolicy.id, formData);
        enqueueSnackbar('Cập nhật chính sách thành công');
      } else {
        await createPenaltyPolicy(formData);
        enqueueSnackbar('Tạo chính sách thành công');
      }
      handleCloseDialog();
      fetchPolicies();
    } catch (error) {
      console.error('Error saving policy:', error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa chính sách này?')) return;

    try {
      await deletePenaltyPolicy(id);
      enqueueSnackbar('Xóa thành công');
      fetchPolicies();
    } catch (error) {
      console.error('Error deleting policy:', error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const getPenaltyValueDisplay = (policy: IPenaltyPolicy) => {
    switch (policy.penaltyType) {
      case 'Percentage':
        return `${policy.penaltyValue}% lương`;
      case 'PerHour':
        if (policy.hourlyCoefficient != null) {
          return `×${policy.hourlyCoefficient} lương/giờ`;
        }
        return `${policy.penaltyValue.toLocaleString()}đ/giờ`;
      case 'PerDay':
        return `${policy.penaltyValue.toLocaleString()}đ/ngày`;
      case 'FixedAmount':
        return `${policy.penaltyValue.toLocaleString()}đ`;
      default:
        return policy.penaltyValue;
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Quản lý chính sách chế tài"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Quản lý lương', href: paths.dashboard.salary.root },
          { name: 'Chính sách chế tài' },
        ]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => handleOpenDialog()}
          >
            Thêm chính sách
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
                    {policies.map((policy) => (
                      <TableRow key={policy.id}>
                        <TableCell>{policy.name}</TableCell>
                        <TableCell>
                          {VIOLATION_TYPES.find((t) => t.value === policy.violationType)?.label}
                        </TableCell>
                        <TableCell>
                          {PENALTY_TYPES.find((t) => t.value === policy.penaltyType)?.label}
                        </TableCell>
                        <TableCell>{getPenaltyValueDisplay(policy)}</TableCell>
                        <TableCell>{policy.minMinutes} phút</TableCell>
                        <TableCell>
                          <Label color={policy.isActive ? 'success' : 'default'}>
                            {policy.isActive ? 'Kích hoạt' : 'Tạm dừng'}
                          </Label>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={() => handleOpenDialog(policy)}>
                              Sửa
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleDelete(policy.id)}
                            >
                              Xóa
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {policies.length === 0 && <TableNoData notFound />}
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>

            <TablePaginationCustom
              count={policies.length}
              page={table.page}
              rowsPerPage={table.rowsPerPage}
              onPageChange={table.onChangePage}
              onRowsPerPageChange={table.onChangeRowsPerPage}
            />
          </>
        )}
      </Card>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingPolicy ? 'Cập nhật' : 'Thêm'} chính sách chế tài</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Tên chính sách"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
            />

            <TextField
              select
              label="Loại vi phạm"
              value={formData.violationType}
              onChange={(e) => setFormData({ ...formData, violationType: e.target.value })}
              fullWidth
            >
              {VIOLATION_TYPES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Loại phạt"
              value={formData.penaltyType}
              onChange={(e) =>
                setFormData({ ...formData, penaltyType: e.target.value, hourlyCoefficient: undefined })
              }
              fullWidth
            >
              {PENALTY_TYPES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            {formData.penaltyType === 'PerHour' ? (
              <>
                <TextField
                  label="Hệ số nhân lương theo giờ"
                  type="number"
                  value={formData.hourlyCoefficient ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hourlyCoefficient: e.target.value !== '' ? Number(e.target.value) : undefined,
                      penaltyValue: 0,
                    })
                  }
                  inputProps={{ step: '0.1', min: '0' }}
                  helperText="Ví dụ: nhập 2 = phạt (phút vi phạm ÷ 60) × lương/giờ × 2. Để trống để dùng giá trị cố định."
                  fullWidth
                />
                {formData.hourlyCoefficient == null && (
                  <TextField
                    label="Giá trị phạt (đ/giờ)"
                    type="number"
                    value={formData.penaltyValue}
                    onChange={(e) =>
                      setFormData({ ...formData, penaltyValue: Number(e.target.value) })
                    }
                    helperText="Giá trị phạt cố định theo giờ khi không dùng hệ số lương"
                    fullWidth
                  />
                )}
              </>
            ) : (
              <TextField
                label={
                  formData.penaltyType === 'Percentage'
                    ? 'Giá trị phạt (%)'
                    : 'Giá trị phạt (đ)'
                }
                type="number"
                value={formData.penaltyValue}
                onChange={(e) =>
                  setFormData({ ...formData, penaltyValue: Number(e.target.value) })
                }
                fullWidth
              />
            )}

            <TextField
              label="Số phút tối thiểu áp dụng"
              type="number"
              value={formData.minMinutes}
              onChange={(e) => setFormData({ ...formData, minMinutes: Number(e.target.value) })}
              helperText="Ví dụ: Đi trễ 5 phút trở lên sẽ bị phạt"
              fullWidth
            />

            <TextField
              label="Mô tả"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Hủy</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingPolicy ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
