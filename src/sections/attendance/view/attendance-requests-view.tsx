'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import LoadingButton from '@mui/lab/LoadingButton';
import { alpha } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import {
  useTable,
  emptyRows,
  TableNoData,
  TableEmptyRows,
  TableHeadCustom,
  TablePaginationCustom,
} from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

import { IAttendanceRequest } from 'src/types/corecms-api';
import {
  getAttendanceRequests,
  getMyAttendanceRequests,
  createAttendanceRequest,
  processAttendanceRequest,
} from 'src/api/attendance';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'staffName', label: 'Staff' },
  { id: 'requestType', label: 'Type', width: 160 },
  { id: 'reason', label: 'Reason' },
  { id: 'status', label: 'Status', width: 110 },
  { id: 'createdAt', label: 'Created', width: 140 },
  { id: '', width: 120 },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
];

const REQUEST_TYPE_OPTIONS = [
  { value: 'MissedCheckIn', label: 'Missed Check-In' },
  { value: 'MissedCheckOut', label: 'Missed Check-Out' },
  { value: 'OvertimeCompensation', label: 'Overtime Compensation' },
  { value: 'ShiftSwap', label: 'Shift Swap' },
];

// ----------------------------------------------------------------------

export default function AttendanceRequestsView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const createDialog = useBoolean();
  const processDialog = useBoolean();

  const isAdmin = user?.roles?.includes('Admin') || user?.roles?.includes('Manager');

  const [tableData, setTableData] = useState<IAttendanceRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  // Create form
  const [newRequestType, setNewRequestType] = useState('MissedCheckIn');
  const [newReason, setNewReason] = useState('');
  const [newCompensationHours, setNewCompensationHours] = useState('');
  const [creating, setCreating] = useState(false);

  // Process form
  const [processTarget, setProcessTarget] = useState<IAttendanceRequest | null>(null);
  const [processStatus, setProcessStatus] = useState('Approved');
  const [processNote, setProcessNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      let data: IAttendanceRequest[];
      if (isAdmin) {
        const statusParam = statusFilter === 'all' ? undefined : statusFilter;
        data = await getAttendanceRequests(undefined, statusParam);
      } else {
        data = await getMyAttendanceRequests();
        if (statusFilter !== 'all') {
          data = data.filter((r) => r.status === statusFilter);
        }
      }
      setTableData(data);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to load requests', { variant: 'error' });
    }
  }, [isAdmin, statusFilter, enqueueSnackbar]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const dataInPage = tableData.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  const handleCreate = async () => {
    try {
      setCreating(true);
      await createAttendanceRequest({
        requestType: newRequestType,
        reason: newReason,
        compensationHours: newCompensationHours ? parseFloat(newCompensationHours) : undefined,
      });
      enqueueSnackbar('Request created!');
      createDialog.onFalse();
      setNewReason('');
      setNewCompensationHours('');
      fetchRequests();
    } catch (error: any) {
      console.error(error);
      enqueueSnackbar(error?.title || 'Create failed!', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleProcess = async () => {
    if (!processTarget) return;
    try {
      setProcessing(true);
      await processAttendanceRequest(processTarget.id, {
        status: processStatus,
        approvalNote: processNote || undefined,
      });
      enqueueSnackbar(`Request ${processStatus.toLowerCase()}!`);
      processDialog.onFalse();
      setProcessTarget(null);
      setProcessNote('');
      fetchRequests();
    } catch (error: any) {
      console.error(error);
      enqueueSnackbar(error?.title || 'Process failed!', { variant: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const formatDateTime = (dt?: string) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('vi-VN');
  };

  return (
    <>
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <CustomBreadcrumbs
          heading="Attendance Requests"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Attendance', href: paths.dashboard.attendance.root },
            { name: 'Requests' },
          ]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={createDialog.onTrue}
            >
              New Request
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <Tabs
            value={statusFilter}
            onChange={(_, val) => {
              setStatusFilter(val);
              table.onResetPage();
            }}
            sx={{
              px: 2.5,
              boxShadow: (theme) =>
                `inset 0 -2px 0 0 ${alpha(theme.palette.grey[500], 0.08)}`,
            }}
          >
            {STATUS_OPTIONS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={tab.label}
                icon={
                  <Label
                    variant={
                      (tab.value === 'all' || tab.value === statusFilter) ? 'filled' : 'soft'
                    }
                    color={
                      (tab.value === 'Pending' && 'warning') ||
                      (tab.value === 'Approved' && 'success') ||
                      (tab.value === 'Rejected' && 'error') ||
                      'default'
                    }
                  >
                    {tab.value === 'all'
                      ? tableData.length
                      : tableData.filter((r) => r.status === tab.value).length}
                  </Label>
                }
                iconPosition="end"
              />
            ))}
          </Tabs>

          <TableContainer sx={{ overflow: 'unset' }}>
            <Scrollbar>
              <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 800 }}>
                <TableHeadCustom
                  order={table.order}
                  orderBy={table.orderBy}
                  headLabel={TABLE_HEAD}
                  onSort={table.onSort}
                />

                <TableBody>
                  {dataInPage.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.staffName}</TableCell>
                      <TableCell>
                        <Label variant="soft" color="info">
                          {row.requestType}
                        </Label>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        {row.reason}
                        {row.compensationHours != null && (
                          <Label variant="soft" color="warning" sx={{ ml: 1 }}>
                            +{row.compensationHours}h
                          </Label>
                        )}
                      </TableCell>
                      <TableCell>
                        <Label
                          variant="soft"
                          color={
                            (row.status === 'Pending' && 'warning') ||
                            (row.status === 'Approved' && 'success') ||
                            (row.status === 'Rejected' && 'error') ||
                            'default'
                          }
                        >
                          {row.status}
                        </Label>
                      </TableCell>
                      <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                      <TableCell align="right">
                        {isAdmin && row.status === 'Pending' && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setProcessTarget(row);
                              processDialog.onTrue();
                            }}
                          >
                            Process
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  <TableEmptyRows
                    height={table.dense ? 56 : 76}
                    emptyRows={emptyRows(table.page, table.rowsPerPage, tableData.length)}
                  />
                  <TableNoData notFound={!tableData.length} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>

          <TablePaginationCustom
            count={tableData.length}
            page={table.page}
            rowsPerPage={table.rowsPerPage}
            onPageChange={table.onChangePage}
            onRowsPerPageChange={table.onChangeRowsPerPage}
            dense={table.dense}
            onChangeDense={table.onChangeDense}
          />
        </Card>
      </Container>

      {/* Create Request Dialog */}
      <Dialog open={createDialog.value} onClose={createDialog.onFalse} maxWidth="sm" fullWidth>
        <DialogTitle>New Attendance Request</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              fullWidth
              label="Request Type"
              value={newRequestType}
              onChange={(e) => setNewRequestType(e.target.value)}
            >
              {REQUEST_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Reason"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              multiline
              rows={3}
              required
            />

            {newRequestType === 'OvertimeCompensation' && (
              <TextField
                fullWidth
                label="Compensation Hours"
                type="number"
                value={newCompensationHours}
                onChange={(e) => setNewCompensationHours(e.target.value)}
                inputProps={{ step: 0.5, min: 0 }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={createDialog.onFalse}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            loading={creating}
            disabled={!newReason}
            onClick={handleCreate}
          >
            Submit
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Process Request Dialog */}
      <Dialog open={processDialog.value} onClose={processDialog.onFalse} maxWidth="sm" fullWidth>
        <DialogTitle>Process Attendance Request</DialogTitle>
        <DialogContent>
          {processTarget && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField fullWidth label="Staff" value={processTarget.staffName} disabled />
              <TextField fullWidth label="Type" value={processTarget.requestType} disabled />
              <TextField fullWidth label="Reason" value={processTarget.reason} disabled multiline />

              <TextField
                select
                fullWidth
                label="Decision"
                value={processStatus}
                onChange={(e) => setProcessStatus(e.target.value)}
              >
                <MenuItem value="Approved">Approve</MenuItem>
                <MenuItem value="Rejected">Reject</MenuItem>
              </TextField>

              <TextField
                fullWidth
                label="Note"
                value={processNote}
                onChange={(e) => setProcessNote(e.target.value)}
                multiline
                rows={2}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={processDialog.onFalse}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            color={processStatus === 'Approved' ? 'success' : 'error'}
            loading={processing}
            onClick={handleProcess}
          >
            {processStatus === 'Approved' ? 'Approve' : 'Reject'}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
