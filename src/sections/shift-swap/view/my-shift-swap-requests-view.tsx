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

import type { IShiftSwapRequest } from 'src/types/corecms-api';

import { getMySchedule } from 'src/api/attendance';
import {
  createShiftSwapRequest,
  getMyShiftSwapRequests,
} from 'src/api/shiftSwap';
import { getAllUsers } from 'src/api/users';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'currentShift', label: 'Ca hiện tại', width: 180 },
  { id: 'currentDate', label: 'Ngày ca', width: 120 },
  { id: 'targetUser', label: 'Đổi với', width: 150 },
  { id: 'targetShift', label: 'Ca đổi', width: 180 },
  { id: 'targetDate', label: 'Ngày ca', width: 120 },
  { id: 'reason', label: 'Lý do', width: 200 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: 'reviewNote', label: 'Phản hồi', width: 200 },
];

// ----------------------------------------------------------------------

export default function MyShiftSwapRequestsView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [requests, setRequests] = useState<IShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    currentShiftAssignmentId: '',
    targetUserId: '',
    targetShiftAssignmentId: '',
    reason: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyShiftSwapRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch shift swap requests:', error);
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
      const today = new Date().toISOString();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = nextMonth.toISOString();

      const [assignments, userData] = await Promise.all([
        getMySchedule(today, endDate),
        getAllUsers(),
      ]);
      setMyAssignments(assignments);
      setUsers(userData);
      setOpenDialog(true);
    } catch (error) {
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({
      currentShiftAssignmentId: '',
      targetUserId: '',
      targetShiftAssignmentId: '',
      reason: '',
    });
  };

  const handleSubmit = async () => {
    try {
      await createShiftSwapRequest(formData);
      enqueueSnackbar('Tạo yêu cầu đổi ca thành công!', { variant: 'success' });
      handleCloseDialog();
      fetchData();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Tạo yêu cầu thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'success';
      case 'Rejected':
        return 'error';
      case 'Cancelled':
        return 'default';
      default:
        return 'warning';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'Chờ duyệt';
      case 'Approved':
        return 'Đã duyệt';
      case 'Rejected':
        return 'Từ chối';
      case 'Cancelled':
        return 'Đã huỷ';
      default:
        return status;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Yêu cầu đổi ca của tôi"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Ca làm việc' },
          { name: 'Đổi ca' },
        ]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={handleOpenDialog}
          >
            Tạo yêu cầu đổi ca
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
                        <td style={{ padding: '16px' }}>{row.currentShiftName}</td>
                        <td style={{ padding: '16px' }}>{formatDate(row.currentShiftDate)}</td>
                        <td style={{ padding: '16px' }}>{row.targetUserName || '-'}</td>
                        <td style={{ padding: '16px' }}>{row.targetShiftName || '-'}</td>
                        <td style={{ padding: '16px' }}>{formatDate(row.targetShiftDate)}</td>
                        <td style={{ padding: '16px' }}>{row.reason || '-'}</td>
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
        <DialogTitle>Tạo yêu cầu đổi ca</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 2 }}>
            <TextField
              select
              fullWidth
              label="Ca làm việc hiện tại"
              value={formData.currentShiftAssignmentId}
              onChange={(e) =>
                setFormData({ ...formData, currentShiftAssignmentId: e.target.value })
              }
            >
              {myAssignments.map((assignment) => (
                <MenuItem key={assignment.id} value={assignment.id}>
                  {assignment.shiftName} - {formatDate(assignment.date)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Đổi với nhân viên"
              value={formData.targetUserId}
              onChange={(e) => setFormData({ ...formData, targetUserId: e.target.value })}
            >
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.fullName} - {user.email}
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="caption" color="text.secondary">
              Lưu ý: Ca đổi có thể để trống nếu chỉ muốn đổi ca với bất kỳ ca nào của nhân viên đó
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Lý do đổi ca"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Huỷ</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!formData.currentShiftAssignmentId || !formData.targetUserId}
          >
            Tạo yêu cầu
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
