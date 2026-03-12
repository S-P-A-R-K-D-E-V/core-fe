'use client';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EventClickArg } from '@fullcalendar/core';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Grid from '@mui/material/Unstable_Grid2';
import { useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import { useResponsive } from 'src/hooks/use-responsive';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';

import { IShiftAssignment, IAttendanceLog, IAttendanceReport } from 'src/types/corecms-api';
import { ICalendarEvent, ICalendarView } from 'src/types/calendar';
import { getMySchedule, getMyAttendanceLogs, getMyAttendanceReport } from 'src/api/attendance';

import { StyledCalendar } from '../../calendar/styles';
import CalendarToolbar from '../../calendar/calendar-toolbar';

// ----------------------------------------------------------------------

interface IAssignmentWithDetails extends IShiftAssignment {
  attendanceLog?: IAttendanceLog;
}

type ViewMode = 'calendar' | 'table';

// ----------------------------------------------------------------------

function getMonthRange(offset: number) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0],
  };
}

function formatTime(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function getEventColor(assignment: IAssignmentWithDetails): string {
  if (!assignment.attendanceLog) return '#9E9E9E'; // grey - no attendance
  if (assignment.attendanceLog.isOvertime) return '#AB47BC'; // purple - OT
  if (assignment.attendanceLog.isLate) return '#FFA726'; // orange - late
  if (assignment.attendanceLog.checkInTime && assignment.attendanceLog.checkOutTime) return '#66BB6A'; // green - complete
  if (assignment.attendanceLog.checkInTime) return '#42A5F5'; // blue - only checkin
  return '#9E9E9E';
}

function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'OnTime':
    case 'Present':
      return 'success';
    case 'Late':
      return 'warning';
    case 'Absent':
      return 'error';
    default:
      return 'default';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'OnTime':
      return 'Đúng giờ';
    case 'Late':
      return 'Trễ';
    case 'Absent':
      return 'Vắng';
    case 'Present':
      return 'Có mặt';
    default:
      return status;
  }
}

function transformAssignmentToEvent(assignment: IAssignmentWithDetails): ICalendarEvent {
  const dateStr = assignment.date.split('T')[0];
  const startDateTime = `${dateStr}T${assignment.startTime}:00`;
  const endDateTime = `${dateStr}T${assignment.endTime}:00`;

  let title = assignment.shiftName || assignment.scheduleName;
  if (assignment.attendanceLog?.checkInTime) {
    const checkIn = formatTime(assignment.attendanceLog.checkInTime);
    const checkOut = assignment.attendanceLog.checkOutTime
      ? formatTime(assignment.attendanceLog.checkOutTime)
      : '..:..';
    title = `${title} (${checkIn} - ${checkOut})`;
  }

  return {
    id: assignment.assignmentId,
    title: title ?? '',
    start: new Date(startDateTime).getTime(),
    end: new Date(endDateTime).getTime(),
    allDay: false,
    color: getEventColor(assignment),
    description: assignment.attendanceLog?.isOvertime ? 'OT' : '',
  };
}

function transformOtLogToEvent(log: IAttendanceLog): ICalendarEvent {
  const checkIn = log.checkInTime ? new Date(log.checkInTime) : new Date(log.createdAt);
  const checkOut = log.checkOutTime ? new Date(log.checkOutTime) : checkIn;

  const checkInStr = formatTime(log.checkInTime);
  const checkOutStr = log.checkOutTime ? formatTime(log.checkOutTime) : '..:..';

  return {
    id: `ot-${log.id}`,
    title: `OT (${checkInStr} - ${checkOutStr})`,
    start: checkIn.getTime(),
    end: checkOut.getTime(),
    allDay: false,
    color: '#AB47BC', // purple
    description: 'OT',
  };
}

// ======================================================================

export default function MyLogsView() {
  const theme = useTheme();
  const settings = useSettingsContext();
  const smUp = useResponsive('up', 'sm');
  const calendarRef = useRef<any>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [monthOffset, setMonthOffset] = useState(0);
  const [assignments, setAssignments] = useState<IAssignmentWithDetails[]>([]);
  const [standaloneOtLogs, setStandaloneOtLogs] = useState<IAttendanceLog[]>([]);
  const [report, setReport] = useState<IAttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarView, setCalendarView] = useState<ICalendarView>(smUp ? 'dayGridMonth' : 'listWeek');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedAssignment, setSelectedAssignment] = useState<IAssignmentWithDetails | null>(null);
  const [selectedOtLogs, setSelectedOtLogs] = useState<IAttendanceLog[]>([]);
  const [selectedOtDate, setSelectedOtDate] = useState<string>('');
  const [openDialog, setOpenDialog] = useState(false);

  const monthInfo = getMonthRange(monthOffset);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduleData, logsData, reportData] = await Promise.all([
        getMySchedule(monthInfo.from, monthInfo.to),
        getMyAttendanceLogs(monthInfo.from, monthInfo.to),
        getMyAttendanceReport(monthInfo.from, monthInfo.to),
      ]);

      // Track which logs are linked to assignments
      const linkedLogIds = new Set<string>();

      // Merge attendance data with shift assignments
      const enriched: IAssignmentWithDetails[] = scheduleData.map((assignment) => {
        const log = logsData.find((l) => l.shiftAssignmentId === assignment.assignmentId);
        if (log) linkedLogIds.add(log.id);
        return { ...assignment, attendanceLog: log };
      });

      // Standalone OT logs (not linked to any assignment)
      const otLogs = logsData.filter((l) => l.isOvertime && !linkedLogIds.has(l.id));

      setAssignments(enriched);
      setStandaloneOtLogs(otLogs);
      setReport(reportData);
    } catch (error) {
      console.error('Failed to fetch my logs:', error);
    } finally {
      setLoading(false);
    }
  }, [monthInfo.from, monthInfo.to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // All logs for table view (from assignments + standalone OT)
  const allLogs = useMemo(() => {
    const fromAssignments = assignments
      .filter((a) => a.attendanceLog)
      .map((a) => a.attendanceLog!);
    return [...fromAssignments, ...standaloneOtLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [assignments, standaloneOtLogs]);

  // Calendar events
  const events: ICalendarEvent[] = useMemo(() => {
    const assignmentEvents = assignments.map(transformAssignmentToEvent);
    const otEvents = standaloneOtLogs.map(transformOtLogToEvent);
    return [...assignmentEvents, ...otEvents];
  }, [assignments, standaloneOtLogs]);

  // Calendar handlers
  const handleChangeView = useCallback((newView: ICalendarView) => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(newView);
      setCalendarView(newView);
    }
  }, []);

  const handleDateToday = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.today();
      setCalendarDate(calendarApi.getDate());
      setMonthOffset(0);
    }
  }, []);

  const handleDatePrev = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.prev();
      setCalendarDate(calendarApi.getDate());
      setMonthOffset((prev) => prev - 1);
    }
  }, []);

  const handleDateNext = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.next();
      setCalendarDate(calendarApi.getDate());
      setMonthOffset((prev) => prev + 1);
    }
  }, []);

  const handleClickEvent = useCallback(
    (arg: EventClickArg) => {
      const eventId = arg.event.id;

      // Check if it's a standalone OT event — show all OT logs for that day
      if (eventId.startsWith('ot-')) {
        const logId = eventId.replace('ot-', '');
        const clickedLog = standaloneOtLogs.find((l) => l.id === logId);
        if (clickedLog) {
          const clickedDate = (clickedLog.checkInTime || clickedLog.createdAt).split('T')[0];
          const dayOtLogs = standaloneOtLogs.filter((l) => {
            const logDate = (l.checkInTime || l.createdAt).split('T')[0];
            return logDate === clickedDate;
          });
          setSelectedOtLogs(dayOtLogs);
          setSelectedOtDate(clickedDate);
          setSelectedAssignment(null);
          setOpenDialog(true);
        }
        return;
      }

      // Regular assignment event
      const assignment = assignments.find((a) => a.assignmentId === eventId);
      if (assignment) {
        setSelectedAssignment(assignment);
        setSelectedOtLogs([]);
        setOpenDialog(true);
      }
    },
    [assignments, standaloneOtLogs]
  );

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedAssignment(null);
    setSelectedOtLogs([]);
    setSelectedOtDate('');
  }, []);

  // Stats
  const otCount = useMemo(
    () =>
      assignments.filter((a) => a.attendanceLog?.isOvertime).length + standaloneOtLogs.length,
    [assignments, standaloneOtLogs]
  );

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Lịch sử chấm công"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Attendance', href: paths.dashboard.attendance.root },
          { name: 'Lịch sử chấm công' },
        ]}
        action={
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
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
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {/* Summary cards */}
      {report && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid xs={6} sm={4} md={2}>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Iconify icon="solar:clock-circle-bold-duotone" width={28} color="primary.main" />
              <Typography variant="h5" mt={0.5}>
                {report.totalWorkedHours === 0
                  ? 0
                  : (report.totalWorkedHours / 60).toFixed(1)}
                h
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tổng giờ làm
              </Typography>
            </Card>
          </Grid>
          <Grid xs={6} sm={4} md={2}>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Iconify icon="solar:calendar-bold-duotone" width={28} color="success.main" />
              <Typography variant="h5" mt={0.5}>
                {report.presentShifts}/{report.totalShifts}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Ca có mặt
              </Typography>
            </Card>
          </Grid>
          <Grid xs={6} sm={4} md={2}>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Iconify icon="solar:alarm-bold-duotone" width={28} color="warning.main" />
              <Typography variant="h5" mt={0.5}>
                {report.lateCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Trễ ({report.totalLateMinutes} phút)
              </Typography>
            </Card>
          </Grid>
          <Grid xs={6} sm={4} md={2}>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Iconify icon="solar:close-circle-bold-duotone" width={28} color="error.main" />
              <Typography variant="h5" mt={0.5}>
                {report.absentShifts}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Vắng mặt
              </Typography>
            </Card>
          </Grid>
          <Grid xs={6} sm={4} md={2}>
            <Card sx={{ p: 2, textAlign: 'center' }}>
              <Iconify icon="solar:moon-bold-duotone" width={28} color="secondary.main" />
              <Typography variant="h5" mt={0.5}>
                {otCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tăng ca
              </Typography>
            </Card>
          </Grid>
          {report.overtimeHours > 0 && (
            <Grid xs={6} sm={4} md={2}>
              <Card sx={{ p: 2, textAlign: 'center' }}>
                <Iconify icon="solar:sun-bold-duotone" width={28} color="info.main" />
                <Typography variant="h5" mt={0.5}>
                  {report.overtimeHours.toFixed(1)}h
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Giờ tăng ca
                </Typography>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Calendar view — always mounted to preserve navigation state */}
      {viewMode === 'calendar' && (
        <Card sx={{ position: 'relative' }}>
          {loading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.6)',
                zIndex: 10,
                borderRadius: 'inherit',
              }}
            >
              <CircularProgress />
            </Box>
          )}
          <StyledCalendar>
            <CalendarToolbar
              date={calendarDate}
              view={calendarView}
              loading={loading}
              onNextDate={handleDateNext}
              onPrevDate={handleDatePrev}
              onToday={handleDateToday}
              onChangeView={handleChangeView}
              onOpenFilters={() => {}}
            />

            <Calendar
              weekends
              selectable={false}
              editable={false}
              droppable={false}
              rerenderDelay={10}
              allDayMaintainDuration
              ref={calendarRef}
              initialDate={calendarDate}
              initialView={calendarView}
              dayMaxEventRows={3}
              eventDisplay="block"
              events={events}
              headerToolbar={false}
              eventClick={handleClickEvent}
              height={smUp ? 720 : 'auto'}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              eventContent={(eventInfo) => {
                const eventId = eventInfo.event.id;
                const isOt = eventId.startsWith('ot-');
                let color: string;

                if (isOt) {
                  color = '#AB47BC';
                } else {
                  const assignment = assignments.find((a) => a.assignmentId === eventId);
                  color = assignment ? getEventColor(assignment) : '#9E9E9E';
                }

                return (
                  <Box
                    sx={{
                      width: '100%',
                      borderRadius: 1,
                      overflow: 'hidden',
                      fontSize: 12,
                    }}
                  >
                    <Box
                      sx={{
                        px: 1,
                        py: 0.5,
                        fontWeight: 600,
                        borderBottom: '1px solid rgba(255,255,255,0.3)',
                        color,
                        backgroundColor: `${color}33`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      {(isOt ||
                        assignments.find((a) => a.assignmentId === eventId)?.attendanceLog
                          ?.isOvertime) && (
                        <Iconify
                          icon="solar:moon-bold-duotone"
                          width={14}
                          sx={{ flexShrink: 0 }}
                        />
                      )}
                      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {eventInfo.event.title}
                      </Box>
                    </Box>
                  </Box>
                );
              }}
            />
          </StyledCalendar>
        </Card>
      )}

      {/* Table view */}
      {viewMode === 'table' && (
        loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Ngày</TableCell>
                    <TableCell>Check In</TableCell>
                    <TableCell>Check Out</TableCell>
                    <TableCell>Giờ làm</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell>Trễ</TableCell>
                    <TableCell>OT</TableCell>
                    <TableCell>Ghi chú</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography variant="body2" color="text.secondary" py={3}>
                          Không có dữ liệu chấm công trong tháng này.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    allLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Typography variant="body2">{formatDate(log.createdAt)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{formatTime(log.checkInTime)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{formatTime(log.checkOutTime)}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {log.workedHours != null ? `${log.workedHours.toFixed(1)}h` : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Label variant="soft" color={getStatusColor(log.status)}>
                            {getStatusLabel(log.status)}
                          </Label>
                        </TableCell>
                        <TableCell>
                          {log.isLate ? (
                            <Typography variant="body2" color="warning.main">
                              {log.lateMinutes} phút
                            </Typography>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          {log.isOvertime ? (
                            <Label variant="soft" color="secondary">
                              <Iconify icon="solar:moon-bold-duotone" width={14} sx={{ mr: 0.5 }} />
                              OT
                            </Label>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            {log.isAutoClosedBySystem && (
                              <Label variant="soft" color="default">
                                Tự đóng
                              </Label>
                            )}
                            {log.checkInFaceVerified && (
                              <Label variant="soft" color="success">
                                Face ✓
                              </Label>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )
      )}

      {/* Event Detail Dialog */}
      <Dialog
        fullWidth
        maxWidth="xs"
        open={openDialog}
        onClose={handleCloseDialog}
        transitionDuration={{
          enter: theme.transitions.duration.shortest,
          exit: theme.transitions.duration.shortest - 80,
        }}
      >
        <DialogTitle>
          {selectedOtLogs.length > 0 ? `Tăng ca ngày ${selectedOtDate ? formatDate(selectedOtDate) : ''}` : 'Chi tiết ca làm việc'}
        </DialogTitle>
        <DialogContent>
          {/* Assignment detail */}
          {selectedAssignment && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Ca làm việc
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="subtitle1">
                    {selectedAssignment.shiftName || selectedAssignment.scheduleName}
                  </Typography>
                  {selectedAssignment.attendanceLog?.isOvertime && (
                    <Label variant="soft" color="secondary">
                      OT
                    </Label>
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
                  {selectedAssignment.startTime} - {selectedAssignment.endTime}
                </Typography>
              </Box>

              {selectedAssignment.shiftType && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Loại ca
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Label
                      variant="soft"
                      color={selectedAssignment.shiftType === 'Holiday' ? 'warning' : 'info'}
                    >
                      {selectedAssignment.shiftType}
                    </Label>
                  </Box>
                </Box>
              )}

              {selectedAssignment.note && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Ghi chú
                  </Typography>
                  <Typography variant="body2">{selectedAssignment.note}</Typography>
                </Box>
              )}

              {/* Attendance section */}
              {selectedAssignment.attendanceLog ? (
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                    Thông tin chấm công
                  </Typography>

                  {selectedAssignment.attendanceLog.checkInTime && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Giờ vào
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2">
                          {new Date(
                            selectedAssignment.attendanceLog.checkInTime
                          ).toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </Typography>
                        {selectedAssignment.attendanceLog.isLate && (
                          <Label variant="soft" color="warning" sx={{ py: 0 }}>
                            Muộn {selectedAssignment.attendanceLog.lateMinutes} phút
                          </Label>
                        )}
                      </Stack>
                    </Box>
                  )}

                  {selectedAssignment.attendanceLog.checkOutTime && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Giờ ra
                      </Typography>
                      <Typography variant="body2">
                        {new Date(
                          selectedAssignment.attendanceLog.checkOutTime
                        ).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </Typography>
                    </Box>
                  )}

                  {selectedAssignment.attendanceLog.workedHours !== undefined && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Tổng giờ làm
                      </Typography>
                      <Typography variant="body2">
                        {selectedAssignment.attendanceLog.workedHours.toFixed(2)} giờ
                      </Typography>
                    </Box>
                  )}

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Trạng thái
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Label
                        variant="soft"
                        color={getStatusColor(selectedAssignment.attendanceLog.status)}
                      >
                        {getStatusLabel(selectedAssignment.attendanceLog.status)}
                      </Label>
                    </Box>
                  </Box>

                  {selectedAssignment.attendanceLog.isAutoClosedBySystem && (
                    <Box sx={{ mt: 1 }}>
                      <Label variant="soft" color="default">
                        Tự đóng bởi hệ thống
                      </Label>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 1 }}>
                  <Label variant="soft" color="default">
                    Chưa chấm công
                  </Label>
                </Box>
              )}
            </Stack>
          )}

          {/* All OT logs for the selected day */}
          {selectedOtLogs.length > 0 && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {selectedOtLogs.map((otLog, index) => (
                <Box
                  key={otLog.id}
                  sx={{
                    ...(index > 0 && { borderTop: 1, borderColor: 'divider', pt: 2 }),
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Label variant="soft" color="secondary">
                        <Iconify icon="solar:moon-bold-duotone" width={16} sx={{ mr: 0.5 }} />
                        OT #{index + 1}
                      </Label>
                      <Label variant="soft" color={getStatusColor(otLog.status)}>
                        {getStatusLabel(otLog.status)}
                      </Label>
                      {otLog.isAutoClosedBySystem && (
                        <Label variant="soft" color="default">
                          Tự đóng
                        </Label>
                      )}
                    </Stack>

                    <Stack direction="row" spacing={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Giờ vào
                        </Typography>
                        <Typography variant="body2">
                          {formatTime(otLog.checkInTime)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Giờ ra
                        </Typography>
                        <Typography variant="body2">
                          {formatTime(otLog.checkOutTime)}
                        </Typography>
                      </Box>
                      {otLog.workedHours !== undefined && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Giờ làm
                          </Typography>
                          <Typography variant="body2">
                            {otLog.workedHours?.toFixed(2)}h
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              ))}

              {/* Total OT hours for the day */}
              {selectedOtLogs.length > 1 && (
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="subtitle2">Tổng OT:</Typography>
                    <Typography variant="subtitle2" color="secondary.main">
                      {selectedOtLogs
                        .reduce((sum, l) => sum + (l.workedHours ?? 0), 0)
                        .toFixed(2)}h
                    </Typography>
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
