'use client';

import { useCallback, useEffect, useState } from 'react';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
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

import { getPendingLateCoverRequests, reviewLateCoverRequest } from 'src/api/lateCover';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'lateStaff', label: 'Nhân viên đi muộn', width: 150 },
  { id: 'lateShift', label: 'Ca đi muộn', width: 160 },
  { id: 'coveringStaff', label: 'Người làm hộ', width: 150 },
  { id: 'coveringShift', label: 'Ca làm hộ', width: 160 },
  { id: 'coveringHours', label: 'Giờ làm hộ', width: 110 },
  { id: 'extraPay', label: 'Phụ cấp', width: 130 },
  { id: 'reason', label: 'Lý do', width: 180 },
  { id: 'createdAt', label: 'Ngày tạo', width: 130 },
  { id: 'actions', label: 'Hành động', width: 100 },
];

// ----------------------------------------------------------------------

export default function PendingLateCoverRequestsView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [requests, setRequests] = useState<ILateCoverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    request: ILateCoverRequest | null;
    status: 'Approved' | 'Rejected';
    note: string;
  }>({ open: false, request: null, status: 'Approved', note: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPendingLateCoverRequests();
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

  const handleOpenReview = (request: ILateCoverRequest, status: 'Approved' | 'Rejected') => {
    setReviewDialog({ open: true, request, status, note: '' });
  };

  const handleCloseReview = () => {
    setReviewDialog({ open: false, request: null, status: 'Approved', note: '' });
  };

  const handleSubmitReview = async () => {
    if (!reviewDialog.request) return;
    try {
      await reviewLateCoverRequest(reviewDialog.request.id, {
        status: reviewDialog.status,
        reviewNote: reviewDialog.note || undefined,
      });
      enqueueSnackbar(
        reviewDialog.status === 'Approved' ? 'Đã duyệt yêu cầu làm hộ!' : 'Đã từ chối!',
        { variant: 'success' }
      );
      handleCloseReview();
      fetchData();
    } catch (error: any) {
      const msg = error?.title || error?.message || 'Xử lý thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('vi-VN');
  };

  const formatCurrency = (amount: number) =>
    amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Duyệt yêu cầu làm hộ"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Làm hộ' },
          { name: 'Duyệt yêu cầu' },
        ]}
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
                            title={`Lương giờ người đi muộn: ${formatCurrency(row.lateStaffHourlyRate)}/h`}
                          >
                            <span>{row.coveringHours.toFixed(2)}h</span>
                          </Tooltip>
                        </td>
                        <td
                          style={{ padding: '16px', fontWeight: 600, color: '#2e7d32' }}
                        >
                          {formatCurrency(row.extraPayAmount)}
                          <Typography variant="caption" display="block" color="text.secondary">
                            Cho {row.coveringStaffName}
                          </Typography>
                        </td>
                        <td style={{ padding: '16px' }}>{row.reason || '-'}</td>
                        <td style={{ padding: '16px' }}>{formatDateTime(row.createdAt)}</td>
                        <td style={{ padding: '16px' }}>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Duyệt — bỏ qua lỗi + cộng lương">
                              <IconButton
                                color="success"
                                size="small"
                                onClick={() => handleOpenReview(row, 'Approved')}
                              >
                                <Iconify icon="eva:checkmark-circle-2-fill" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Từ chối">
                              <IconButton
                                color="error"
                                size="small"
                                onClick={() => handleOpenReview(row, 'Rejected')}
                              >
                                <Iconify icon="eva:close-circle-fill" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </td>
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

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onClose={handleCloseReview} maxWidth="sm" fullWidth>
        <DialogTitle>
          {reviewDialog.status === 'Approved' ? 'Duyệt yêu cầu làm hộ' : 'Từ chối yêu cầu'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 2 }}>
            {reviewDialog.request && reviewDialog.status === 'Approved' && (
              <Stack spacing={1}>
                <Typography variant="body2">
                  Khi duyệt, hệ thống sẽ tự động:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    size="small"
                    color="success"
                    icon={<Iconify icon="eva:checkmark-fill" />}
                    label={`Bỏ qua lỗi đi muộn cho ${reviewDialog.request.lateStaffName}`}
                  />
                  <Chip
                    size="small"
                    color="info"
                    icon={<Iconify icon="eva:plus-fill" />}
                    label={`Cộng ${formatCurrency(reviewDialog.request.extraPayAmount)} cho ${reviewDialog.request.coveringStaffName}`}
                  />
                </Stack>
              </Stack>
            )}

            <TextField
              fullWidth
              multiline
              rows={3}
              label={reviewDialog.status === 'Approved' ? 'Ghi chú (tuỳ chọn)' : 'Lý do từ chối'}
              value={reviewDialog.note}
              onChange={(e) => setReviewDialog((d) => ({ ...d, note: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseReview}>Huỷ</Button>
          <Button
            variant="contained"
            color={reviewDialog.status === 'Approved' ? 'success' : 'error'}
            onClick={handleSubmitReview}
          >
            {reviewDialog.status === 'Approved' ? 'Duyệt' : 'Từ chối'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
