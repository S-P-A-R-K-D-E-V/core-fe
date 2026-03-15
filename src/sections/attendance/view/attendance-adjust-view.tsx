'use client';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EventClickArg, DatesSetArg } from '@fullcalendar/core';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Tooltip from '@mui/material/Tooltip';
import LoadingButton from '@mui/lab/LoadingButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';

import { useResponsive } from 'src/hooks/use-responsive';

import Iconify from 'src/components/iconify';
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

import { IShiftSchedule, IShiftAssignment, IUser } from 'src/types/corecms-api';
import { ICalendarView, ICalendarScheduleEvent } from 'src/types/calendar';
import {
    getShiftAssignments,
    getShiftSchedulesByDateRange,
    adjustAttendanceTime,
} from 'src/api/attendance';
import { getAllUsers } from 'src/api/users';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { parseDateStr, toDateStr, parseDatetimeLocalStr, toDatetimeLocalStr } from 'src/utils/format-time';

import { StyledCalendar } from '../../calendar/styles';
import CalendarToolbar from '../../calendar/calendar-toolbar';
import { useTheme } from '@mui/material';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
    { id: 'staffName', label: 'Nhân viên' },
    { id: 'scheduleName', label: 'Ca', width: 150 },
    { id: 'date', label: 'Ngày', width: 110 },
    { id: 'startTime', label: 'Bắt đầu', width: 80 },
    { id: 'endTime', label: 'Kết thúc', width: 80 },
    { id: 'checkInTime', label: 'Check In', width: 160 },
    { id: 'checkOutTime', label: 'Check Out', width: 160 },
    { id: 'status', label: 'Trạng thái', width: 100 },
    { id: 'actions', label: '', width: 60, align: 'center' as const },
];

// ----------------------------------------------------------------------

function formatTime(dt?: string) {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('vi-VN');
}

function formatTimeShort(time?: string) {
    if (!time) return '-';
    return time.substring(0, 5);
}

function toDatetimeLocalValue(isoString?: string): string {
    if (!isoString) return '';
    const d = new Date(isoString);
    const vnOffset = 7 * 60;
    const localOffset = d.getTimezoneOffset();
    const vnDate = new Date(d.getTime() + (vnOffset + localOffset) * 60000);
    const yyyy = vnDate.getFullYear();
    const mm = String(vnDate.getMonth() + 1).padStart(2, '0');
    const dd = String(vnDate.getDate()).padStart(2, '0');
    const hh = String(vnDate.getHours()).padStart(2, '0');
    const min = String(vnDate.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function datetimeLocalToUtcIso(localValue: string): string {
    const [datePart, timePart] = localValue.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    const vnDate = new Date(Date.UTC(year, month - 1, day, hours - 7, minutes));
    return vnDate.toISOString();
}

function shiftTimeToDatetimeLocal(date: string, shiftTime?: string): string {
    if (!shiftTime) return '';
    const time = shiftTime.substring(0, 5);
    return `${date}T${time}`;
}

// ----------------------------------------------------------------------

export default function AttendanceAdjustView() {
    const { enqueueSnackbar } = useSnackbar();
    const table = useTable();
    const theme = useTheme();
    const settings = useSettingsContext();
    const smUp = useResponsive('up', 'sm');
    const calendarRef = useRef<any>(null);

    const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
    const [users, setUsers] = useState<IUser[]>([]);
    const [schedules, setSchedules] = useState<IShiftSchedule[]>([]);
    const [assignments, setAssignments] = useState<IShiftAssignment[]>([]);
    const [filterStaffId, setFilterStaffId] = useState('');

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
    const [calView, setCalView] = useState<ICalendarView>(smUp ? 'dayGridMonth' : 'listWeek');
    const [calDate, setCalDate] = useState(new Date());

    // Manage dialog — shows all users for a particular schedule+date
    const [manageOpen, setManageOpen] = useState(false);
    const [managingEvent, setManagingEvent] = useState<{
        scheduleId: string;
        date: string;
        title: string;
        color: string;
        startTime: string;
        endTime: string;
        users: { staffId: string; staffName: string; assignmentId: string; attendance?: any }[];
    } | null>(null);

    // Edit single user dialog
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState<{
        id: string;
        staffName: string;
        startTime: string;
        endTime: string;
        date: string;
        scheduleName: string;
        attendanceLog?: any;
    } | null>(null);
    const [checkInValue, setCheckInValue] = useState('');
    const [checkOutValue, setCheckOutValue] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Load users + schedules
    useEffect(() => {
        const loadMeta = async () => {
            try {
                const [s, u] = await Promise.all([
                    getShiftSchedulesByDateRange(fromDate, toDate),
                    getAllUsers(),
                ]);
                setSchedules(s.filter((sc) => sc.isActive));
                setUsers(u);
            } catch (error) {
                console.error(error);
            }
        };
        loadMeta();
    }, [fromDate, toDate]);

    // Load assignments
    const fetchAssignments = useCallback(async () => {
        try {
            const data = await getShiftAssignments(fromDate, toDate, filterStaffId || undefined);
            setAssignments(data);
        } catch (error) {
            console.error(error);
            enqueueSnackbar('Không thể tải phân công', { variant: 'error' });
        }
    }, [fromDate, toDate, filterStaffId, enqueueSnackbar]);

    useEffect(() => {
        fetchAssignments();
    }, [fetchAssignments]);

    // Build calendar events from schedules + assignments
    const events = useMemo(() => {
        if (!schedules.length) return [];

        const map = new Map<string, ICalendarScheduleEvent>();

        schedules.forEach((schedule) => {
            if (!schedule.isActive) return;

            const filterStart = new Date(fromDate);
            const filterEnd = new Date(toDate);
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
                        type: schedule.templateType,
                        users: [],
                    },
                });
                currentDate.setDate(currentDate.getDate() + 1);
            }
        });

        // Attach users from assignments
        assignments.forEach((assignment) => {
            const dateStr = assignment.date.split('T')[0];
            const key = `${assignment.shiftScheduleId}_${dateStr}`;
            const event = map.get(key);
            if (!event) return;
            event.extendedProps.users.push({
                staffId: assignment.staffId,
                staffName: assignment.staffName,
                attendance: assignment.attendanceLog,
            });
        });

        return Array.from(map.values());
    }, [schedules, assignments, fromDate, toDate]);

    // Calendar handlers
    const handleChangeView = useCallback((newView: ICalendarView) => {
        if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            calendarApi.changeView(newView);
            setCalView(newView);
        }
    }, []);

    const handleDateToday = useCallback(() => {
        if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            calendarApi.today();
            setCalDate(calendarApi.getDate());
        }
    }, []);

    const handleDatePrev = useCallback(() => {
        if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            calendarApi.prev();
            setCalDate(calendarApi.getDate());
        }
    }, []);

    const handleDateNext = useCallback(() => {
        if (calendarRef.current) {
            const calendarApi = calendarRef.current.getApi();
            calendarApi.next();
            setCalDate(calendarApi.getDate());
        }
    }, []);

    const handleDatesSet = useCallback((arg: DatesSetArg) => {
        setFromDate(arg.startStr.split('T')[0]);
        setToDate(arg.endStr.split('T')[0]);
        setCalDate(arg.view.currentStart);
    }, []);

    // Click calendar event → open manage dialog with user list
    const handleClickEvent = useCallback(
        (arg: EventClickArg) => {
            const { extendedProps } = arg.event;
            const clickedDate = extendedProps.date as string;
            const clickedScheduleId = extendedProps.scheduleId as string;
            const clickedColor = extendedProps.color as string;
            const clickedUsers = extendedProps.users as {
                staffId: string;
                staffName: string;
                attendance?: any;
            }[];

            const schedule = schedules.find((s) => s.id === clickedScheduleId);

            // Build user list with assignment IDs
            const usersWithAssignments = clickedUsers.map((u) => {
                const assignment = assignments.find(
                    (a) =>
                        a.staffId === u.staffId &&
                        a.shiftScheduleId === clickedScheduleId &&
                        a.date.split('T')[0] === clickedDate
                );
                return {
                    ...u,
                    assignmentId: assignment?.id || '',
                };
            });

            setManagingEvent({
                scheduleId: clickedScheduleId,
                date: clickedDate,
                title: arg.event.title,
                color: clickedColor,
                startTime: schedule?.startTime || '',
                endTime: schedule?.endTime || '',
                users: usersWithAssignments,
            });
            setManageOpen(true);
        },
        [schedules, assignments]
    );

    const handleCloseManage = () => {
        setManageOpen(false);
        setManagingEvent(null);
    };

    // Click user row in manage dialog → open edit dialog
    const handleOpenEditFromManage = (user: {
        staffId: string;
        staffName: string;
        assignmentId: string;
        attendance?: any;
    }) => {
        if (!managingEvent || !user.assignmentId) return;
        setEditingAssignment({
            id: user.assignmentId,
            staffName: user.staffName,
            startTime: managingEvent.startTime,
            endTime: managingEvent.endTime,
            date: managingEvent.date,
            scheduleName: managingEvent.title,
            attendanceLog: user.attendance,
        });
        setCheckInValue(
            user.attendance?.checkInTime ? toDatetimeLocalValue(user.attendance.checkInTime) : ''
        );
        setCheckOutValue(
            user.attendance?.checkOutTime ? toDatetimeLocalValue(user.attendance.checkOutTime) : ''
        );
        setNote('');
        setDialogOpen(true);
    };

    // Open edit from table row
    const handleOpenEditFromTable = (row: IShiftAssignment) => {
        setEditingAssignment({
            id: row.id,
            staffName: row.staffName,
            startTime: row.startTime || row.shiftStartTime || '',
            endTime: row.endTime || row.shiftEndTime || '',
            date: row.date.split('T')[0],
            scheduleName: row.scheduleName || row.shiftName || '',
            attendanceLog: row.attendanceLog,
        });
        setCheckInValue(
            row.attendanceLog?.checkInTime ? toDatetimeLocalValue(row.attendanceLog.checkInTime) : ''
        );
        setCheckOutValue(
            row.attendanceLog?.checkOutTime ? toDatetimeLocalValue(row.attendanceLog.checkOutTime) : ''
        );
        setNote('');
        setDialogOpen(true);
    };

    const handleCloseEdit = () => {
        setDialogOpen(false);
        setEditingAssignment(null);
    };

    const handleSetCheckInToShiftStart = () => {
        if (!editingAssignment) return;
        const val = shiftTimeToDatetimeLocal(editingAssignment.date, editingAssignment.startTime);
        if (val) setCheckInValue(val);
    };

    const handleSetCheckOutToShiftEnd = () => {
        if (!editingAssignment) return;
        const val = shiftTimeToDatetimeLocal(editingAssignment.date, editingAssignment.endTime);
        if (val) setCheckOutValue(val);
    };

    const handleSubmit = async () => {
        if (!editingAssignment) return;
        setSubmitting(true);
        try {
            await adjustAttendanceTime({
                shiftAssignmentId: editingAssignment.id,
                checkInTime: checkInValue ? datetimeLocalToUtcIso(checkInValue) : undefined,
                checkOutTime: checkOutValue ? datetimeLocalToUtcIso(checkOutValue) : undefined,
                note: note || undefined,
            });
            enqueueSnackbar('Điều chỉnh chấm công thành công', { variant: 'success' });
            handleCloseEdit();
            handleCloseManage();
            // Refresh data
            fetchAssignments();
        } catch (error) {
            console.error(error);
            enqueueSnackbar('Điều chỉnh thất bại', { variant: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    // Table pagination
    const dataInPage = assignments.slice(
        table.page * table.rowsPerPage,
        table.page * table.rowsPerPage + table.rowsPerPage
    );

    return (
        <>
            <Container maxWidth={settings.themeStretch ? false : 'xl'}>
                <CustomBreadcrumbs
                    heading="Điều chỉnh chấm công"
                    links={[
                        { name: 'Dashboard', href: paths.dashboard.root },
                        { name: 'Attendance', href: paths.dashboard.attendance.root },
                        { name: 'Điều chỉnh' },
                    ]}
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
                            onChange={(_, v) => {
                                if (v !== null) setViewMode(v);
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
                        <StyledCalendar eventColor={events.length > 0 ? events[0].color : undefined}>
                            <CalendarToolbar
                                date={calDate}
                                view={calView}
                                loading={false}
                                onNextDate={handleDateNext}
                                onPrevDate={handleDatePrev}
                                onToday={handleDateToday}
                                onChangeView={handleChangeView}
                                onOpenFilters={() => { }}
                            />
                            <Calendar
                                locale="vi"
                                firstDay={1}
                                slotMinTime="06:00:00"
                                editable={false}
                                droppable={false}
                                rerenderDelay={10}
                                allDayMaintainDuration
                                ref={calendarRef}
                                initialDate={calDate}
                                initialView={calView}
                                dayMaxEventRows={3}
                                eventDisplay="block"
                                events={events}
                                headerToolbar={false}
                                eventClick={handleClickEvent}
                                datesSet={handleDatesSet}
                                height={smUp ? 820 : 'auto'}
                                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                                eventMaxStack={3}
                                eventContent={(arg) => {
                                    const eventUsers = arg.event.extendedProps.users as any[];
                                    const eventColor = arg.event.extendedProps.color as string;

                                    const getStatusIcon = (attendance: any) => {
                                        if (!attendance?.checkInTime) return <Iconify icon="eva:info-outline" width={16} color={theme.palette.primary.main} />;
                                        if (attendance.isLate) return <Iconify icon="solar:tea-cup-bold" width={16} color={theme.palette.warning.main} />;
                                        return <Iconify icon="eva:checkmark-circle-2-outline" width={16} color={theme.palette.success.main} />;
                                    };

                                    return (
                                        <Box
                                            sx={{
                                                width: '100%',
                                                borderRadius: 1,
                                                overflow: 'hidden',
                                                fontSize: 12,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    px: 1,
                                                    py: 0.5,
                                                    fontWeight: 600,
                                                    borderBottom: '1px solid rgba(255,255,255,0.3)',
                                                    color: eventColor,
                                                }}
                                            >
                                                {arg.event.title}
                                            </Box>
                                            <Box
                                                sx={{
                                                    px: 1,
                                                    py: 0.5,
                                                    gap: 0.5,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                }}
                                            >
                                                {eventUsers.map((u) => (
                                                    <Box
                                                        key={u.staffId}
                                                        sx={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            lineHeight: 1.6,
                                                            color: eventColor,
                                                            backgroundColor: `${eventColor}45`,
                                                            borderRadius: 2,
                                                            px: 0.5,
                                                        }}
                                                    >
                                                        <span>👤{u.staffName}</span>
                                                        <span>{getStatusIcon(u.attendance)}</span>
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Box>
                                    );
                                }}
                            />
                        </StyledCalendar>
                    </Card>
                ) : (
                    /* ========== Table View ========== */
                    <Card>
                        <Scrollbar>
                            <TableContainer sx={{ overflow: 'unset' }}>
                                <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
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
                                                <TableCell>{row.scheduleName || row.shiftName || '-'}</TableCell>
                                                <TableCell>
                                                    {new Date(row.date).toLocaleDateString('vi-VN')}
                                                </TableCell>
                                                <TableCell>
                                                    {formatTimeShort(row.startTime || row.shiftStartTime)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatTimeShort(row.endTime || row.shiftEndTime)}
                                                </TableCell>
                                                <TableCell>{formatTime(row.attendanceLog?.checkInTime)}</TableCell>
                                                <TableCell>{formatTime(row.attendanceLog?.checkOutTime)}</TableCell>
                                                <TableCell>
                                                    {row.attendanceLog ? (
                                                        <Label
                                                            variant="soft"
                                                            color={
                                                                (row.attendanceLog.status === 'OnTime' && 'success') ||
                                                                (row.attendanceLog.status === 'Late' && 'warning') ||
                                                                (row.attendanceLog.status === 'Absent' && 'error') ||
                                                                'default'
                                                            }
                                                        >
                                                            {row.attendanceLog.status}
                                                        </Label>
                                                    ) : (
                                                        <Label variant="soft" color="default">
                                                            Chưa có
                                                        </Label>
                                                    )}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Tooltip title="Điều chỉnh">
                                                        <IconButton onClick={() => handleOpenEditFromTable(row)}>
                                                            <Iconify icon="solar:pen-bold" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableEmptyRows
                                            height={table.dense ? 56 : 76}
                                            emptyRows={emptyRows(table.page, table.rowsPerPage, assignments.length)}
                                        />
                                        <TableNoData notFound={!assignments.length} />
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Scrollbar>

                        <TablePaginationCustom
                            count={assignments.length}
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

            {/* ========== Manage Dialog — User list for a schedule+date ========== */}
            <Dialog open={manageOpen} onClose={handleCloseManage} maxWidth="sm" fullWidth>
                {managingEvent && (
                    <>
                        <DialogTitle sx={{ pb: 1 }}>
                            <Stack spacing={0.5}>
                                <Typography variant="h6" sx={{ color: managingEvent.color }}>
                                    {managingEvent.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {new Date(managingEvent.date).toLocaleDateString('vi-VN')} —{' '}
                                    {formatTimeShort(managingEvent.startTime)} →{' '}
                                    {formatTimeShort(managingEvent.endTime)}
                                </Typography>
                            </Stack>
                        </DialogTitle>
                        <DialogContent dividers>
                            {managingEvent.users.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                                    Không có nhân viên được phân công ca này
                                </Typography>
                            ) : (
                                <Stack spacing={1.5}>
                                    {managingEvent.users.map((u) => {
                                        const att = u.attendance;
                                        const hasLog = !!att?.checkInTime;
                                        return (
                                            <Box
                                                key={u.staffId}
                                                onClick={() => handleOpenEditFromManage(u)}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    p: 1.5,
                                                    borderRadius: 1.5,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                    '&:hover': {
                                                        borderColor: managingEvent.color,
                                                        bgcolor: `${managingEvent.color}08`,
                                                    },
                                                }}
                                            >
                                                <Stack spacing={0.5}>
                                                    <Typography variant="subtitle2">{u.staffName}</Typography>
                                                    <Stack direction="row" spacing={1}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            In: {att?.checkInTime ? formatTime(att.checkInTime) : '—'}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Out: {att?.checkOutTime ? formatTime(att.checkOutTime) : '—'}
                                                        </Typography>
                                                    </Stack>
                                                </Stack>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    {hasLog ? (
                                                        <Label
                                                            variant="soft"
                                                            color={
                                                                (att.status === 'OnTime' && 'success') ||
                                                                (att.isLate && 'warning') ||
                                                                'default'
                                                            }
                                                        >
                                                            {att.isLate ? `Trễ ${att.lateMinutes}p` : att.status}
                                                        </Label>
                                                    ) : (
                                                        <Label variant="soft" color="error">
                                                            Chưa chấm
                                                        </Label>
                                                    )}
                                                    <Iconify icon="solar:pen-bold" width={18} color="text.secondary" />
                                                </Stack>
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button variant="outlined" color="inherit" onClick={handleCloseManage}>
                                Đóng
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            {/* ========== Edit Dialog — Adjust check-in/out for one user ========== */}
            <Dialog open={dialogOpen} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
                <DialogTitle>Điều chỉnh chấm công</DialogTitle>
                <DialogContent>
                    {editingAssignment && (
                        <Stack spacing={2.5} sx={{ mt: 1 }}>
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2">
                                    {editingAssignment.staffName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {editingAssignment.scheduleName} —{' '}
                                    {formatTimeShort(editingAssignment.startTime)}
                                    {' → '}
                                    {formatTimeShort(editingAssignment.endTime)}
                                    {' | '}
                                    {new Date(editingAssignment.date).toLocaleDateString('vi-VN')}
                                </Typography>
                            </Stack>

                            <Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <DateTimePicker
                                        label="Giờ vào"
                                        value={parseDatetimeLocalStr(checkInValue)}
                                        onChange={(val) => setCheckInValue(toDatetimeLocalStr(val))}
                                        format="dd/MM/yyyy HH:mm"
                                        slotProps={{ textField: { fullWidth: true } }}
                                    />
                                    <Tooltip title="Đặt giờ bắt đầu ca">
                                        <IconButton color="primary" onClick={handleSetCheckInToShiftStart}>
                                            <Iconify icon="solar:check-circle-bold" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Box>

                            <Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <DateTimePicker
                                        label="Giờ ra"
                                        value={parseDatetimeLocalStr(checkOutValue)}
                                        onChange={(val) => setCheckOutValue(toDatetimeLocalStr(val))}
                                        format="dd/MM/yyyy HH:mm"
                                        slotProps={{ textField: { fullWidth: true } }}
                                    />
                                    <Tooltip title="Đặt giờ kết thúc ca">
                                        <IconButton color="primary" onClick={handleSetCheckOutToShiftEnd}>
                                            <Iconify icon="solar:check-circle-bold" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Box>

                            <TextField
                                label="Ghi chú"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                multiline
                                rows={2}
                                fullWidth
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button variant="outlined" color="inherit" onClick={handleCloseEdit}>
                        Hủy
                    </Button>
                    <LoadingButton
                        variant="contained"
                        loading={submitting}
                        onClick={handleSubmit}
                        disabled={!checkInValue && !checkOutValue}
                    >
                        Lưu
                    </LoadingButton>
                </DialogActions>
            </Dialog>
        </>
    );
}
