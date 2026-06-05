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

import type { IShiftSwapRequest } from 'src/types/corecms-api';

import { confirmShiftSwapTarget, getMyConfirmationRequests } from 'src/api/shiftSwap';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'requester', label: 'Người yêu cầu', width: 150 },
  { id: 'currentShift', label: 'Ca của họ', width: 180 },
  { id: 'currentDate', label: 'Ngày ca', width: 120 },
  { id: 'targetShift', label: 'Ca của bạn', width: 180 },
  { id: 'targetDate', label: 'Ngày ca', width: 120 },
  { id: 'reason', label: 'Lý do', width: 200 },
  { id: 'createdAt', label: 'Ngày tạo', width: 150 },
  { id: 'actions', label: 'Hành động', width: 140 },
];

// ----------------------------------------------------------------------

export default function MyConfirmationRequestsView() {
  const table = useTable();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [requests, setRequests] = useState<IShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    requestId: string;
    isAccepted: boolean;
    declineReason: string;
  }>({ open: false, requestId: '', isAccepted: true, declineReason: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyConfirmationRequests();
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

  const handleOpenConfirm = (requestId: string, isAccepted: boolean) => {
    setConfirmDialog({ open: true, requestId, isAccepted, declineReason: '' });
  };

  const handleCloseConfirm = () => {
    setConfirmDialog({ open: false, requestId: '', isAccepted: true, declineReason: '' });
  };

  const handleSubmitConfirm = async () => {
    try {
      await confirmShiftSwapTarget(confirmDialog.requestId, {
        isAccepted: confirmDialog.isAccepted,
        declineReason: confirmDialog.declineReason || undefined,
      });
      enqueueSnackbar(
        confirmDialog.isAccepted ? 'Đã xác nhận đổi ca!' : 'Đã từ chối yêu cầu đổi ca!',
        { variant: 'success' }
      );
      handleCloseConfirm();
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

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Yêu cầu đổi ca chờ xác nhận"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đổi ca' },
          { name: 'Chờ xác nhận' },
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
                        <td style={{ padding: '16px' }}>{row.targetShiftName || '-'}</td>
                        <td style={{ padding: '16px' }}>{formatDate(row.targetShiftDate)}</td>
                        <td style={{ padding: '16px' }}>{row.reason || '-'}</td>
                        <td style={{ padding: '16px' }}>{formatDateTime(row.createdAt)}</td>
                        <td style={{ padding: '16px' }}>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              color="success"
                              size="small"
                              title="Đồng ý đổi ca"
                              onClick={() => handleOpenConfirm(row.id, true)}
                            >
                              <Iconify icon="eva:checkmark-circle-2-fill" />
                            </IconButton>
                            <IconButton
                              color="error"
                              size="small"
                              title="Từ chối đổi ca"
                              onClick={() => handleOpenConfirm(row.id, false)}
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

      {/* Confirm / Decline Dialog */}
      <Dialog open={confirmDialog.open} onClose={handleCloseConfirm} maxWidth="sm" fullWidth>
        <DialogTitle>
          {confirmDialog.isAccepted ? 'Xác nhận đổi ca' : 'Từ chối đổi ca'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 2 }}>
            {confirmDialog.isAccepted ? (
              <Typography>
                Bạn xác nhận đồng ý đổi ca? Yêu cầu sẽ được chuyển sang Admin/Manager để phê
                duyệt.
              </Typography>
            ) : (
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Lý do từ chối"
                value={confirmDialog.declineReason}
                onChange={(e) =>
                  setConfirmDialog({ ...confirmDialog, declineReason: e.target.value })
                }
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirm}>Huỷ</Button>
          <Button
            variant="contained"
            color={confirmDialog.isAccepted ? 'success' : 'error'}
            onClick={handleSubmitConfirm}
          >
            {confirmDialog.isAccepted ? 'Xác nhận' : 'Từ chối'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
