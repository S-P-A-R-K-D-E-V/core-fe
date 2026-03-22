'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import {
  useTable,
  emptyRows,
  TableNoData,
  TableEmptyRows,
  TableHeadCustom,
  TablePaginationCustom,
} from 'src/components/table';

import { IAttendanceLog, IUser } from 'src/types/corecms-api';
import { getAttendanceLogs } from 'src/api/attendance';
import { getAllUsers } from 'src/api/users';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'staffName', label: 'Staff' },
  { id: 'checkInTime', label: 'Check In', width: 160 },
  { id: 'checkOutTime', label: 'Check Out', width: 160 },
  { id: 'workedHours', label: 'Hours', width: 80 },
  { id: 'isLate', label: 'Late', width: 100 },
  { id: 'status', label: 'Status', width: 100 },
  { id: 'isAutoClosedBySystem', label: 'Auto', width: 80 },
];

// ----------------------------------------------------------------------

export default function AttendanceLogsView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const settings = useSettingsContext();

  const [tableData, setTableData] = useState<IAttendanceLog[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString());
  const [toDate, setToDate] = useState(() => new Date().toISOString());
  const [filterStaffId, setFilterStaffId] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const u = await getAllUsers();
        setUsers(u);
      } catch (error) {
        console.error(error);
      }
    };
    loadUsers();
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await getAttendanceLogs(fromDate, toDate, filterStaffId || undefined);
      setTableData(data);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to load logs', { variant: 'error' });
    }
  }, [fromDate, toDate, filterStaffId, enqueueSnackbar]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const dataInPage = tableData.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  const formatDateTime = (dt?: string) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('vi-VN');
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Attendance Logs"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Attendance', href: paths.dashboard.attendance.root },
          { name: 'Logs' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ mb: 3, p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <DatePicker
            label="From Date"
            value={parseDateStr(fromDate)}
            onChange={(val) => setFromDate(toDateStr(val))}
            format="dd/MM/yyyy"
            slotProps={{ textField: { sx: { width: { xs: 1, md: 180 } } } }}
          />
          <DatePicker
            label="To Date"
            value={parseDateStr(toDate)}
            onChange={(val) => setToDate(toDateStr(val))}
            format="dd/MM/yyyy"
            slotProps={{ textField: { sx: { width: { xs: 1, md: 180 } } } }}
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
                    <TableCell>{formatDateTime(row.checkInTime)}</TableCell>
                    <TableCell>{formatDateTime(row.checkOutTime)}</TableCell>
                    <TableCell>
                      {row.workedHours != null ? `${row.workedHours.toFixed(1)}h` : '-'}
                    </TableCell>
                    <TableCell>
                      {row.isLate ? (
                        <Label variant="soft" color="error">
                          Late {row.lateMinutes}m
                        </Label>
                      ) : (
                        <Label variant="soft" color="success">
                          On Time
                        </Label>
                      )}
                    </TableCell>
                    <TableCell>
                      <Label
                        variant="soft"
                        color={
                          (row.status === 'OnTime' && 'success') ||
                          (row.status === 'Late' && 'warning') ||
                          (row.status === 'Absent' && 'error') ||
                          'default'
                        }
                      >
                        {row.status}
                      </Label>
                    </TableCell>
                    <TableCell>
                      {row.isAutoClosedBySystem ? (
                        <Label variant="soft" color="warning">
                          Yes
                        </Label>
                      ) : (
                        '-'
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
  );
}
