'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';

import { useBoolean } from 'src/hooks/use-boolean';

import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
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

import { IShift, IShiftAssignment, IUser } from 'src/types/corecms-api';
import {
  getShiftAssignments,
  createShiftAssignment,
  deleteShiftAssignment,
  getAllShifts,
} from 'src/api/attendance';
import { getAllUsers } from 'src/api/users';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'staffName', label: 'Staff' },
  { id: 'shiftName', label: 'Shift' },
  { id: 'date', label: 'Date', width: 130 },
  { id: 'shiftStartTime', label: 'Start', width: 80 },
  { id: 'shiftEndTime', label: 'End', width: 80 },
  { id: 'shiftType', label: 'Type', width: 100 },
  { id: 'note', label: 'Note', width: 200 },
  { id: '', width: 60 },
];

// ----------------------------------------------------------------------

export default function AttendanceAssignmentsView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const settings = useSettingsContext();
  const createDialog = useBoolean();
  const confirm = useBoolean();

  const [tableData, setTableData] = useState<IShiftAssignment[]>([]);
  const [shifts, setShifts] = useState<IShift[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [filterStaffId, setFilterStaffId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Create form state
  const [newStaffId, setNewStaffId] = useState('');
  const [newShiftId, setNewShiftId] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      const data = await getShiftAssignments(fromDate, toDate, filterStaffId || undefined);
      setTableData(data);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to load assignments', { variant: 'error' });
    }
  }, [fromDate, toDate, filterStaffId, enqueueSnackbar]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [s, u] = await Promise.all([getAllShifts(), getAllUsers()]);
        setShifts(s.filter((sh) => sh.isActive));
        setUsers(u.filter((usr) => usr.roles?.includes('Staff') || usr.roles?.includes('Admin') || usr.roles?.includes('Manager')));
      } catch (error) {
        console.error(error);
      }
    };
    loadMeta();
  }, []);

  const dataInPage = tableData.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteShiftAssignment(id);
        enqueueSnackbar('Deleted!');
        fetchAssignments();
      } catch (error) {
        console.error(error);
        enqueueSnackbar('Delete failed!', { variant: 'error' });
      }
    },
    [enqueueSnackbar, fetchAssignments]
  );

  const handleCreate = async () => {
    try {
      setCreating(true);
      await createShiftAssignment({
        staffId: newStaffId,
        shiftId: newShiftId,
        date: newDate,
        note: newNote || undefined,
      });
      enqueueSnackbar('Assignment created!');
      createDialog.onFalse();
      setNewStaffId('');
      setNewShiftId('');
      setNewNote('');
      fetchAssignments();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Create failed!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <CustomBreadcrumbs
          heading="Shift Assignments"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Attendance', href: paths.dashboard.attendance.root },
            { name: 'Assignments' },
          ]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={createDialog.onTrue}
            >
              Assign Shift
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {/* Filters */}
        <Card sx={{ mb: 3, p: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="From Date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: 1, md: 180 } }}
            />
            <TextField
              label="To Date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: 1, md: 180 } }}
            />
            <TextField
              select
              label="Staff"
              value={filterStaffId}
              onChange={(e) => setFilterStaffId(e.target.value)}
              sx={{ width: { xs: 1, md: 250 } }}
            >
              <MenuItem value="">All Staff</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Card>

        <Card>
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
                      <TableCell>{row.shiftName}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.shiftStartTime}</TableCell>
                      <TableCell>{row.shiftEndTime}</TableCell>
                      <TableCell>
                        <Label variant="soft" color={row.shiftType === 'Holiday' ? 'warning' : 'info'}>
                          {row.shiftType}
                        </Label>
                      </TableCell>
                      <TableCell>{row.note || '-'}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="error"
                          onClick={() => {
                            setDeleteTarget(row.id);
                            confirm.onTrue();
                          }}
                        >
                          <Iconify icon="solar:trash-bin-trash-bold" />
                        </IconButton>
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

      {/* Create Dialog */}
      <Dialog open={createDialog.value} onClose={createDialog.onFalse} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Shift to Staff</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              fullWidth
              label="Staff"
              value={newStaffId}
              onChange={(e) => setNewStaffId(e.target.value)}
            >
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName} ({u.email})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Shift"
              value={newShiftId}
              onChange={(e) => setNewShiftId(e.target.value)}
            >
              {shifts.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s.startTime} - {s.endTime})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              fullWidth
              label="Note"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={createDialog.onFalse}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleCreate}
            loading={creating}
            disabled={!newStaffId || !newShiftId || !newDate}
          >
            Assign
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Delete Assignment"
        content="Are you sure want to delete this assignment?"
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (deleteTarget) handleDelete(deleteTarget);
              confirm.onFalse();
            }}
          >
            Delete
          </Button>
        }
      />
    </>
  );
}
