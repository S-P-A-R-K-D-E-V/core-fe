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
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import TextField from '@mui/material/TextField';

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

import type { IShiftSwapRequest } from 'src/types/corecms-api';

import { getPendingShiftSwapRequests, reviewShiftSwapRequest } from 'src/api/shiftSwap';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'requester', label: 'Người yêu cầu', width: 150 },
  { id: 'currentShift', label: 'Ca hiện tại', width: 180 },
  { id: 'currentDate', label: 'Ngày ca', width: 120 },
  { id: 'targetUser', label: 'Đổi với', width: 150 },
  { id: 'targetShift', label: 'Ca đổi', width: 180 },
  { id: 'targetDate', label: 'Ngày ca', width: 120 },
  { id: 'reason', label: 'Lý do', width: 200 },
  { id: 'createdAt', label: 'Ngày tạo', width: 150 },
  { id: 'actions', label: 'Hành động', width: 120 },
];

// ----------------------------------------------------------------------

export default function PendingShiftSwapRequestsView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [requests, setRequests] = useState<IShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    requestId: string;
    status: string;
    note: string;
  }>({
    open: false,
    requestId: '',
    status: '',
    note: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPendingShiftSwapRequests();
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

  const handleOpenReview = (requestId: string, status: string) => {
    setReviewDialog({
      open: true,
      requestId,
      status,
      note: '',
    });
  };

  const handleCloseReview = () => {
    setReviewDialog({
      open: false,
      requestId: '',
      status: '',
      note: '',
    });
  };

  const handleSubmitReview = async () => {
    try {
      await reviewShiftSwapRequest(reviewDialog.requestId, {
        status: reviewDialog.status,
        reviewNote: reviewDialog.note,
      });
      enqueueSnackbar(
        reviewDialog.status === 'Approved' ? 'Đã duyệt yêu cầu!' : 'Đã từ chối yêu cầu!',
        { variant: 'success' }
      );
      handleCloseReview();
      fetchData();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Xử lý yêu cầu thất bại!';
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

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Duyệt yêu cầu đổi ca"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Ca làm việc' },
          { name: 'Duyệt đổi ca' },
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
                        <td style={{ padding: '16px' }}>{row.requesterName}</td>
                        <td style={{ padding: '16px' }}>{row.currentShiftName}</td>
                        <td style={{ padding: '16px' }}>{formatDate(row.currentShiftDate)}</td>
                        <td style={{ padding: '16px' }}>{row.targetUserName || '-'}</td>
                        <td style={{ padding: '16px' }}>{row.targetShiftName || '-'}</td>
                        <td style={{ padding: '16px' }}>{formatDate(row.targetShiftDate)}</td>
                        <td style={{ padding: '16px' }}>{row.reason || '-'}</td>
                        <td style={{ padding: '16px' }}>{formatDateTime(row.createdAt)}</td>
                        <td style={{ padding: '16px' }}>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              color="success"
                              size="small"
                              onClick={() => handleOpenReview(row.id, 'Approved')}
                            >
                              <Iconify icon="eva:checkmark-circle-2-fill" />
                            </IconButton>
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => handleOpenReview(row.id, 'Rejected')}
                            >
                              <Iconify icon="eva:close-circle-fill" />
                            </IconButton>
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
          {reviewDialog.status === 'Approved' ? 'Duyệt yêu cầu đổi ca' : 'Từ chối yêu cầu đổi ca'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label={reviewDialog.status === 'Approved' ? 'Ghi chú (tuỳ chọn)' : 'Lý do từ chối'}
              value={reviewDialog.note}
              onChange={(e) => setReviewDialog({ ...reviewDialog, note: e.target.value })}
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
