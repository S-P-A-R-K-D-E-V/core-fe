'use client';

import Calendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EventClickArg, DateSelectArg, EventContentArg } from '@fullcalendar/core';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import { useBoolean } from 'src/hooks/use-boolean';
import { useResponsive } from 'src/hooks/use-responsive';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { 
  IShiftSchedule, 
  IShiftAssignment, 
  IAttendanceLog,
  IUser 
} from 'src/types/corecms-api';
import {
  getShiftAssignments,
  createShiftAssignment,
  deleteShiftAssignment,
  bulkAssignShiftSchedule,
  getShiftSchedulesByDateRange,
  getAttendanceLogs,
} from 'src/api/attendance';
import { getAllUsers } from 'src/api/users';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

import { StyledCalendar } from '../../calendar/styles';

// ----------------------------------------------------------------------

interface IAssignmentWithDetails extends IShiftAssignment {
  attendanceLog?: IAttendanceLog;
  scheduleColor?: string;
  scheduleStartTime?: string;
  scheduleEndTime?: string;
}

const WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

// Custom event rendering
function renderEventContent(eventInfo: EventContentArg) {
  const { event } = eventInfo;
  const isBackground = event.display === 'background';
  
  if (isBackground) {
    // Background event (shift schedule)
    return (
      <Box
        sx={{
          p: 0.5,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: 0.3,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {event.title}
        </Typography>
      </Box>
    );
  }

  // Regular event (staff assignment)
  const checkIn = event.extendedProps.checkInTime;
  const checkOut = event.extendedProps.checkOutTime;
  const isLate = event.extendedProps.isLate;

  return (
    <Box sx={{ p: 0.5, height: '100%' }}>
      <Stack spacing={0.25}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Iconify 
            icon="solar:user-bold-duotone" 
            width={14} 
            sx={{ color: 'common.white' }} 
          />
          <Typography 
            variant="caption" 
            sx={{ 
              fontWeight: 600, 
              color: 'common.white',
              fontSize: '0.7rem' 
            }}
          >
            {event.title}
          </Typography>
        </Stack>
        
        {checkIn && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Iconify 
              icon={isLate ? "solar:alarm-bold" : "solar:login-2-bold"} 
              width={12} 
              sx={{ color: isLate ? '#FFA726' : '#4CAF50' }} 
            />
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'common.white', 
                fontSize: '0.65rem',
                opacity: 0.9 
              }}
            >
              In: {checkIn}
            </Typography>
          </Stack>
        )}
        
        {checkOut && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Iconify 
              icon="solar:logout-2-bold" 
              width={12} 
              sx={{ color: '#4CAF50' }} 
            />
            <Typography 
              variant="caption" 
              sx={{ 
                color: 'common.white', 
                fontSize: '0.65rem',
                opacity: 0.9 
              }}
            >
              Out: {checkOut}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

// ----------------------------------------------------------------------

export default function AttendanceAssignmentsWeeklyView() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const settings = useSettingsContext();
  const smUp = useResponsive('up', 'sm');
  const createDialog = useBoolean();
  const bulkDialog = useBoolean();
  const confirm = useBoolean();
  const detailDialog = useBoolean();
  const calendarRef = useRef<any>(null);

  // State
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [schedules, setSchedules] = useState<IShiftSchedule[]>([]);
  const [assignments, setAssignments] = useState<IAssignmentWithDetails[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<IAttendanceLog[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(false);

  // Single assign form
  const [newStaffId, setNewStaffId] = useState('');
  const [newScheduleId, setNewScheduleId] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);

  // Bulk assign form
  const [bulkStaffIds, setBulkStaffIds] = useState<string[]>([]);
  const [bulkScheduleId, setBulkScheduleId] = useState('');
  const [bulkFromDate, setBulkFromDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bulkToDate, setBulkToDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  });
  const [bulkFilterDays, setBulkFilterDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Detail dialog
  const [selectedAssignment, setSelectedAssignment] = useState<IAssignmentWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Calculate week range
  const getWeekRange = useCallback((date: Date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay() + 1); // Monday
    const end = new Date(start);
    end.setDate(end.getDate() + 6); // Sunday
    return {
      fromDate: start.toISOString().split('T')[0],
      toDate: end.toISOString().split('T')[0],
    };
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { fromDate, toDate } = getWeekRange(currentWeek);

      const [schedulesData, assignmentsData, logsData, usersData] = await Promise.all([
        getShiftSchedulesByDateRange(fromDate, toDate),
        getShiftAssignments(fromDate, toDate),
        getAttendanceLogs(fromDate, toDate),
        getAllUsers(),
      ]);


      // Map assignments with attendance logs and colors
      const assignmentsWithDetails: IAssignmentWithDetails[] = assignmentsData.map((assignment) => {
        const schedule = schedulesData.find((s) => s.id === assignment.shiftScheduleId);
        const log = logsData.find((l) => l.shiftAssignmentId === assignment.id);
        return {
          ...assignment,
          scheduleColor: schedule?.color,
          attendanceLog: log,
        };
      });
      setAssignments(assignmentsWithDetails);
      setAttendanceLogs(logsData);

      setUsers(
        usersData.filter(
          (usr) =>
            usr.roles?.includes('Staff') ||
            usr.roles?.includes('Admin') ||
            usr.roles?.includes('Manager')
        )
      );
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to load data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentWeek, getWeekRange, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Transform to calendar events
  const calendarEvents = useMemo(() => {
    const events: any[] = [];
    const { fromDate, toDate } = getWeekRange(currentWeek);

    // Background events: Shift schedules (show schedule blocks)
    schedules.forEach((schedule) => {
      const from = new Date(schedule.fromDate);
      const to = schedule.toDate ? new Date(schedule.toDate) : new Date(toDate);
      
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr >= fromDate && dateStr <= toDate) {
          // Check if schedule repeats on this day
          const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
          const repeatDayValue = dayOfWeek === 0 ? 64 : Math.pow(2, dayOfWeek - 1); // Convert to bit flag
          
          if (schedule.repeatDays & repeatDayValue) {
            events.push({
              id: `schedule-${schedule.id}-${dateStr}`,
              title: schedule.templateName || 'Shift',
              start: `${dateStr}T${schedule.startTime}:00`,
              end: `${dateStr}T${schedule.endTime}:00`,
              backgroundColor: schedule.color,
              borderColor: schedule.color,
              display: 'background',
              extendedProps: {
                type: 'schedule',
                scheduleId: schedule.id,
                templateName: schedule.templateName,
                version: schedule.version,
              },
            });
          }
        }
      }
    });

    // Regular events: Staff assignments with attendance
    assignments.forEach((assignment) => {
      const dateStr = assignment.date.split('T')[0];
      const startTime = assignment.scheduleStartTime || assignment.shiftStartTime || '08:00';
      const endTime = assignment.scheduleEndTime || assignment.shiftEndTime || '17:00';
      const log = assignment.attendanceLog;

      events.push({
        id: assignment.id,
        title: assignment.staffName,
        start: `${dateStr}T${startTime}:00`,
        end: `${dateStr}T${endTime}:00`,
        backgroundColor: assignment.scheduleColor || '#42A5F5',
        borderColor: log?.isLate ? '#FFA726' : (assignment.scheduleColor || '#42A5F5'),
        textColor: '#FFFFFF',
        extendedProps: {
          type: 'assignment',
          assignmentId: assignment.id,
          staffName: assignment.staffName,
          scheduleName: assignment.scheduleName || assignment.shiftName,
          checkInTime: log?.checkInTime ? new Date(log.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null,
          checkOutTime: log?.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null,
          isLate: log?.isLate || false,
          note: assignment.note,
        },
      });
    });

    return events;
  }, [schedules, assignments, currentWeek, getWeekRange]);

  // Handlers
  const handleDatePrev = useCallback(() => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  }, [currentWeek]);

  const handleDateNext = useCallback(() => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeek(newDate);
  }, [currentWeek]);

  const handleDateToday = useCallback(() => {
    setCurrentWeek(new Date());
  }, []);

  const handleClickEvent = useCallback(
    (arg: EventClickArg) => {
      const { extendedProps } = arg.event;
      
      if (extendedProps.type === 'assignment') {
        const assignment = assignments.find((a) => a.id === extendedProps.assignmentId);
        if (assignment) {
          setSelectedAssignment(assignment);
          detailDialog.onTrue();
        }
      }
    },
    [assignments, detailDialog]
  );

  const handleSelectRange = useCallback(
    (arg: DateSelectArg) => {
      const dateStr = new Date(arg.start).toISOString().split('T')[0];
      setNewDate(dateStr);
      createDialog.onTrue();
    },
    [createDialog]
  );

  const handleCreate = async () => {
    try {
      setCreating(true);
      await createShiftAssignment({
        staffId: newStaffId,
        shiftScheduleId: newScheduleId,
        date: newDate,
        note: newNote || undefined,
      });
      enqueueSnackbar('Assignment created!');
      createDialog.onFalse();
      setNewStaffId('');
      setNewScheduleId('');
      setNewNote('');
      fetchData();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Create failed!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleBulkAssign = async () => {
    try {
      setBulkAssigning(true);
      const result = await bulkAssignShiftSchedule({
        staffIds: bulkStaffIds,
        shiftScheduleId: bulkScheduleId,
        fromDate: bulkFromDate,
        toDate: bulkToDate,
        filterDays: bulkFilterDays.length > 0 ? bulkFilterDays : undefined,
      });
      enqueueSnackbar(`Bulk assigned ${result.count} shifts!`, { variant: 'success' });
      bulkDialog.onFalse();
      setBulkStaffIds([]);
      setBulkScheduleId('');
      setBulkFilterDays([1, 2, 3, 4, 5]);
      fetchData();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Bulk assign failed!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteShiftAssignment(id);
        enqueueSnackbar('Deleted!');
        fetchData();
      } catch (error) {
        console.error(error);
        enqueueSnackbar('Delete failed!', { variant: 'error' });
      }
    },
    [enqueueSnackbar, fetchData]
  );

  const toggleBulkStaff = (staffId: string) => {
    setBulkStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const toggleBulkDay = (day: number) => {
    setBulkFilterDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const { fromDate, toDate } = getWeekRange(currentWeek);

  return (
    <>
      <Container maxWidth={settings.themeStretch ? false : 'xl'}>
        <CustomBreadcrumbs
          heading="Lịch phân công ca làm việc"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Attendance', href: paths.dashboard.attendance.root },
            { name: 'Weekly Schedule' },
          ]}
          action={
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<Iconify icon="solar:calendar-add-bold-duotone" />}
                onClick={bulkDialog.onTrue}
              >
                Phân công hàng loạt
              </Button>
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={createDialog.onTrue}
              >
                Phân công ca
              </Button>
            </Stack>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {/* Week Navigation */}
        <Card sx={{ mb: 3, p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <IconButton onClick={handleDatePrev} size="small">
              <Iconify icon="solar:alt-arrow-left-bold" />
            </IconButton>

            <Box sx={{ flexGrow: 1, textAlign: 'center' }}>
              <Typography variant="h6">
                Tuần {fromDate} - {toDate}
              </Typography>
            </Box>

            <IconButton onClick={handleDateNext} size="small">
              <Iconify icon="solar:alt-arrow-right-bold" />
            </IconButton>

            <Button
              variant="outlined"
              size="small"
              onClick={handleDateToday}
              startIcon={<Iconify icon="solar:calendar-bold-duotone" />}
            >
              Hôm nay
            </Button>
          </Stack>
        </Card>

        {/* Calendar */}
        <Card>
          <StyledCalendar>
            <Calendar
              ref={calendarRef}
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              initialDate={currentWeek}
              headerToolbar={false}
              editable={false}
              selectable
              selectMirror
              dayMaxEvents
              weekends
              events={calendarEvents}
              eventContent={renderEventContent}
              eventClick={handleClickEvent}
              select={handleSelectRange}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              slotDuration="01:00:00"
              allDaySlot={false}
              height={smUp ? 800 : 'auto'}
              locale="vi"
              firstDay={1}
              slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
            />
          </StyledCalendar>
        </Card>

        {/* Legend */}
        <Card sx={{ mt: 2, p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Chú thích:
          </Typography>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  bgcolor: alpha(theme.palette.primary.main, 0.3),
                  borderRadius: 0.5,
                }}
              />
              <Typography variant="body2">Khung ca làm việc</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:user-bold-duotone" width={20} color="primary.main" />
              <Typography variant="body2">Nhân viên phân công</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:login-2-bold" width={20} color="success.main" />
              <Typography variant="body2">Đã check-in</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:alarm-bold" width={20} color="warning.main" />
              <Typography variant="body2">Check-in trễ</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:logout-2-bold" width={20} color="success.main" />
              <Typography variant="body2">Đã check-out</Typography>
            </Stack>
          </Stack>
        </Card>
      </Container>

      {/* Single Assign Dialog */}
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
              label="Lịch ca (Schedule)"
              value={newScheduleId}
              onChange={(e) => setNewScheduleId(e.target.value)}
              helperText="Chọn schedule từ template"
            >
              {schedules.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        bgcolor: s.color,
                        borderRadius: '50%',
                      }}
                    />
                    <span>
                      {s.templateName} ({s.startTime} - {s.endTime})
                    </span>
                    <Chip label={`v${s.version}`} size="small" variant="outlined" />
                  </Stack>
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
            disabled={!newStaffId || !newScheduleId || !newDate}
          >
            Phân công
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkDialog.value} onClose={bulkDialog.onFalse} maxWidth="md" fullWidth>
        <DialogTitle>Phân công hàng loạt</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              select
              fullWidth
              label="Lịch ca (Schedule)"
              value={bulkScheduleId}
              onChange={(e) => setBulkScheduleId(e.target.value)}
            >
              {schedules.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        bgcolor: s.color,
                        borderRadius: '50%',
                      }}
                    />
                    <span>
                      {s.templateName} ({s.startTime} - {s.endTime})
                    </span>
                    <Chip label={`v${s.version}`} size="small" variant="outlined" />
                  </Stack>
                </MenuItem>
              ))}
            </TextField>

            <Stack direction="row" spacing={2}>
              <DatePicker
                label="Từ ngày"
                value={parseDateStr(bulkFromDate)}
                onChange={(val) => setBulkFromDate(toDateStr(val))}
                format="dd/MM/yyyy"
                slotProps={{ textField: { fullWidth: true } }}
              />
              <DatePicker
                label="Đến ngày"
                value={parseDateStr(bulkToDate)}
                onChange={(val) => setBulkToDate(toDateStr(val))}
                format="dd/MM/yyyy"
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Stack>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Chọn các ngày trong tuần
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {WEEKDAYS.map((day) => (
                  <Chip
                    key={day.value}
                    label={day.short}
                    onClick={() => toggleBulkDay(day.value)}
                    color={bulkFilterDays.includes(day.value) ? 'primary' : 'default'}
                    variant={bulkFilterDays.includes(day.value) ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Chọn nhân viên ({bulkStaffIds.length} đã chọn)
              </Typography>
              <Box sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                <FormGroup>
                  {users.map((user) => (
                    <FormControlLabel
                      key={user.id}
                      control={
                        <Checkbox
                          checked={bulkStaffIds.includes(user.id)}
                          onChange={() => toggleBulkStaff(user.id)}
                        />
                      }
                      label={`${user.fullName} (${user.email})`}
                    />
                  ))}
                </FormGroup>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={bulkDialog.onFalse}>
            Hủy
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleBulkAssign}
            loading={bulkAssigning}
            disabled={!bulkScheduleId || bulkStaffIds.length === 0 || !bulkFromDate || !bulkToDate}
          >
            Phân công {bulkStaffIds.length} nhân viên
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        fullWidth
        maxWidth="xs"
        open={detailDialog.value}
        onClose={detailDialog.onFalse}
      >
        <DialogTitle>Chi tiết phân công</DialogTitle>
        <DialogContent>
          {selectedAssignment && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Nhân viên
                </Typography>
                <Typography variant="subtitle1">{selectedAssignment.staffName}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Lịch ca (Template)
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      bgcolor: selectedAssignment.scheduleColor,
                      borderRadius: '50%',
                    }}
                  />
                  <Typography variant="subtitle1">
                    {selectedAssignment.scheduleName || selectedAssignment.shiftName}
                  </Typography>
                  {selectedAssignment.scheduleVersion && (
                    <Chip label={`v${selectedAssignment.scheduleVersion}`} size="small" />
                  )}
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Ngày
                </Typography>
                <Typography variant="body2">
                  {new Date(selectedAssignment.date).toLocaleDateString('vi-VN')}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Giờ ca
                </Typography>
                <Typography variant="body2">
                  {selectedAssignment.scheduleStartTime || selectedAssignment.shiftStartTime} -{' '}
                  {selectedAssignment.scheduleEndTime || selectedAssignment.shiftEndTime}
                </Typography>
              </Box>

              {selectedAssignment.attendanceLog && (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Check-in
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Iconify
                        icon={selectedAssignment.attendanceLog.isLate ? "solar:alarm-bold" : "solar:login-2-bold"}
                        width={18}
                        color={selectedAssignment.attendanceLog.isLate ? 'warning.main' : 'success.main'}
                      />
                      <Typography variant="body2">
                        {selectedAssignment.attendanceLog.checkInTime
                          ? new Date(selectedAssignment.attendanceLog.checkInTime).toLocaleTimeString('vi-VN')
                          : '—'}
                        {selectedAssignment.attendanceLog.isLate && (
                          <Typography component="span" color="warning.main" sx={{ ml: 1 }}>
                            (Trễ {selectedAssignment.attendanceLog.lateMinutes} phút)
                          </Typography>
                        )}
                      </Typography>
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Check-out
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Iconify icon="solar:logout-2-bold" width={18} color="success.main" />
                      <Typography variant="body2">
                        {selectedAssignment.attendanceLog.checkOutTime
                          ? new Date(selectedAssignment.attendanceLog.checkOutTime).toLocaleTimeString('vi-VN')
                          : '—'}
                      </Typography>
                    </Stack>
                  </Box>
                </>
              )}

              {selectedAssignment.note && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Ghi chú
                  </Typography>
                  <Typography variant="body2">{selectedAssignment.note}</Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={detailDialog.onFalse}>
            Đóng
          </Button>
          {selectedAssignment && (
            <Button
              color="error"
              onClick={() => {
                setDeleteTarget(selectedAssignment.id);
                detailDialog.onFalse();
                confirm.onTrue();
              }}
            >
              Xóa
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Xác nhận xóa"
        content="Bạn có chắc chắn muốn xóa phân công này?"
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (deleteTarget) {
                handleDelete(deleteTarget);
                setDeleteTarget(null);
              }
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

