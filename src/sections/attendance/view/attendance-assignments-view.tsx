'use client';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EventClickArg, DateSelectArg } from '@fullcalendar/core';

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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import { useBoolean } from 'src/hooks/use-boolean';
import { useResponsive } from 'src/hooks/use-responsive';

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
import { ICalendarEvent, ICalendarView } from 'src/types/calendar';
import {
  getShiftAssignments,
  createShiftAssignment,
  deleteShiftAssignment,
  getAllShifts,
} from 'src/api/attendance';
import { getAllUsers } from 'src/api/users';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

import { StyledCalendar } from '../../calendar/styles';
import CalendarToolbar from '../../calendar/calendar-toolbar';

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

function transformAssignmentToEvent(assignment: IShiftAssignment): ICalendarEvent {
  const dateStr = assignment.date.split('T')[0];
  const startDateTime = `${dateStr}T${assignment.shiftStartTime}:00`;
  const endDateTime = `${dateStr}T${assignment.shiftEndTime}:00`;

  return {
    id: assignment.id,
    title: `${assignment.staffName} - ${assignment.shiftName}`,
    start: new Date(startDateTime).getTime(),
    end: new Date(endDateTime).getTime(),
    allDay: false,
    color: assignment.shiftType === 'Holiday' ? '#FFA726' : '#42A5F5',
    description: assignment.note || '',
  };
}

// ----------------------------------------------------------------------

export default function AttendanceAssignmentsView() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const settings = useSettingsContext();
  const smUp = useResponsive('up', 'sm');
  const createDialog = useBoolean();
  const confirm = useBoolean();
  const detailDialog = useBoolean();
  const calendarRef = useRef<any>(null);

  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [tableData, setTableData] = useState<IShiftAssignment[]>([]);
  const [shifts, setShifts] = useState<IShift[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  });
  const [filterStaffId, setFilterStaffId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<IShiftAssignment | null>(null);

  // Calendar state
  const [view, setView] = useState<ICalendarView>(smUp ? 'dayGridMonth' : 'listWeek');
  const [date, setDate] = useState(new Date());

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
        setUsers(
          u.filter(
            (usr) =>
              usr.roles?.includes('Staff') ||
              usr.roles?.includes('Admin') ||
              usr.roles?.includes('Manager')
          )
        );
      } catch (error) {
        console.error(error);
      }
    };
    loadMeta();
  }, []);

  // Transform assignments to calendar events
  const events: ICalendarEvent[] = useMemo(
    () => tableData.map(transformAssignmentToEvent),
    [tableData]
  );

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

  // Calendar handlers
  const handleChangeView = useCallback((newView: ICalendarView) => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(newView);
      setView(newView);
    }
  }, []);

  const handleDateToday = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.today();
      setDate(calendarApi.getDate());
    }
  }, []);

  const handleDatePrev = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.prev();
      setDate(calendarApi.getDate());
    }
  }, []);

  const handleDateNext = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.next();
      setDate(calendarApi.getDate());
    }
  }, []);

  const handleClickEvent = useCallback(
    (arg: EventClickArg) => {
      const eventId = arg.event.id;
      const assignment = tableData.find((a) => a.id === eventId);
      if (assignment) {
        setSelectedEvent(assignment);
        detailDialog.onTrue();
      }
    },
    [tableData, detailDialog]
  );

  const handleSelectRange = useCallback(
    (arg: DateSelectArg) => {
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.unselect();
      }
      const dateStr = new Date(arg.start).toISOString().split('T')[0];
      setNewDate(dateStr);
      createDialog.onTrue();
    },
    [createDialog]
  );

  return (
    <>
      <Container maxWidth={settings.themeStretch ? false : 'xl'}>
        <CustomBreadcrumbs
          heading="Phân công ca làm việc"
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
              Phân công ca
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {/* Filters */}
        <Card sx={{ mb: 3, p: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <DatePicker
              label="Từ ngày"
              value={parseDateStr(fromDate)}
              onChange={(val) => setFromDate(toDateStr(val))}
              format="dd/MM/yyyy"
              slotProps={{ textField: { sx: { width: { xs: 1, md: 180 } } } }}
            />
            <DatePicker
              label="Đến ngày"
              value={parseDateStr(toDate)}
              onChange={(val) => setToDate(toDateStr(val))}
              format="dd/MM/yyyy"
              slotProps={{ textField: { sx: { width: { xs: 1, md: 180 } } } }}
            />

            <TextField
              select
              label="Nhân viên"
              value={filterStaffId}
              onChange={(e) => setFilterStaffId(e.target.value)}
              sx={{ width: { xs: 1, md: 250 } }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ flexGrow: 1 }} />

            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newValue) => {
                if (newValue !== null) setViewMode(newValue);
              }}
              size="small"
            >
              <ToggleButton value="calendar">
                <Iconify icon="solar:calendar-bold-duotone" width={20} sx={{ mr: 0.5 }} />
                Lịch
              </ToggleButton>
              <ToggleButton value="table">
                <Iconify icon="solar:list-bold-duotone" width={20} sx={{ mr: 0.5 }} />
                Bảng
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Card>

        {viewMode === 'calendar' ? (
          /* ========== Calendar View ========== */
          <Card>
            <StyledCalendar>
              <CalendarToolbar
                date={date}
                view={view}
                loading={false}
                onNextDate={handleDateNext}
                onPrevDate={handleDatePrev}
                onToday={handleDateToday}
                onChangeView={handleChangeView}
                onOpenFilters={() => {}}
              />

              <Calendar
                weekends
                selectable
                editable={false}
                droppable={false}
                rerenderDelay={10}
                allDayMaintainDuration
                ref={calendarRef}
                initialDate={date}
                initialView={view}
                dayMaxEventRows={3}
                eventDisplay="block"
                events={events}
                headerToolbar={false}
                eventClick={handleClickEvent}
                select={handleSelectRange}
                height={smUp ? 720 : 'auto'}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              />
            </StyledCalendar>
          </Card>
        ) : (
          /* ========== Table View ========== */
          <Card>
            <Scrollbar>
              <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
                <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
                  <TableHeadCustom headLabel={TABLE_HEAD} />

                  <TableBody>
                    {dataInPage.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.staffName}</TableCell>
                        <TableCell>{row.shiftName}</TableCell>
                        <TableCell>
                          {new Date(row.date).toLocaleDateString('vi-VN')}
                        </TableCell>
                        <TableCell>{row.shiftStartTime}</TableCell>
                        <TableCell>{row.shiftEndTime}</TableCell>
                        <TableCell>
                          <Label
                            variant="soft"
                            color={row.shiftType === 'Holiday' ? 'warning' : 'info'}
                          >
                            {row.shiftType}
                          </Label>
                        </TableCell>
                        <TableCell>{row.note || '—'}</TableCell>
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
                      height={52}
                      emptyRows={emptyRows(table.page, table.rowsPerPage, tableData.length)}
                    />

                    <TableNoData notFound={!tableData.length} />
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>

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
        )}
      </Container>

      {/* Create Dialog */}
      <Dialog open={createDialog.value} onClose={createDialog.onFalse} maxWidth="sm" fullWidth>
        <DialogTitle>Phân công ca làm việc</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              select
              fullWidth
              label="Nhân viên"
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
              label="Ca làm việc"
              value={newShiftId}
              onChange={(e) => setNewShiftId(e.target.value)}
            >
              {shifts.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s.startTime} - {s.endTime})
                </MenuItem>
              ))}
            </TextField>

            <DatePicker
              label="Ngày"
              value={parseDateStr(newDate)}
              onChange={(val) => setNewDate(toDateStr(val))}
              format="dd/MM/yyyy"
              slotProps={{ textField: { fullWidth: true } }}
            />

            <TextField
              fullWidth
              label="Ghi chú"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={createDialog.onFalse}>
            Hủy
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleCreate}
            loading={creating}
            disabled={!newStaffId || !newShiftId || !newDate}
          >
            Phân công
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Event Detail Dialog */}
      <Dialog
        fullWidth
        maxWidth="xs"
        open={detailDialog.value}
        onClose={detailDialog.onFalse}
        transitionDuration={{
          enter: theme.transitions.duration.shortest,
          exit: theme.transitions.duration.shortest - 80,
        }}
      >
        <DialogTitle>Chi tiết phân công</DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Nhân viên
                </Typography>
                <Typography variant="subtitle1">{selectedEvent.staffName}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Ca làm việc
                </Typography>
                <Typography variant="subtitle1">{selectedEvent.shiftName}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Ngày
                </Typography>
                <Typography variant="body2">
                  {new Date(selectedEvent.date).toLocaleDateString('vi-VN')}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Giờ
                </Typography>
                <Typography variant="body2">
                  {selectedEvent.shiftStartTime} - {selectedEvent.shiftEndTime}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Loại ca
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Label
                    variant="soft"
                    color={selectedEvent.shiftType === 'Holiday' ? 'warning' : 'info'}
                  >
                    {selectedEvent.shiftType}
                  </Label>
                </Box>
              </Box>

              {selectedEvent.note && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Ghi chú
                  </Typography>
                  <Typography variant="body2">{selectedEvent.note}</Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={detailDialog.onFalse}>
            Đóng
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (selectedEvent) {
                setDeleteTarget(selectedEvent.id);
                detailDialog.onFalse();
                confirm.onTrue();
              }
            }}
          >
            Xóa
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Xóa phân công"
        content="Bạn có chắc muốn xóa phân công này không?"
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (deleteTarget) handleDelete(deleteTarget);
              confirm.onFalse();
            }}
          >
            Xóa
          </Button>
        }
      />
    </>
  );
}
