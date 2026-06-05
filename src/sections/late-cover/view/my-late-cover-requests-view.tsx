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
  useTable,
} from 'src/components/table';

import type { ILateCoverRequest } from 'src/types/corecms-api';

import { getShiftAssignments } from 'src/api/attendance';
import { createLateCoverRequest, getMyLateCoverRequests } from 'src/api/lateCover';
import { getAllUsers } from 'src/api/users';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'lateStaff', label: 'Nhân viên đi muộn', width: 150 },
  { id: 'lateShift', label: 'Ca đi muộn', width: 160 },
  { id: 'coveringStaff', label: 'Nhân viên làm hộ', width: 150 },
  { id: 'coveringShift', label: 'Ca làm hộ', width: 160 },
  { id: 'coveringHours', label: 'Giờ làm hộ', width: 110 },
  { id: 'extraPay', label: 'Phụ cấp (VNĐ)', width: 130 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: 'reviewNote', label: 'Phản hồi', width: 180 },
];

// ----------------------------------------------------------------------

export default function MyLateCoverRequestsView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [requests, setRequests] = useState<ILateCoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [lateStaffAssignments, setLateStaffAssignments] = useState<any[]>([]);
  const [coveringAssignments, setCoveringAssignments] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    lateStaffId: '',
    coveringStaffId: '',
    lateStaffAssignmentId: '',
    coveringStaffAssignmentId: '',
    reason: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyLateCoverRequests();
      setRequests(data);
    } catch (error) {
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = async () => {
    try {
      const userData = await getAllUsers();
      setUsers(userData);
      setOpenDialog(true);
    } catch (error) {
      enqueueSnackbar('Không thể tải danh sách nhân viên', { variant: 'error' });
    }
  };

  const getRecentDateRange = () => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    return {
      from: lastMonth.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0],
    };
  };

  const handleLateStaffChange = async (staffId: string) => {
    setFormData((f) => ({ ...f, lateStaffId: staffId, lateStaffAssignmentId: '' }));
    if (!staffId) return;
    try {
      const { from, to } = getRecentDateRange();
      const assignments = await getShiftAssignments(from, to, staffId);
      setLateStaffAssignments(assignments);
    } catch {
      setLateStaffAssignments([]);
    }
  };

  const handleCoveringStaffChange = async (staffId: string) => {
    setFormData((f) => ({ ...f, coveringStaffId: staffId, coveringStaffAssignmentId: '' }));
    if (!staffId) return;
    try {
      const { from, to } = getRecentDateRange();
      const assignments = await getShiftAssignments(from, to, staffId);
      setCoveringAssignments(assignments);
    } catch {
      setCoveringAssignments([]);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({
      lateStaffId: '',
      coveringStaffId: '',
      lateStaffAssignmentId: '',
      coveringStaffAssignmentId: '',
      reason: '',
    });
    setLateStaffAssignments([]);
    setCoveringAssignments([]);
  };

  const handleSubmit = async () => {
    try {
      await createLateCoverRequest({
        lateStaffId: formData.lateStaffId,
        coveringStaffId: formData.coveringStaffId,
        lateStaffAssignmentId: formData.lateStaffAssignmentId,
        coveringStaffAssignmentId: formData.coveringStaffAssignmentId,
        reason: formData.reason || undefined,
      });
      enqueueSnackbar('Tạo yêu cầu làm hộ thành công!', { variant: 'success' });
      handleCloseDialog();
      fetchData();
    } catch (error: any) {
      const msg = error?.title || error?.message || 'Tạo yêu cầu thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Approved') return 'success';
    if (status === 'Rejected') return 'error';
    return 'warning';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'Approved') return 'Đã duyệt';
    if (status === 'Rejected') return 'Từ chối';
    return 'Chờ duyệt';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const formatCurrency = (amount: number) =>
    amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

  const isFormValid =
    formData.lateStaffId &&
    formData.coveringStaffId &&
    formData.lateStaffAssignmentId &&
    formData.coveringStaffAssignmentId;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Yêu cầu làm hộ của tôi"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Làm hộ' },
          { name: 'Yêu cầu của tôi' },
        ]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={handleOpenDialog}
          >
            Tạo yêu cầu làm hộ
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
                <Table size={table.dense ? 'small' : 'medium'}>
                  <TableHeadCustom headLabel={TABLE_HEAD} />
                  <TableBody>
                    {requests.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: '16px' }}>{row.lateStaffName}</td>
                        <td style={{ padding: '16px' }}>
                          {row.lateShiftName}
                          <Typography variant="caption" display="block" color="text.secondary">
                            {formatDate(row.lateShiftDate)}
                          </Typography>
                        </td>
                        <td style={{ padding: '16px' }}>{row.coveringStaffName}</td>
                        <td style={{ padding: '16px' }}>
                          {row.coveringShiftName}
                          <Typography variant="caption" display="block" color="text.secondary">
                            {formatDate(row.coveringShiftDate)}
                          </Typography>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <Tooltip
                            title={`Lương giờ: ${formatCurrency(row.lateStaffHourlyRate)}/h`}
                          >
                            <span>{row.coveringHours.toFixed(2)}h</span>
                          </Tooltip>
                        </td>
                        <td style={{ padding: '16px', fontWeight: 600, color: '#1976d2' }}>
                          {formatCurrency(row.extraPayAmount)}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <Label color={getStatusColor(row.status)}>
                            {getStatusLabel(row.status)}
                          </Label>
                        </td>
                        <td style={{ padding: '16px' }}>{row.reviewNote || '-'}</td>
                      </tr>
                    ))}
                    {requests.length === 0 && <TableNoData notFound />}
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>
            <TablePaginationCustom
              count={requests.length}
              page={table.page}
              rowsPerPage={table.rowsPerPage}
              onPageChange={table.onChangePage}
              onRowsPerPageChange={table.onChangeRowsPerPage}
            />
          </>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo yêu cầu làm hộ</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Yêu cầu này được tạo SAU KHI sự việc xảy ra. Hệ thống sẽ tự động tính thời gian làm
              hộ từ dữ liệu chấm công.
            </Typography>

            {/* Late Staff */}
            <TextField
              select
              fullWidth
              label="Nhân viên đi muộn"
              value={formData.lateStaffId}
              onChange={(e) => handleLateStaffChange(e.target.value)}
            >
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName}
                </MenuItem>
              ))}
            </TextField>

            {formData.lateStaffId && (
              <TextField
                select
                fullWidth
                label="Ca của người đi muộn"
                value={formData.lateStaffAssignmentId}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, lateStaffAssignmentId: e.target.value }))
                }
              >
                {lateStaffAssignments.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.scheduleName || a.shiftName} — {formatDate(a.date)}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {/* Covering Staff */}
            <TextField
              select
              fullWidth
              label="Nhân viên làm hộ (ca trước)"
              value={formData.coveringStaffId}
              onChange={(e) => handleCoveringStaffChange(e.target.value)}
            >
              {users
                .filter((u) => u.id !== formData.lateStaffId)
                .map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.fullName}
                  </MenuItem>
                ))}
            </TextField>

            {formData.coveringStaffId && (
              <TextField
                select
                fullWidth
                label="Ca của người làm hộ"
                value={formData.coveringStaffAssignmentId}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, coveringStaffAssignmentId: e.target.value }))
                }
              >
                {coveringAssignments.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.scheduleName || a.shiftName} — {formatDate(a.date)}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Lý do (tuỳ chọn)"
              value={formData.reason}
              onChange={(e) => setFormData((f) => ({ ...f, reason: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Huỷ</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!isFormValid}>
            Tạo yêu cầu
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
