'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Unstable_Grid2';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { TableHeadCustom } from 'src/components/table';

import { IAttendanceReport, IUser } from 'src/types/corecms-api';
import { getAttendanceReport, autoCloseShifts } from 'src/api/attendance';
import { getAllUsers } from 'src/api/users';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'staffName', label: 'Staff' },
  { id: 'totalWorkedHours', label: 'Worked Hours', width: 120 },
  { id: 'totalShifts', label: 'Total Shifts', width: 110 },
  { id: 'presentShifts', label: 'Present', width: 90 },
  { id: 'absentShifts', label: 'Absent', width: 90 },
  { id: 'lateCount', label: 'Late', width: 80 },
  { id: 'totalLateMinutes', label: 'Late Minutes', width: 110 },
  { id: 'overtimeHours', label: 'Overtime', width: 100 },
  { id: 'compensationHours', label: 'Compensation', width: 120 },
];

// ----------------------------------------------------------------------

export default function AttendanceReportView() {
  const { enqueueSnackbar } = useSnackbar();
  const settings = useSettingsContext();

  const [reports, setReports] = useState<IAttendanceReport[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState('');

  // Default: current month
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [range, setRange] = useState<'day' | 'week' | 'month'>('month');

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

  const handleRangeChange = (newRange: 'day' | 'week' | 'month') => {
    setRange(newRange);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    setToDate(todayStr);

    if (newRange === 'day') {
      setFromDate(todayStr);
    } else if (newRange === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setFromDate(d.toISOString().split('T')[0]);
    } else {
      setFromDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
    }
  };

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAttendanceReport(fromDate, toDate, filterStaffId || undefined);
      // The API might return single or array
      setReports(Array.isArray(data) ? data : [data]);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to load report', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, filterStaffId, enqueueSnackbar]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleAutoClose = async () => {
    try {
      const result = await autoCloseShifts(new Date().toISOString().split('T')[0]);
      enqueueSnackbar(`Auto-closed ${result.closedCount} shift(s)`);
      fetchReport();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Auto-close failed!', { variant: 'error' });
    }
  };

  // Summary stats
  const totalHours = reports.reduce((acc, r) => acc + r.totalWorkedHours, 0);
  const totalLate = reports.reduce((acc, r) => acc + r.lateCount, 0);
  const totalAbsent = reports.reduce((acc, r) => acc + r.absentShifts, 0);
  const totalOvertime = reports.reduce((acc, r) => acc + r.overtimeHours, 0);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Attendance Report"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Attendance', href: paths.dashboard.attendance.root },
          { name: 'Report' },
        ]}
        action={
          <Button
            variant="soft"
            color="warning"
            startIcon={<Iconify icon="mdi:clock-check-outline" />}
            onClick={handleAutoClose}
          >
            Auto Close Today
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <Stack direction="row" spacing={1}>
            {(['day', 'week', 'month'] as const).map((r) => (
              <Button
                key={r}
                size="small"
                variant={range === r ? 'contained' : 'outlined'}
                onClick={() => handleRangeChange(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Button>
            ))}
          </Stack>
          <DatePicker
            label="From"
            value={parseDateStr(fromDate)}
            onChange={(val) => setFromDate(toDateStr(val))}
            format="dd/MM/yyyy"
            slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
          />
          <DatePicker
            label="To"
            value={parseDateStr(toDate)}
            onChange={(val) => setToDate(toDateStr(val))}
            format="dd/MM/yyyy"
            slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
          />
          <TextField
            select
            label="Staff"
            value={filterStaffId}
            onChange={(e) => setFilterStaffId(e.target.value)}
            size="small"
            sx={{ width: 220 }}
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

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid xs={6} md={3}>
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <Iconify icon="mdi:clock-outline" width={40} sx={{ color: 'primary.main', mb: 1 }} />
            <Typography variant="h4">{totalHours.toFixed(1)}h</Typography>
            <Typography variant="body2" color="text.secondary">
              Total Hours
            </Typography>
          </Card>
        </Grid>
        <Grid xs={6} md={3}>
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <Iconify icon="mdi:clock-alert" width={40} sx={{ color: 'warning.main', mb: 1 }} />
            <Typography variant="h4">{totalLate}</Typography>
            <Typography variant="body2" color="text.secondary">
              Late Count
            </Typography>
          </Card>
        </Grid>
        <Grid xs={6} md={3}>
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <Iconify icon="mdi:account-off" width={40} sx={{ color: 'error.main', mb: 1 }} />
            <Typography variant="h4">{totalAbsent}</Typography>
            <Typography variant="body2" color="text.secondary">
              Absent
            </Typography>
          </Card>
        </Grid>
        <Grid xs={6} md={3}>
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <Iconify icon="mdi:timer-plus" width={40} sx={{ color: 'success.main', mb: 1 }} />
            <Typography variant="h4">{totalOvertime.toFixed(1)}h</Typography>
            <Typography variant="body2" color="text.secondary">
              Overtime
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Report Table */}
      <Card>
        {loading ? (
          <Box display="flex" justifyContent="center" py={5}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ overflow: 'unset' }}>
            <Scrollbar>
              <Table size="medium" sx={{ minWidth: 900 }}>
                <TableHeadCustom headLabel={TABLE_HEAD} />

                <TableBody>
                  {reports.map((row, index) => (
                    <TableRow key={row.staffId || index} hover>
                      <TableCell>
                        <strong>{row.staffName}</strong>
                      </TableCell>
                      <TableCell>{row.totalWorkedHours?.toFixed(1)}h</TableCell>
                      <TableCell>{row.totalShifts}</TableCell>
                      <TableCell>
                        <Label variant="soft" color="success">
                          {row.presentShifts}
                        </Label>
                      </TableCell>
                      <TableCell>
                        <Label variant="soft" color={row.absentShifts > 0 ? 'error' : 'default'}>
                          {row.absentShifts}
                        </Label>
                      </TableCell>
                      <TableCell>
                        <Label variant="soft" color={row.lateCount > 0 ? 'warning' : 'default'}>
                          {row.lateCount}
                        </Label>
                      </TableCell>
                      <TableCell>{row.totalLateMinutes.toFixed(0)}m</TableCell>
                      <TableCell>{row.overtimeHours.toFixed(1)}h</TableCell>
                      <TableCell>{row.compensationHours.toFixed(1)}h</TableCell>
                    </TableRow>
                  ))}

                  {reports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                        <Typography variant="body2" color="text.secondary">
                          No data for selected period.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        )}
      </Card>
    </Container>
  );
}
