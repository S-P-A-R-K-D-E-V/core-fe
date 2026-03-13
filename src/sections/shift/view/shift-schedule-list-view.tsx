'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import Stack from '@mui/material/Stack';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { parseDateStr, toDateStr } from 'src/utils/format-time';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';
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

import { IShiftSchedule } from 'src/types/corecms-api';
import { getShiftSchedulesByDateRange, lockShiftSchedule } from 'src/api/attendance';

import ShiftScheduleTableRow from '../shift-schedule-table-row';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'templateName', label: 'Template' },
  { id: 'time', label: 'Time', width: 150 },
  { id: 'dateRange', label: 'Date Range', width: 200 },
  { id: 'repeatDays', label: 'Repeat Days', width: 180 },
  { id: 'version', label: 'Ver', width: 60 },
  { id: 'totalHours', label: 'Hours', width: 80 },
  { id: 'isPayrollLocked', label: 'Lock', width: 100 },
  { id: 'isActive', label: 'Status', width: 100 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export default function ShiftScheduleListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const settings = useSettingsContext();
  const router = useRouter();

  const [tableData, setTableData] = useState<IShiftSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(lastDayOfMonth.toISOString().split('T')[0]);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const schedules = await getShiftSchedulesByDateRange(fromDate, toDate);
      setTableData(schedules);
    } catch (error) {
      console.error('Failed to fetch shift schedules:', error);
      enqueueSnackbar('Failed to load shift schedules', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, enqueueSnackbar]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const dataInPage = tableData.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  const denseHeight = table.dense ? 56 : 76;
  const notFound = !tableData.length;

  const handleEditRow = useCallback(
    (id: string) => {
      router.push(paths.dashboard.shift.schedules.edit(id));
    },
    [router]
  );

  const handleLockToggle = useCallback(
    async (id: string, isLocked: boolean) => {
      try {
        await lockShiftSchedule(id, { isLocked: !isLocked });
        enqueueSnackbar(isLocked ? 'Schedule unlocked!' : 'Schedule locked!');
        fetchSchedules();
      } catch (error) {
        console.error(error);
        enqueueSnackbar('Failed to update lock status!', { variant: 'error' });
      }
    },
    [enqueueSnackbar, fetchSchedules]
  );

  return (
    <>
      <Container maxWidth={settings.themeStretch ? false : 'xl'}>
        <CustomBreadcrumbs
          heading="Shift Schedules"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Shift', href: paths.dashboard.shift.root },
            { name: 'Schedules' },
          ]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => router.push(paths.dashboard.shift.schedules.new)}
            >
              New Schedule
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card sx={{ mb: 3, p: 2 }}>
          <Stack direction="row" spacing={2}>
            <DatePicker
              label="From Date"
              value={parseDateStr(fromDate)}
              onChange={(val) => setFromDate(toDateStr(val))}
              format="dd/MM/yyyy"
              slotProps={{ textField: { size: 'small' } }}
            />
            <DatePicker
              label="To Date"
              value={parseDateStr(toDate)}
              onChange={(val) => setToDate(toDateStr(val))}
              format="dd/MM/yyyy"
              slotProps={{ textField: { size: 'small' } }}
            />
            <Button variant="contained" onClick={fetchSchedules} disabled={loading}>
              Search
            </Button>
          </Stack>
        </Card>

        <Card>
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
                <TableHeadCustom
                  order={table.order}
                  orderBy={table.orderBy}
                  headLabel={TABLE_HEAD}
                  rowCount={tableData.length}
                  numSelected={table.selected.length}
                  onSort={table.onSort}
                />

                <TableBody>
                  {dataInPage.map((row) => (
                    <ShiftScheduleTableRow
                      key={row.id}
                      row={row}
                      onEditRow={() => handleEditRow(row.id)}
                      onLockToggle={() => handleLockToggle(row.id, row.isPayrollLocked)}
                    />
                  ))}

                  <TableEmptyRows
                    height={denseHeight}
                    emptyRows={emptyRows(table.page, table.rowsPerPage, tableData.length)}
                  />

                  <TableNoData notFound={notFound} />
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
    </>
  );
}
