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
import TableContainer from '@mui/material/TableContainer';
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

import type { IHolidayPolicy } from 'src/types/corecms-api';

import {
  createHolidayPolicy,
  deleteHolidayPolicy,
  getAllHolidayPolicies,
  updateHolidayPolicy,
} from 'src/api/holidayPolicy';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên ngày lễ', width: 200 },
  { id: 'period', label: 'Thời gian', width: 200 },
  { id: 'bonusType', label: 'Loại thưởng', width: 150 },
  { id: 'bonusValue', label: 'Giá trị', width: 150 },
  { id: 'sunday', label: 'CN tính', width: 100 },
  { id: 'status', label: 'Trạng thái', width: 100 },
  { id: 'actions', label: 'Hành động', width: 120 },
];

const BONUS_TYPES = [
  { value: 'Percentage', label: 'Theo %' },
  { value: 'Multiplier', label: 'Nhân hệ số' },
  { value: 'FixedAmount', label: 'Tiền cố định' },
  { value: 'Combined', label: 'Kết hợp' },
];

// ----------------------------------------------------------------------

export default function HolidayPolicyListView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [policies, setPolicies] = useState<IHolidayPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<IHolidayPolicy | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    fromDate: '',
    toDate: '',
    bonusType: 'Percentage',
    percentageValue: 0,
    multiplierValue: 0,
    fixedAmountValue: 0,
    applyOnSunday: true,
    isActive: true,
    description: '',
  });

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllHolidayPolicies();
      setPolicies(data);
    } catch (error) {
      console.error('Error fetching holiday policies:', error);
      enqueueSnackbar('Không thể tải danh sách chính sách ngày lễ', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleOpenDialog = (policy?: IHolidayPolicy) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        name: policy.name,
        fromDate: policy.fromDate,
        toDate: policy.toDate,
        bonusType: policy.bonusType,
        percentageValue: policy.percentageValue || 0,
        multiplierValue: policy.multiplierValue || 0,
        fixedAmountValue: policy.fixedAmountValue || 0,
        applyOnSunday: policy.applyOnSunday,
        isActive: policy.isActive,
        description: policy.description || '',
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        name: '',
        fromDate: '',
        toDate: '',
        bonusType: 'Percentage',
        percentageValue: 0,
        multiplierValue: 0,
        fixedAmountValue: 0,
        applyOnSunday: true,
        isActive: true,
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
        await updateHolidayPolicy(editingPolicy.id, formData);
        enqueueSnackbar('Cập nhật chính sách thành công');
      } else {
        await createHolidayPolicy(formData);
        enqueueSnackbar('Tạo chính sách thành công');
      }
      handleCloseDialog();
      fetchPolicies();
    } catch (error) {
      console.error('Error saving policy:', error);
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteHolidayPolicy(deleteConfirmId);
      enqueueSnackbar('Xóa thành công');
      setDeleteConfirmId(null);
      fetchPolicies();
    } catch (error) {
      console.error('Error deleting policy:', error);
      enqueueSnackbar('Có lỗi xảy ra khi xóa', { variant: 'error' });
      setDeleteConfirmId(null);
    }
  };

  const getBonusValueDisplay = (policy: IHolidayPolicy) => {
    switch (policy.bonusType) {
      case 'Percentage':
        return `${policy.percentageValue}%`;
      case 'Multiplier':
        return `x${policy.multiplierValue}`;
      case 'FixedAmount':
        return `${policy.fixedAmountValue?.toLocaleString()}đ`;
      case 'Combined':
        return 'Kết hợp';
      default:
        return '';
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Quản lý chính sách ngày lễ"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Quản lý lương', href: paths.dashboard.salary.root },
          { name: 'Chính sách ngày lễ' },
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
                      <tr key={policy.id}>
                        <td>{policy.name}</td>
                        <td>
                          {policy.fromDate} ~ {policy.toDate}
                        </td>
                        <td>{BONUS_TYPES.find((t) => t.value === policy.bonusType)?.label}</td>
                        <td>{getBonusValueDisplay(policy)}</td>
                        <td>{policy.applyOnSunday ? 'Có' : 'Không'}</td>
                        <td>
                          <Label color={policy.isActive ? 'success' : 'default'}>
                            {policy.isActive ? 'Kích hoạt' : 'Tạm dừng'}
                          </Label>
                        </td>
                        <td>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={() => handleOpenDialog(policy)}>
                              Sửa
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              onClick={() => setDeleteConfirmId(policy.id)}
                            >
                              Xóa
                            </Button>
                          </Stack>
                        </td>
                      </tr>
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
        <DialogTitle>{editingPolicy ? 'Cập nhật' : 'Thêm'} chính sách ngày lễ</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              label="Tên ngày lễ"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
            />

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
              select
              label="Loại thưởng"
              value={formData.bonusType}
              onChange={(e) => setFormData({ ...formData, bonusType: e.target.value })}
              fullWidth
            >
              {BONUS_TYPES.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            {formData.bonusType === 'Percentage' && (
              <TextField
                label="Giá trị % thưởng"
                type="number"
                value={formData.percentageValue}
                onChange={(e) =>
                  setFormData({ ...formData, percentageValue: Number(e.target.value) })
                }
                fullWidth
              />
            )}

            {formData.bonusType === 'Multiplier' && (
              <TextField
                label="Hệ số nhân"
                type="number"
                value={formData.multiplierValue}
                onChange={(e) =>
                  setFormData({ ...formData, multiplierValue: Number(e.target.value) })
                }
                fullWidth
              />
            )}

            {formData.bonusType === 'FixedAmount' && (
              <TextField
                label="Tiền thưởng cố định"
                type="number"
                value={formData.fixedAmountValue}
                onChange={(e) =>
                  setFormData({ ...formData, fixedAmountValue: Number(e.target.value) })
                }
                fullWidth
              />
            )}

            <TextField
              select
              label="Áp dụng ngày Chủ nhật"
              value={formData.applyOnSunday ? 'true' : 'false'}
              onChange={(e) =>
                setFormData({ ...formData, applyOnSunday: e.target.value === 'true' })
              }
              fullWidth
            >
              <MenuItem value="true">Có</MenuItem>
              <MenuItem value="false">Không</MenuItem>
            </TextField>

            <TextField
              select
              label="Trạng thái"
              value={formData.isActive ? 'true' : 'false'}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
              fullWidth
            >
              <MenuItem value="true">Kích hoạt</MenuItem>
              <MenuItem value="false">Tạm dừng</MenuItem>
            </TextField>

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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Xác nhận xóa</DialogTitle>
        <DialogContent>Bạn có chắc muốn xóa chính sách này?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Hủy</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
