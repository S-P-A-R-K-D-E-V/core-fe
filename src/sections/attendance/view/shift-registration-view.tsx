'use client';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EventClickArg } from '@fullcalendar/core';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Container from '@mui/material/Container';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Avatar from '@mui/material/Avatar';
import LoadingButton from '@mui/lab/LoadingButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import { useTheme, alpha } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import { useBoolean } from 'src/hooks/use-boolean';
import { useResponsive } from 'src/hooks/use-responsive';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IShiftSchedule, IShiftRegistration } from 'src/types/corecms-api';
import { ICalendarView, ICalendarScheduleEvent } from 'src/types/calendar';
import { getShiftSchedulesByDateRange } from 'src/api/attendance';
import {
  registerShift,
  unregisterShift,
  getMyShiftRegistrations,
  getShiftRegistrations,
} from 'src/api/shiftRegistration';
import { useAuthContext } from 'src/auth/hooks';

import { StyledCalendar } from '../../calendar/styles';
import CalendarToolbar from '../../calendar/calendar-toolbar';

// ----------------------------------------------------------------------

export default function ShiftRegistrationView() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const settings = useSettingsContext();
  const smUp = useResponsive('up', 'sm');
  const detailDialog = useBoolean();
  const calendarRef = useRef<any>(null);
  const { user: authUser } = useAuthContext();

  const [schedules, setSchedules] = useState<IShiftSchedule[]>([]);
  const [registrations, setRegistrations] = useState<IShiftRegistration[]>([]);

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

  // Calendar state
  const [view, setView] = useState<ICalendarView>(smUp ? 'dayGridMonth' : 'listWeek');
  const [date, setDate] = useState(new Date());

  // Detail dialog state
  const [selectedShift, setSelectedShift] = useState<{
    scheduleId: string;
    date: string;
    title: string;
    color: string;
    startTime: string;
    endTime: string;
    registeredStaff: { staffId: string; staffName: string; createdAt: string }[];
    isRegistered: boolean;
  } | null>(null);

  const [registering, setRegistering] = useState(false);
  const [registerNote, setRegisterNote] = useState('');

  const currentUserId = authUser?.id;
  const isAdmin =
    authUser?.role === 'Admin' ||
    authUser?.role === 'Manager' ||
    authUser?.roles?.includes('Admin') ||
    authUser?.roles?.includes('Manager');

  // Fetch registrations
  const fetchRegistrations = useCallback(async () => {
    try {
      let data: IShiftRegistration[];
      if (isAdmin) {
        data = await getShiftRegistrations(fromDate, toDate);
      } else {
        data = await getMyShiftRegistrations(fromDate, toDate);
      }
      setRegistrations(data);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải dữ liệu đăng ký ca', { variant: 'error' });
    }
  }, [fromDate, toDate, isAdmin, enqueueSnackbar]);

  // Fetch schedules + registrations
  useEffect(() => {
    const load = async () => {
      try {
        const [s] = await Promise.all([
          getShiftSchedulesByDateRange(fromDate, toDate),
        ]);
        setSchedules(s.filter((sc) => sc.isActive));
      } catch (error) {
        console.error(error);
      }
    };
    load();
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Transform schedules to calendar events with registration info
  const events = useMemo(() => {
    if (!schedules.length) return [];

    const map = new Map<
      string,
      ICalendarScheduleEvent & {
        extendedProps: {
          scheduleId: string;
          date: string;
          color: string;
          startTime: string;
          endTime: string;
          users: { staffId: string; staffName: string; attendance?: any }[];
          registeredStaff: { staffId: string; staffName: string; createdAt: string }[];
          isRegistered: boolean;
        };
      }
    >();

    const filterStart = new Date(fromDate);
    const filterEnd = new Date(toDate);

    schedules.forEach((schedule) => {
      if (!schedule.isActive) return;

      const scheduleStart = new Date(schedule.fromDate);
      const scheduleEnd = schedule.toDate ? new Date(schedule.toDate) : filterEnd;

      const startDate = new Date(Math.max(filterStart.getTime(), scheduleStart.getTime()));
      const endDate = new Date(Math.min(filterEnd.getTime(), scheduleEnd.getTime()));

      if (startDate > endDate) return;

      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const key = `${schedule.id}_${dateStr}`;

        const start = new Date(`${dateStr}T${schedule.startTime}:00`).getTime();
        const end = new Date(`${dateStr}T${schedule.endTime}:00`).getTime();

        map.set(key, {
          id: key,
          title: schedule.templateName,
          start,
          end,
          allDay: false,
          color: `${schedule.color}10`,
          extendedProps: {
            scheduleId: schedule.id,
            date: dateStr,
            color: schedule.color,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            users: [],
            registeredStaff: [],
            isRegistered: false,
          },
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Overlay registrations
    registrations.forEach((reg) => {
      const dateStr = reg.date.split('T')[0];
      const key = `${reg.shiftScheduleId}_${dateStr}`;
      const event = map.get(key);
      if (!event) return;

      event.extendedProps.registeredStaff.push({
        staffId: reg.staffId,
        staffName: reg.staffName,
        createdAt: reg.createdAt,
      });

      if (reg.staffId === currentUserId) {
        event.extendedProps.isRegistered = true;
      }
    });

    return Array.from(map.values());
  }, [schedules, registrations, fromDate, toDate, currentUserId]);

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
      const ep = arg.event.extendedProps;
      setSelectedShift({
        scheduleId: ep.scheduleId as string,
        date: ep.date as string,
        title: arg.event.title,
        color: ep.color as string,
        startTime: ep.startTime as string,
        endTime: ep.endTime as string,
        registeredStaff: ep.registeredStaff as any[],
        isRegistered: ep.isRegistered as boolean,
      });
      setRegisterNote('');
      detailDialog.onTrue();
    },
    [detailDialog]
  );

  const handleRegister = async () => {
    if (!selectedShift) return;
    setRegistering(true);
    try {
      await registerShift({
        shiftScheduleId: selectedShift.scheduleId,
        date: selectedShift.date,
        note: registerNote || undefined,
      });
      enqueueSnackbar('Đăng ký ca thành công!', { variant: 'success' });
      await fetchRegistrations();
      detailDialog.onFalse();
    } catch (error: any) {
      const msg = error?.title || error?.message || 'Đăng ký ca thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregister = async () => {
    if (!selectedShift) return;
    setRegistering(true);
    try {
      await unregisterShift({
        shiftScheduleId: selectedShift.scheduleId,
        date: selectedShift.date,
      });
      enqueueSnackbar('Đã hủy đăng ký ca!', { variant: 'success' });
      await fetchRegistrations();
      detailDialog.onFalse();
    } catch (error: any) {
      const msg = error?.title || error?.message || 'Hủy đăng ký thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <>
      <Container maxWidth={settings.themeStretch ? false : 'xl'}>
        <CustomBreadcrumbs
          heading="Đăng ký ca làm việc"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Attendance', href: paths.dashboard.attendance.root },
            { name: 'Đăng ký ca' },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {/* Filters */}
        <Card sx={{ mb: 3, p: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <TextField
              label="Từ ngày"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: 1, md: 180 } }}
            />
            <TextField
              label="Đến ngày"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: { xs: 1, md: 180 } }}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Chip
              icon={<Iconify icon="solar:info-circle-bold" />}
              label="Nhấn vào ca trên lịch để đăng ký / hủy đăng ký"
              variant="outlined"
              color="info"
            />
          </Stack>
        </Card>

        {/* Calendar View */}
        <Card>
          <StyledCalendar eventColor={events.length > 0 ? events[0].color : undefined}>
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
              selectable={false}
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
              height={smUp ? 720 : 'auto'}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              eventContent={(arg) => {
                const regStaff = arg.event.extendedProps.registeredStaff as any[];
                const isReg = arg.event.extendedProps.isRegistered as boolean;
                const color = arg.event.extendedProps.color as string;

                return (
                  <Box
                    sx={{
                      width: '100%',
                      borderRadius: 1,
                      overflow: 'hidden',
                      fontSize: 12,
                      backgroundColor: isReg ? alpha(color, 0.25) : alpha(color, 0.08),
                      border: isReg ? `2px solid ${color}` : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Header */}
                    <Box
                      sx={{
                        px: 1,
                        py: 0.5,
                        fontWeight: 600,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color,
                      }}
                    >
                      <span>{arg.event.title}</span>
                      {isReg && (
                        <Chip
                          label="Đã ĐK"
                          size="small"
                          color="success"
                          sx={{ height: 18, fontSize: 10, ml: 0.5 }}
                        />
                      )}
                    </Box>

                    {/* Registered staff */}
                    {regStaff.length > 0 && (
                      <Box sx={{ px: 1, py: 0.25 }}>
                        {regStaff.slice(0, 3).map((s) => (
                          <Box
                            key={s.staffId}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              lineHeight: 1.5,
                              color,
                              opacity: 0.8,
                            }}
                          >
                            <span>📝</span>
                            <span>{s.staffName}</span>
                          </Box>
                        ))}
                        {regStaff.length > 3 && (
                          <Typography variant="caption" sx={{ color, opacity: 0.6 }}>
                            +{regStaff.length - 3} người khác
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              }}
            />
          </StyledCalendar>
        </Card>
      </Container>

      {/* Shift Registration Detail Dialog */}
      <Dialog
        open={detailDialog.value}
        onClose={detailDialog.onFalse}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        {selectedShift && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: selectedShift.color,
                  }}
                />
                <Typography variant="h6">{selectedShift.title}</Typography>
              </Stack>
            </DialogTitle>

            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {/* Shift info */}
                <Stack direction="row" spacing={3}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Iconify icon="solar:calendar-bold" width={18} sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2">{selectedShift.date}</Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Iconify icon="solar:clock-circle-bold" width={18} sx={{ color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {selectedShift.startTime} - {selectedShift.endTime}
                    </Typography>
                  </Stack>
                </Stack>

                {/* Registration status */}
                {selectedShift.isRegistered ? (
                  <Chip
                    icon={<Iconify icon="solar:check-circle-bold" />}
                    label="Bạn đã đăng ký ca này"
                    color="success"
                    variant="filled"
                  />
                ) : (
                  <Chip
                    icon={<Iconify icon="solar:info-circle-bold" />}
                    label="Bạn chưa đăng ký ca này"
                    color="warning"
                    variant="outlined"
                  />
                )}

                {/* Registered staff list */}
                {selectedShift.registeredStaff.length > 0 && (
                  <>
                    <Divider />
                    <Typography variant="subtitle2">
                      Đã đăng ký ({selectedShift.registeredStaff.length} người)
                    </Typography>
                    <Stack spacing={1}>
                      {selectedShift.registeredStaff.map((s) => (
                        <Stack
                          key={s.staffId}
                          direction="row"
                          alignItems="center"
                          spacing={1.5}
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            bgcolor: 'background.neutral',
                          }}
                        >
                          <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                            {s.staffName?.[0] || '?'}
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {s.staffName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Đăng ký lúc:{' '}
                              {new Date(s.createdAt).toLocaleString('vi-VN')}
                            </Typography>
                          </Box>
                          {s.staffId === currentUserId && (
                            <Chip label="Bạn" size="small" color="primary" />
                          )}
                        </Stack>
                      ))}
                    </Stack>
                  </>
                )}

                {/* Note input for new registration */}
                {!selectedShift.isRegistered && (
                  <TextField
                    fullWidth
                    label="Ghi chú (tùy chọn)"
                    value={registerNote}
                    onChange={(e) => setRegisterNote(e.target.value)}
                    multiline
                    rows={2}
                    placeholder="Nhập ghi chú nếu cần..."
                  />
                )}
              </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button variant="outlined" onClick={detailDialog.onFalse}>
                Đóng
              </Button>

              {selectedShift.isRegistered ? (
                <LoadingButton
                  variant="contained"
                  color="error"
                  loading={registering}
                  onClick={handleUnregister}
                  startIcon={<Iconify icon="solar:close-circle-bold" />}
                >
                  Hủy đăng ký
                </LoadingButton>
              ) : (
                <LoadingButton
                  variant="contained"
                  color="primary"
                  loading={registering}
                  onClick={handleRegister}
                  startIcon={<Iconify icon="solar:check-circle-bold" />}
                >
                  Đăng ký ca
                </LoadingButton>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
