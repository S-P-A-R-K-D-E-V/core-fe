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
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import { useResponsive } from 'src/hooks/use-responsive';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Label from 'src/components/label';

import { IShiftSchedule, IShiftAssignment, IAttendanceLog } from 'src/types/corecms-api';
import { ICalendarEvent, ICalendarView } from 'src/types/calendar';
import { getMySchedule, getMyAttendanceLogs, getShiftSchedulesByDateRange } from 'src/api/attendance';

import { usePageTours } from 'src/hooks/use-tour';
import type { TourDefinition } from 'src/hooks/use-tour';

import { StyledCalendar } from '../../calendar/styles';
import CalendarToolbar from '../../calendar/calendar-toolbar';
import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

interface IAssignmentWithDetails extends IShiftAssignment {
  attendanceLog?: IAttendanceLog;
  scheduleColor?: string;
}

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

function getEventColor(assignment: IAssignmentWithDetails): string {
  if (!assignment.attendanceLog) {
    // Chưa có attendance - màu xám
    return '#9E9E9E';
  }
  if (assignment.attendanceLog.isLate) {
    // Đi muộn - màu cam
    return '#FFA726';
  }
  if (assignment.attendanceLog.checkInTime && assignment.attendanceLog.checkOutTime) {
    // Đã checkin & checkout - màu xanh lá
    return '#66BB6A';
  }
  if (assignment.attendanceLog.checkInTime) {
    // Chỉ có checkin - màu xanh dương
    return '#42A5F5';
  }
  return '#9E9E9E';
}

function getStatusColor(status: string): 'success' | 'error' | 'warning' {
  if (status === 'Present') return 'success';
  if (status === 'Absent') return 'error';
  return 'warning';
}

function transformAssignmentToEvent(assignment: IAssignmentWithDetails): ICalendarEvent {
  const dateStr = assignment.date.split('T')[0];
  const startDateTime = `${dateStr}T${assignment.startTime}:00`;
  const endDateTime = `${dateStr}T${assignment.endTime}:00`;

  let title = assignment.shiftName;
  if (assignment.attendanceLog?.checkInTime) {
    const checkInTime = new Date(assignment.attendanceLog.checkInTime).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const checkOutTime = assignment.attendanceLog.checkOutTime
      ? new Date(assignment.attendanceLog.checkOutTime).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : "..:..";
    title = `${assignment.shiftName} (${checkInTime}${checkOutTime ? ` - ${checkOutTime}` : ''})`;
  }

  return {
    id: assignment.assignmentId,
    title: title ?? '',
    start: new Date(startDateTime).getTime(),
    end: new Date(endDateTime).getTime(),
    allDay: false,
    color: getEventColor(assignment),
    description: assignment.note || '',
  };
}

export default function MyScheduleView() {
  const theme = useTheme();
  const settings = useSettingsContext();
  const smUp = useResponsive('up', 'sm');
  const calendarRef = useRef<any>(null);

  const [monthOffset, setMonthOffset] = useState(0);
  const [assignments, setAssignments] = useState<IAssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ICalendarView>(smUp ? 'dayGridMonth' : 'listWeek');
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<IAssignmentWithDetails | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  // Tour state
  const [tourMenuAnchor, setTourMenuAnchor] = useState<null | HTMLElement>(null);

  const monthInfo = getMonthRange(monthOffset);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduleData, attendanceData] = await Promise.all([
        getMySchedule(monthInfo.from, monthInfo.to),
        getMyAttendanceLogs(monthInfo.from, monthInfo.to),
      ]);

      // Merge attendance data with shift assignments
      const enrichedAssignments: IAssignmentWithDetails[] = scheduleData.map((assignment) => {
        const attendanceLog = attendanceData.find(
          (log) => log.shiftAssignmentId === assignment.assignmentId
        );
        return {
          ...assignment,
          attendanceLog,
        };
      });
      setAssignments(enrichedAssignments);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoading(false);
    }
  }, [monthInfo.from, monthInfo.to]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Transform assignments to calendar events
  const events: ICalendarEvent[] = useMemo(
    () => assignments.map(transformAssignmentToEvent),
    [assignments]
  );

  const handleChangeView = useCallback((newView: ICalendarView) => {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(newView);
    if (calendarRef.current) {
      setView(newView);
    }
  }, []);

  const handleDateToday = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.today();
      setDate(calendarApi.getDate());
      setMonthOffset(0);
    }
  }, []);

  const handleDatePrev = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.prev();
      setDate(calendarApi.getDate());
      setMonthOffset((prev) => prev - 1);
    }
  }, []);

  const handleDateNext = useCallback(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.next();
      setDate(calendarApi.getDate());
      setMonthOffset((prev) => prev + 1);
    }
  }, []);

  const handleClickEvent = useCallback(
    (arg: EventClickArg) => {
      const { extendedProps } = arg.event;

      // Find assignment for this event
      if (extendedProps.myAssignment) {
        const assignment = assignments.find((a) => a.assignmentId === extendedProps.myAssignment.assignmentId);
        if (assignment) {
          setSelectedEvent(assignment);
          setOpenDialog(true);
        }
      }
    },
    [assignments]
  );

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedEvent(null);
  }, []);

  // ── Tour definitions ──

  const SCHEDULE_TOURS: TourDefinition[] = useMemo(
    () => [
      {
        tourKey: 'my-schedule-overview',
        label: 'Tổng quan lịch làm',
        steps: [
          {
            element: '#tour-calendar-toolbar',
            popover: {
              title: 'Điều hướng lịch',
              description:
                'Dùng các nút mũi tên để chuyển tháng, nút "Hôm nay" để về tháng hiện tại. Bạn cũng có thể chuyển chế độ xem: Tháng / Tuần / Danh sách.',
              side: 'bottom' as const,
              align: 'center' as const,
            },
          },
          {
            element: '#tour-calendar-body',
            popover: {
              title: 'Lịch ca làm việc',
              description:
                'Hiển thị các ca được phân của bạn. Màu sắc thể hiện trạng thái chấm công:\n\n\u2B1C Xám = Chưa chấm công\n\ud83d\udfe6 Xanh dương = Đã check-in (chưa check-out)\n\ud83d\udfe7 Cam = Đi muộn\n\ud83d\udfe9 Xanh lá = Hoàn thành (check-in & check-out)\n\nNhấn vào ca bất kỳ để xem chi tiết.',
              side: 'top' as const,
              align: 'center' as const,
            },
          },
          {
            element: '#tour-month-summary',
            popover: {
              title: 'Tổng quan tháng',
              description:
                'Hiển thị thống kê nhanh: tổng số ca, số ca đã check-in, hoàn thành, đi muộn và chưa chấm công trong tháng.',
              side: 'top' as const,
              align: 'start' as const,
            },
          },
          {
            popover: {
              title: 'Hoàn thành hướng dẫn! \ud83c\udf89',
              description:
                'Bạn đã nắm được cách xem lịch làm việc cá nhân. Nhấn nút \u2753 \u1edf góc trên bất kỳ lúc nào để xem lại.',
            },
          },
        ],
      },
    ],
    []
  );

  const {
    startTour,
    resetAndRestartAll,
    completedMap,
    tours: tourList,
  } = usePageTours({ tours: SCHEDULE_TOURS });

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Lịch làm việc"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Attendance', href: paths.dashboard.attendance.root },
          { name: 'Lịch làm việc' },
        ]}
          action={
            <Tooltip title="Hướng dẫn sử dụng">
              <IconButton onClick={(e) => setTourMenuAnchor(e.currentTarget)}>
                <Iconify icon="solar:question-circle-bold" width={24} />
              </IconButton>
            </Tooltip>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

      {/* Tour help menu */}
      <Menu
        anchorEl={tourMenuAnchor}
        open={Boolean(tourMenuAnchor)}
        onClose={() => setTourMenuAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        {tourList.map((t) => (
          <MenuItem
            key={t.tourKey}
            onClick={() => {
              setTourMenuAnchor(null);
              startTour(t.tourKey);
            }}
          >
            <ListItemIcon>
              <Iconify
                icon={completedMap[t.tourKey] ? 'solar:check-circle-bold' : 'solar:play-circle-bold'}
                width={20}
                sx={{ color: completedMap[t.tourKey] ? 'success.main' : 'text.secondary' }}
              />
            </ListItemIcon>
            <ListItemText primary={t.label} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            setTourMenuAnchor(null);
            resetAndRestartAll();
          }}
        >
          <ListItemIcon>
            <Iconify icon="solar:restart-bold" width={20} />
          </ListItemIcon>
          <ListItemText primary="Xem lại tất cả" />
        </MenuItem>
      </Menu>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Card>
            <StyledCalendar>
              <Box id="tour-calendar-toolbar">
              <CalendarToolbar
                date={date}
                view={view}
                loading={loading}
                onNextDate={handleDateNext}
                onPrevDate={handleDatePrev}
                onToday={handleDateToday}
                onChangeView={handleChangeView}
                onOpenFilters={() => {}}
              />
              </Box>

              <Box id="tour-calendar-body">
              <Calendar
                weekends
                selectable={false}
                editable={false}
                droppable={false}
                rerenderDelay={10}
                locale="vi"
                firstDay={1}
                allDayMaintainDuration
                ref={calendarRef}
                initialDate={date}
                initialView={view}
                dayMaxEventRows={3}
                eventDisplay="block"
                events={events}
                headerToolbar={false}
                eventClick={handleClickEvent}
                height={smUp ? 720 : 'auto'}
                  plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                  eventContent={(eventInfo) => {
                    const assignment = assignments.find((a) => a.assignmentId === eventInfo.event.id);
                    const color = getEventColor(assignment!);
                    console.log('Assignment for event:', assignment);
                    return (
                      <Box
                        sx={{
                          width: "100%",
                          borderRadius: 1,
                          overflow: "hidden",
                          fontSize: 12
                        }}
                      >
                        {/* Header */}
                        <Box
                          sx={{
                            px: 1,
                            py: 0.5,
                            fontWeight: 600,
                            borderBottom: "1px solid rgba(255,255,255,0.3)",
                            color: color,
                            backgroundColor: `${color}33`, // 20% opacity
                          }}
                        >
                          {eventInfo.event.title}
                        </Box>
                      </Box>
                    );
                  }}
              />
              </Box>
            </StyledCalendar>
          </Card>

          {/* Summary */}
          {assignments.length > 0 && (
            <Card id="tour-month-summary" sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Tổng quan tháng này
              </Typography>
              <Stack direction="row" spacing={4} flexWrap="wrap">
                <Stack alignItems="center">
                  <Typography variant="h4" color="primary.main">
                    {assignments.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tổng ca
                  </Typography>
                </Stack>
                <Stack alignItems="center">
                  <Typography variant="h4" color="success.main">
                    {assignments.filter((a) => a.attendanceLog?.checkInTime).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Đã check-in
                  </Typography>
                </Stack>
                <Stack alignItems="center">
                  <Typography variant="h4" color="info.main">
                    {
                      assignments.filter(
                        (a) => a.attendanceLog?.checkInTime && a.attendanceLog?.checkOutTime
                      ).length
                    }
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Hoàn thành
                  </Typography>
                </Stack>
                <Stack alignItems="center">
                  <Typography variant="h4" color="warning.main">
                    {assignments.filter((a) => a.attendanceLog?.isLate).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Đi muộn
                  </Typography>
                </Stack>
                <Stack alignItems="center">
                  <Typography variant="h4" color="default">
                    {assignments.filter((a) => !a.attendanceLog).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Chưa chấm công
                  </Typography>
                </Stack>
              </Stack>
            </Card>
          )}
        </>
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
        <DialogTitle>Chi tiết ca làm việc</DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <Stack spacing={2} sx={{ pt: 1 }}>
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

              {/* Attendance Information */}
              {selectedEvent.attendanceLog && (
                <>
                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                      Thông tin chấm công
                    </Typography>

                    {selectedEvent.attendanceLog.checkInTime && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Giờ vào
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2">
                            {new Date(selectedEvent.attendanceLog.checkInTime).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </Typography>
                          {selectedEvent.attendanceLog.isLate && (
                            <Label variant="soft" color="warning" sx={{ py: 0 }}>
                              Muộn {selectedEvent.attendanceLog.lateMinutes} phút
                            </Label>
                          )}
                        </Stack>
                      </Box>
                    )}

                    {selectedEvent.attendanceLog.checkOutTime && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Giờ ra
                        </Typography>
                        <Typography variant="body2">
                          {new Date(selectedEvent.attendanceLog.checkOutTime).toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </Typography>
                      </Box>
                    )}

                    {selectedEvent.attendanceLog.workedHours !== undefined && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Tổng giờ làm
                        </Typography>
                        <Typography variant="body2">
                          {selectedEvent.attendanceLog.workedHours.toFixed(2)} giờ
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
                          color={getStatusColor(selectedEvent.attendanceLog.status)}
                        >
                          {selectedEvent.attendanceLog.status}
                        </Label>
                      </Box>
                    </Box>
                  </Box>
                </>
              )}

              {!selectedEvent.attendanceLog && (
                <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 1 }}>
                  <Label variant="soft" color="default">
                    Chưa chấm công
                  </Label>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
