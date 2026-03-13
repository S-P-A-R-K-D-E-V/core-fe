'use client';

import Calendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { EventClickArg, DateSelectArg, DatesSetArg } from '@fullcalendar/core';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

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
import Avatar from '@mui/material/Avatar';
import InputAdornment from '@mui/material/InputAdornment';
import LoadingButton from '@mui/lab/LoadingButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
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

import { IShiftSchedule, IShiftAssignment, IUser } from 'src/types/corecms-api';
import { ICalendarEvent, ICalendarView, ICalendarScheduleEvent } from 'src/types/calendar';
import {
  getShiftAssignments,
  createShiftAssignment,
  deleteShiftAssignment,
  bulkAssignShiftSchedule,
  manageShiftAssignments,
  swapShiftAssignments,
  getShiftSchedulesByDateRange,
} from 'src/api/attendance';
import { getShiftRegistrations } from 'src/api/shiftRegistration';
import { getAllUsers } from 'src/api/users';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

import { StyledCalendar } from '../../calendar/styles';
import CalendarToolbar from '../../calendar/calendar-toolbar';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'staffName', label: 'Staff' },
  { id: 'scheduleName', label: 'Schedule (Template)', width: 180 },
  { id: 'date', label: 'Date', width: 130 },
  { id: 'time', label: 'Time', width: 120 },
  { id: 'version', label: 'Ver', width: 60 },
  { id: 'note', label: 'Note', width: 200 },
  { id: '', width: 60 },
];

const WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

// ----------------------------------------------------------------------

const toLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function AttendanceAssignmentsView() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const settings = useSettingsContext();
  const smUp = useResponsive('up', 'sm');
  const createDialog = useBoolean();
  const bulkDialog = useBoolean();
  const confirm = useBoolean();
  const detailDialog = useBoolean();
  const manageDialog = useBoolean();
  const calendarRef = useRef<any>(null);

  const [assignMode, setAssignMode] = useState<'single' | 'bulk'>('single');
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [tableData, setTableData] = useState<IShiftAssignment[]>([]);
  const [schedules, setSchedules] = useState<IShiftSchedule[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toLocalDateStr(d);
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return toLocalDateStr(d);
  });
  const [filterStaffId, setFilterStaffId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<IShiftAssignment | null>(null);

  // Manage shift dialog state
  const [managingEvent, setManagingEvent] = useState<{
    scheduleId: string;
    date: string;
    title: string;
    color: string;
    startTime: string;
    endTime: string;
    users: { staffId: string; staffName: string; attendance?: any }[];
  } | null>(null);
  const [manageSearchQuery, setManageSearchQuery] = useState('');
  const [dndRegistered, setDndRegistered] = useState<string[]>([]);
  const [dndAvailable, setDndAvailable] = useState<string[]>([]);
  const [dndAssigned, setDndAssigned] = useState<string[]>([]);
  const [initialAssignedIds, setInitialAssignedIds] = useState<string[]>([]);
  const [originalRegisteredIds, setOriginalRegisteredIds] = useState<string[]>([]);
  const [manageSaving, setManageSaving] = useState(false);

  // Swap dialog state
  const swapDialog = useBoolean();
  const [swapSource, setSwapSource] = useState<{
    staffId: string;
    staffName: string;
    scheduleId: string;
    date: string;
    scheduleName: string;
  } | null>(null);
  const [swapTargetScheduleId, setSwapTargetScheduleId] = useState('');
  const [swapTargetDate, setSwapTargetDate] = useState('');
  const [swapTargetStaffId, setSwapTargetStaffId] = useState('');
  const [swapTargetCandidates, setSwapTargetCandidates] = useState<
    { staffId: string; staffName: string }[]
  >([]);
  const [swapSaving, setSwapSaving] = useState(false);
  const [swapLoadingCandidates, setSwapLoadingCandidates] = useState(false);

  // Staff info lookup map
  const staffInfoMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string; avatarUrl?: string }>();
    users.forEach((u) => {
      map.set(u.id, {
        id: u.id,
        name: u.fullName,
        role: u.roles?.[0] || 'Nhân viên',
        avatarUrl: u.profileImageUrl,
      });
    });
    return map;
  }, [users]);

  // Calendar state
  const [view, setView] = useState<ICalendarView>(smUp ? 'dayGridMonth' : 'listWeek');
  const [date, setDate] = useState(new Date());

  // Single assign form state
  const [newStaffId, setNewStaffId] = useState('');
  const [newScheduleId, setNewScheduleId] = useState('');
  const [newDate, setNewDate] = useState(() => toLocalDateStr(new Date()));
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);

  // Bulk assign form state
  const [bulkStaffIds, setBulkStaffIds] = useState<string[]>([]);
  const [bulkWeekStart, setBulkWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [bulkSelectedSlots, setBulkSelectedSlots] = useState<{ scheduleId: string; date: string }[]>([]);
  const [bulkAssigning, setBulkAssigning] = useState(false);

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
        const [s, u] = await Promise.all([
          getShiftSchedulesByDateRange(fromDate, toDate),
          getAllUsers(),
        ]);
        // Schedules now have color from API
        setSchedules(s.filter((sc) => sc.isActive));
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
  }, [fromDate, toDate]);

  // Transform assignments to calendar events
  const events = useMemo(() => {
    if (!schedules.length) return [];

    const map = new Map<string, ICalendarScheduleEvent>();

    schedules.forEach((schedule) => {
      if (!schedule.isActive) return;

      const filterStart = new Date(fromDate);
      const filterEnd = new Date(toDate);

      const scheduleStart = new Date(schedule.fromDate);
      const scheduleEnd = schedule.toDate
        ? new Date(schedule.toDate)
        : filterEnd;

      // Lấy khoảng giao nhau giữa filter và schedule
      const startDate = new Date(
        Math.max(filterStart.getTime(), scheduleStart.getTime())
      );

      const endDate = new Date(
        Math.min(filterEnd.getTime(), scheduleEnd.getTime())
      );

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

    // Gắn user từ assignments vào event
    tableData.forEach((assignment) => {
      const dateStr = assignment.date.split('T')[0];
      const key = `${assignment.shiftScheduleId}_${dateStr}`;

      const event = map.get(key);
      if (!event) return;

      event.extendedProps.users.push({
        staffId: assignment.staffId,
        staffName: assignment.staffName,
        attendance: assignment.attendanceLog, // nếu API trả về
      });
    });

    return Array.from(map.values());
  }, [schedules, tableData, fromDate, toDate]);

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
        shiftScheduleId: newScheduleId,
        date: newDate,
        note: newNote || undefined,
      });
      enqueueSnackbar('Assignment created!');
      createDialog.onFalse();
      setNewStaffId('');
      setNewScheduleId('');
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

  const handleBulkAssign = async () => {
    try {
      setBulkAssigning(true);
      // Group selected slots by scheduleId
      const groups = new Map<string, string[]>();
      bulkSelectedSlots.forEach((slot) => {
        if (!groups.has(slot.scheduleId)) groups.set(slot.scheduleId, []);
        groups.get(slot.scheduleId)!.push(slot.date);
      });
      let totalCount = 0;
      const groupEntries = Array.from(groups.entries());
      // JS getDay() → WeekDays bitmask: Sun=64,Mon=1,Tue=2,Wed=4,Thu=8,Fri=16,Sat=32
      const JS_DAY_TO_WEEKDAYS = [64, 1, 2, 4, 8, 16, 32];
      for (let gi = 0; gi < groupEntries.length; gi += 1) {
        const [scheduleId, dates] = groupEntries[gi];
        const sortedDates = [...dates].sort();
        const dayMask = dates.reduce(
          (acc: number, d: string) => {
            const [y, mo, dy] = d.split('-').map(Number);
            return acc | JS_DAY_TO_WEEKDAYS[new Date(y, mo - 1, dy).getDay()];
          },
          0
        );
        const result = await bulkAssignShiftSchedule({
          staffIds: bulkStaffIds,
          shiftScheduleId: scheduleId,
          fromDate: sortedDates[0],
          toDate: sortedDates[sortedDates.length - 1],
          filterDays: dayMask || undefined,
        });
        totalCount += result.count;
      }
      enqueueSnackbar(`Bulk assigned ${totalCount} shifts!`, { variant: 'success' });
      bulkDialog.onFalse();
      setBulkStaffIds([]);
      setBulkSelectedSlots([]);
      fetchAssignments();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Bulk assign failed!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBulkAssigning(false);
    }
  };

  const toggleBulkStaff = (staffId: string) => {
    setBulkStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const toggleBulkSlot = (scheduleId: string, date: string) => {
    setBulkSelectedSlots((prev) => {
      const exists = prev.some((s) => s.scheduleId === scheduleId && s.date === date);
      if (exists) return prev.filter((s) => !(s.scheduleId === scheduleId && s.date === date));
      return [...prev, { scheduleId, date }];
    });
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
      const { extendedProps } = arg.event;

      const clickedDate = extendedProps.date as string;
      const clickedScheduleId = extendedProps.scheduleId as string;
      const clickedColor = extendedProps.color as string;
      const clickedUsers = extendedProps.users as { staffId: string; staffName: string; attendance?: any }[];

      const schedule = schedules.find((s) => s.id === clickedScheduleId);

      setManagingEvent({
        scheduleId: clickedScheduleId,
        date: clickedDate,
        title: arg.event.title,
        color: clickedColor,
        startTime: schedule?.startTime || '',
        endTime: schedule?.endTime || '',
        users: clickedUsers || [],
      });
      setManageSearchQuery('');
      // Initialize DnD zones
      const assignedStaffIds = (clickedUsers || []).map((u: any) => u.staffId);
      setInitialAssignedIds([...assignedStaffIds]);
      setDndAssigned([...assignedStaffIds]);
      setDndRegistered([]);
      setOriginalRegisteredIds([]);
      setDndAvailable(
        users.filter((u) => !assignedStaffIds.includes(u.id)).map((u) => u.id)
      );
      manageDialog.onTrue();

      // Fetch shift registrations for this schedule + date
      getShiftRegistrations(clickedDate, clickedDate)
        .then((registrations) => {
          const allRegisteredIds = registrations
            .filter((r) => r.shiftScheduleId === clickedScheduleId)
            .map((r) => r.staffId);
          // Remember all who registered (including those already assigned)
          setOriginalRegisteredIds(allRegisteredIds);
          // Only show in registered zone those not already assigned
          const notAssignedRegisteredIds = allRegisteredIds.filter((id) => !assignedStaffIds.includes(id));
          if (notAssignedRegisteredIds.length > 0) {
            setDndRegistered(notAssignedRegisteredIds);
            setDndAvailable((prev) => prev.filter((id) => !notAssignedRegisteredIds.includes(id)));
          }
        })
        .catch((err) => {
          console.error('Failed to load shift registrations', err);
        });
    },
    [manageDialog, schedules, users]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      )
        return;

      const getListSetter = (id: string) => {
        if (id === 'registered') return setDndRegistered;
        if (id === 'available') return setDndAvailable;
        return setDndAssigned;
      };

      if (source.droppableId === destination.droppableId) {
        const setter = getListSetter(source.droppableId);
        setter((prev) => {
          const list = [...prev];
          list.splice(source.index, 1);
          list.splice(destination.index, 0, draggableId);
          return list;
        });
      } else {
        const sourceSetter = getListSetter(source.droppableId);
        const destSetter = getListSetter(destination.droppableId);
        sourceSetter((prev) => {
          const list = [...prev];
          list.splice(source.index, 1);
          return list;
        });
        destSetter((prev) => {
          const list = [...prev];
          list.splice(destination.index, 0, draggableId);
          return list;
        });
      }
    },
    []
  );

  const handleRemoveFromAssigned = useCallback((staffId: string) => {
    setDndAssigned((prev) => prev.filter((id) => id !== staffId));
    setDndAvailable((prev) => [...prev, staffId]);
  }, []);

  const handleSaveAssignments = async () => {
    if (!managingEvent) return;
    setManageSaving(true);
    try {
      const result = await manageShiftAssignments({
        shiftScheduleId: managingEvent.scheduleId,
        date: managingEvent.date,
        staffIds: dndAssigned,
      });

      if (result.added || result.removed) {
        enqueueSnackbar(`Đã lưu phân công! (+${result.added} / -${result.removed})`, {
          variant: 'success',
        });
        await fetchAssignments();
      }
      manageDialog.onFalse();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Lưu phân công thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setManageSaving(false);
    }
  };

  // Swap handlers
  const handleOpenSwap = useCallback(
    (staffId: string) => {
      if (!managingEvent) return;
      const info = staffInfoMap.get(staffId);
      setSwapSource({
        staffId,
        staffName: info?.name || '',
        scheduleId: managingEvent.scheduleId,
        date: managingEvent.date,
        scheduleName: managingEvent.title,
      });
      setSwapTargetScheduleId('');
      setSwapTargetDate(managingEvent.date);
      setSwapTargetStaffId('');
      setSwapTargetCandidates([]);
      swapDialog.onTrue();
    },
    [managingEvent, staffInfoMap, swapDialog]
  );

  // Load candidates when target schedule + date is selected
  useEffect(() => {
    if (!swapTargetScheduleId || !swapTargetDate || !swapDialog.value) {
      setSwapTargetCandidates([]);
      return;
    }
    setSwapLoadingCandidates(true);
    setSwapTargetStaffId('');
    // Find users assigned to target schedule on target date from existing events
    const key = `${swapTargetScheduleId}_${swapTargetDate}`;
    const targetEvent = events.find((e) => e.id === key);
    if (targetEvent) {
      const candidates = (targetEvent.extendedProps.users as any[])
        .filter((u) => u.staffId !== swapSource?.staffId)
        .map((u) => ({ staffId: u.staffId, staffName: u.staffName }));
      setSwapTargetCandidates(candidates);
    } else {
      setSwapTargetCandidates([]);
    }
    setSwapLoadingCandidates(false);
  }, [swapTargetScheduleId, swapTargetDate, swapDialog.value, events, swapSource?.staffId]);

  const handleSwap = async () => {
    if (!swapSource || !swapTargetScheduleId || !swapTargetDate || !swapTargetStaffId) return;
    setSwapSaving(true);
    try {
      await swapShiftAssignments({
        staffId1: swapSource.staffId,
        shiftScheduleId1: swapSource.scheduleId,
        date1: swapSource.date,
        staffId2: swapTargetStaffId,
        shiftScheduleId2: swapTargetScheduleId,
        date2: swapTargetDate,
      });
      const targetName = swapTargetCandidates.find((c) => c.staffId === swapTargetStaffId)?.staffName || '';
      enqueueSnackbar(`Đã đổi ca: ${swapSource.staffName} ↔ ${targetName}`, {
        variant: 'success',
      });
      swapDialog.onFalse();
      manageDialog.onFalse();
      await fetchAssignments();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Đổi ca thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSwapSaving(false);
    }
  };

  const handleSelectRange = useCallback(
    (arg: DateSelectArg) => {
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.unselect();
      }
      const dateStr = new Date(arg.start).toISOString().split('T')[0];
      setNewDate(dateStr);
      setAssignMode('single');
      createDialog.onTrue();
    },
    [createDialog]
  );

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setFromDate(arg.startStr.split('T')[0]);
    setToDate(arg.endStr.split('T')[0]);
    setDate(arg.view.currentStart);
  }, []);

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
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<Iconify icon="solar:calendar-add-bold-duotone" />}
                onClick={() => {
                  setAssignMode('bulk');
                  bulkDialog.onTrue();
                }}
              >
                Phân công hàng loạt
              </Button>
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => {
                  setAssignMode('single');
                  createDialog.onTrue();
                }}
              >
                Phân công ca
              </Button>
            </Stack>
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
            <StyledCalendar eventColor={events.length > 0 ? events[0].color : undefined}>
              <CalendarToolbar
                date={date}
                view={view}
                loading={false}
                onNextDate={handleDateNext}
                onPrevDate={handleDatePrev}
                onToday={handleDateToday}
                onChangeView={handleChangeView}
                onOpenFilters={() => { }}
              />
              <Calendar
                selectable
                firstDay={1}
                slotMinTime="08:00:00"
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
                datesSet={handleDatesSet}
                height={smUp ? 820 : 'auto'}
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                eventMaxStack={3}
                eventClassNames={(arg) =>
                  arg.event.extendedProps.type === 'Extra' ? 'sub-shift' : ''
                }
                eventContent={(arg) => {
                  const users = arg.event.extendedProps.users as any[];

                  const getStatusIcon = (attendance: any) => {
                    if (!attendance?.checkInTime) return null;

                    if (attendance.isLate) return "⏰";
                    return "✅";
                  };
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
                          color: arg.event.extendedProps.color,
                        }}
                      >
                        {arg.event.title}
                      </Box>

                      {/* Users */}
                      <Box sx={{ px: 1, py: 0.5 , gap: 0.5, display: "flex", flexDirection: "column"}}>
                        {users.map((u) => (
                          <Box
                            key={u.staffId}
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              lineHeight: 1.6,
                              color: arg.event.extendedProps.color,
                              backgroundColor: `${arg.event.extendedProps.color}45`,
                              borderRadius: 2,
                            }}
                          >
                            <Box sx={{
                              display: "flex", alignItems: "center", gap: 0.5
                            }}>
                              <p>👤{u.staffName}</p>
                            </Box>
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
              <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
                <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
                  <TableHeadCustom headLabel={TABLE_HEAD} />

                  <TableBody>
                    {dataInPage.map((row) => {
                      const scheduleName = row.scheduleName || row.shiftName || 'N/A';
                      const startTime = row.startTime || row.shiftStartTime || '—';
                      const endTime = row.endTime || row.shiftEndTime || '—';
                      const version = row.scheduleVersion;

                      return (
                        <TableRow key={row.id} hover>
                          <TableCell>{row.staffName}</TableCell>
                          <TableCell>{scheduleName}</TableCell>
                          <TableCell>
                            {new Date(row.date).toLocaleDateString('vi-VN')}
                          </TableCell>
                          <TableCell>
                            {startTime} - {endTime}
                          </TableCell>
                          <TableCell>
                            {version && (
                              <Label variant="soft" color="info">
                                v{version}
                              </Label>
                            )}
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
                      );
                    })}

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

      {/* Single Assign Dialog */}
      <Dialog open={assignMode === 'single' && createDialog.value} onClose={createDialog.onFalse} maxWidth="sm" fullWidth>
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
      <Dialog open={assignMode === 'bulk' && bulkDialog.value} onClose={bulkDialog.onFalse} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Phân công hàng loạt</DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          <Stack direction="row" sx={{ height: 560 }}>
            {/* ===== Left: Staff List ===== */}
            <Box
              sx={{
                width: 240,
                flexShrink: 0,
                borderRight: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2">
                  Nhân viên ({bulkStaffIds.length}/{users.length})
                </Typography>
              </Box>
              <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                <FormGroup>
                  {users.map((user) => (
                    <FormControlLabel
                      key={user.id}
                      control={
                        <Checkbox
                          checked={bulkStaffIds.includes(user.id)}
                          onChange={() => toggleBulkStaff(user.id)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2" noWrap>
                          {user.fullName}
                        </Typography>
                      }
                      sx={{ mx: 0, my: 0.25 }}
                    />
                  ))}
                </FormGroup>
              </Box>
              <Box sx={{ p: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button
                  size="small"
                  fullWidth
                  variant="outlined"
                  onClick={() =>
                    setBulkStaffIds(
                      bulkStaffIds.length === users.length ? [] : users.map((u) => u.id)
                    )
                  }
                >
                  {bulkStaffIds.length === users.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </Button>
              </Box>
            </Box>

            {/* ===== Right: Week Calendar ===== */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Week navigation */}
              <Stack
                direction="row"
                alignItems="center"
                sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <IconButton
                  size="small"
                  onClick={() =>
                    setBulkWeekStart((prev) => {
                      const d = new Date(prev);
                      d.setDate(d.getDate() - 7);
                      return d;
                    })
                  }
                >
                  <Iconify icon="eva:arrow-ios-back-fill" width={18} />
                </IconButton>
                <Typography variant="subtitle2" sx={{ flex: 1, textAlign: 'center' }}>
                  {bulkWeekStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                  {' — '}
                  {(() => {
                    const end = new Date(bulkWeekStart);
                    end.setDate(end.getDate() + 6);
                    return end.toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });
                  })()}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() =>
                    setBulkWeekStart((prev) => {
                      const d = new Date(prev);
                      d.setDate(d.getDate() + 7);
                      return d;
                    })
                  }
                >
                  <Iconify icon="eva:arrow-ios-forward-fill" width={18} />
                </IconButton>
                {bulkSelectedSlots.length > 0 && (
                  <Chip
                    size="small"
                    label={`${bulkSelectedSlots.length} ca đã chọn`}
                    color="primary"
                    onDelete={() => setBulkSelectedSlots([])}
                    sx={{ ml: 1 }}
                  />
                )}
              </Stack>

              {/* 7-column grid */}
              <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 1,
                  }}
                >
                  {/* Day headers */}
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(bulkWeekStart);
                    d.setDate(d.getDate() + i);
                    const dateStr = toLocalDateStr(d);
                    const isToday = dateStr === toLocalDateStr(new Date());
                    const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                    return (
                      <Box
                        key={dateStr}
                        sx={{
                          textAlign: 'center',
                          pb: 1,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          mb: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color={isToday ? 'primary.main' : 'text.secondary'}
                          display="block"
                        >
                          {DAY_NAMES[d.getDay()]}
                        </Typography>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            width: 26,
                            height: 26,
                            mx: 'auto',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: isToday ? 'primary.main' : 'transparent',
                            color: isToday ? 'primary.contrastText' : 'text.primary',
                            fontSize: 12,
                          }}
                        >
                          {d.getDate()}
                        </Typography>
                      </Box>
                    );
                  })}

                  {/* Schedule slots per day */}
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(bulkWeekStart);
                    d.setDate(d.getDate() + i);
                    const dateStr = toLocalDateStr(d);
                    const daySchedules = schedules
                      .filter((s) => {
                        if (!s.isActive) return false;
                        const from = s.fromDate.split('T')[0];
                        const to = s.toDate ? s.toDate.split('T')[0] : null;
                        return dateStr >= from && (to === null || dateStr <= to);
                      })
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));
                    return (
                      <Box key={dateStr} sx={{ minHeight: 80 }}>
                        {daySchedules.map((schedule) => {
                          const isSelected = bulkSelectedSlots.some(
                            (s) => s.scheduleId === schedule.id && s.date === dateStr
                          );
                          return (
                            <Box
                              key={schedule.id}
                              onClick={() => toggleBulkSlot(schedule.id, dateStr)}
                              sx={{
                                mb: 0.5,
                                p: 0.75,
                                borderRadius: 1,
                                cursor: 'pointer',
                                bgcolor: isSelected
                                  ? `${schedule.color}35`
                                  : `${schedule.color}12`,
                                border: '2px solid',
                                borderColor: isSelected ? schedule.color : 'transparent',
                                transition: 'all 0.15s',
                                '&:hover': {
                                  bgcolor: `${schedule.color}25`,
                                  borderColor: `${schedule.color}80`,
                                },
                              }}
                            >
                              <Typography
                                variant="caption"
                                fontWeight={600}
                                noWrap
                                sx={{ color: schedule.color, display: 'block' }}
                              >
                                {schedule.templateName}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ display: 'block' }}
                              >
                                {schedule.startTime}–{schedule.endTime}
                              </Typography>
                            </Box>
                          );
                        })}
                        {daySchedules.length === 0 && (
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ display: 'block', textAlign: 'center', pt: 1 }}
                          >
                            —
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
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
            disabled={bulkStaffIds.length === 0 || bulkSelectedSlots.length === 0}
          >
            Phân công {bulkStaffIds.length} NV × {bulkSelectedSlots.length} ca
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Manage Shift Dialog */}
      <Dialog
        open={manageDialog.value}
        onClose={manageDialog.onFalse}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        {managingEvent && (
          <>
            <DialogTitle sx={{ pb: 1, pr: 6 }}>
              <IconButton
                onClick={manageDialog.onFalse}
                sx={{ position: 'absolute', right: 16, top: 16 }}
              >
                <Iconify icon="mingcute:close-line" width={22} />
              </IconButton>
              <Typography variant="h5" fontWeight={700}>
                Phân Công Ca
              </Typography>
              <Typography variant="h6" fontWeight={600} sx={{ mt: 0.5 }}>
                {managingEvent.title} ({managingEvent.startTime} - {managingEvent.endTime})
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Ngày: {new Date(managingEvent.date).toLocaleDateString('vi-VN')} | Đã phân:{' '}
                {dndAssigned.length} người
              </Typography>
            </DialogTitle>

            <DialogContent dividers sx={{ p: 0 }}>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Stack direction={{ xs: 'column', md: 'row' }} sx={{ minHeight: 420 }}>
                  {/* ===== Left Panel - Staff List ===== */}
                  <Box
                    sx={{
                      flex: 1,
                      p: 3,
                      borderRight: { md: '1px solid' },
                      borderColor: { md: 'divider' },
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                      Danh Sách Nhân Viên
                    </Typography>

                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Tìm kiếm..."
                      value={manageSearchQuery}
                      onChange={(e) => setManageSearchQuery(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Iconify icon="eva:search-fill" width={20} sx={{ color: 'text.disabled' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ mb: 2 }}
                    />

                    <Box sx={{ maxHeight: 340, overflowY: 'auto' }}>
                      {/* Registered Section */}
                      <Box sx={{ mb: 2 }}>
                        <Stack direction="row" alignItems="center" sx={{ mb: 1, py: 0.5 }}>
                          <Iconify
                            icon="eva:checkmark-circle-2-fill"
                            sx={{ color: 'success.main', mr: 1, width: 20, height: 20 }}
                          />
                          <Typography variant="subtitle2" sx={{ color: 'success.dark', flex: 1 }}>
                            Đăng ký ({dndRegistered.length})
                          </Typography>
                        </Stack>

                        <Droppable droppableId="registered" type="STAFF">
                          {(provided, snapshot) => (
                            <Box
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              sx={{
                                bgcolor: snapshot.isDraggingOver
                                  ? 'warning.light'
                                  : 'warning.lighter',
                                borderRadius: 1.5,
                                minHeight: 48,
                                transition: 'background-color 0.2s',
                                p: dndRegistered.length ? 0 : 1.5,
                              }}
                            >
                              {dndRegistered.length === 0 && !snapshot.isDraggingOver && (
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                  sx={{ textAlign: 'center', display: 'block' }}
                                >
                                  Kéo nhân viên vào đây
                                </Typography>
                              )}
                              {dndRegistered.map((staffId, index) => {
                                const info = staffInfoMap.get(staffId);
                                if (!info) return null;
                                const q = manageSearchQuery.toLowerCase();
                                const isMatch = !q || info.name.toLowerCase().includes(q);
                                return (
                                  <Draggable key={staffId} draggableId={staffId} index={index}>
                                    {(dragProvided, dragSnapshot) => (
                                      <Stack
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        direction="row"
                                        alignItems="center"
                                        spacing={1.5}
                                        sx={{
                                          px: 2,
                                          py: 1.5,
                                          opacity: isMatch ? 1 : 0.3,
                                          bgcolor: dragSnapshot.isDragging
                                            ? 'warning.light'
                                            : 'transparent',
                                          borderRadius: dragSnapshot.isDragging ? 1.5 : 0,
                                          ...(index > 0 && {
                                            borderTop: '1px solid',
                                            borderColor: 'warning.light',
                                          }),
                                        }}
                                      >
                                        <Avatar
                                          src={info.avatarUrl}
                                          sx={{ width: 36, height: 36, fontSize: 14 }}
                                        >
                                          {info.name
                                            .split(' ')
                                            .map((n) => n[0])
                                            .join('')
                                            .slice(-2)
                                            .toUpperCase()}
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                          <Typography variant="body2" fontWeight={600} noWrap>
                                            {info.name}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            noWrap
                                          >
                                            {info.role}
                                          </Typography>
                                        </Box>
                                        <Iconify
                                          icon="eva:checkmark-circle-2-fill"
                                          sx={{
                                            color: 'success.main',
                                            width: 22,
                                            height: 22,
                                            flexShrink: 0,
                                          }}
                                        />
                                      </Stack>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                            </Box>
                          )}
                        </Droppable>
                      </Box>

                      {/* Available Section */}
                      <Box>
                        <Stack direction="row" alignItems="center" sx={{ mb: 1, py: 0.5 }}>
                          <Iconify
                            icon="mdi:checkbox-blank-outline"
                            sx={{ color: 'text.secondary', mr: 1, width: 20, height: 20 }}
                          />
                          <Typography variant="subtitle2" sx={{ flex: 1 }}>
                            Còn lại ({dndAvailable.length})
                          </Typography>
                        </Stack>

                        <Droppable droppableId="available" type="STAFF">
                          {(provided, snapshot) => (
                            <Box
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              sx={{
                                borderRadius: 1.5,
                                minHeight: 48,
                                bgcolor: snapshot.isDraggingOver
                                  ? 'action.hover'
                                  : 'transparent',
                                transition: 'background-color 0.2s',
                              }}
                            >
                              {dndAvailable.map((staffId, index) => {
                                const info = staffInfoMap.get(staffId);
                                if (!info) return null;
                                const q = manageSearchQuery.toLowerCase();
                                const isMatch = !q || info.name.toLowerCase().includes(q);
                                return (
                                  <Draggable key={staffId} draggableId={staffId} index={index}>
                                    {(dragProvided, dragSnapshot) => (
                                      <Stack
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        direction="row"
                                        alignItems="center"
                                        spacing={1.5}
                                        sx={{
                                          px: 2,
                                          py: 1.5,
                                          opacity: isMatch ? 1 : 0.3,
                                          cursor: 'grab',
                                          bgcolor: dragSnapshot.isDragging
                                            ? 'action.selected'
                                            : 'transparent',
                                          borderRadius: dragSnapshot.isDragging ? 1.5 : 0,
                                          '&:hover': dragSnapshot.isDragging
                                            ? {}
                                            : { bgcolor: 'action.hover' },
                                          ...(index > 0 && {
                                            borderTop: '1px solid',
                                            borderColor: 'divider',
                                          }),
                                        }}
                                      >
                                        <Avatar
                                          src={info.avatarUrl}
                                          sx={{ width: 36, height: 36, fontSize: 14 }}
                                        >
                                          {info.name
                                            .split(' ')
                                            .map((n) => n[0])
                                            .join('')
                                            .slice(-2)
                                            .toUpperCase()}
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                          <Typography variant="body2" fontWeight={500} noWrap>
                                            {info.name}
                                          </Typography>
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            noWrap
                                          >
                                            {info.role}
                                          </Typography>
                                        </Box>
                                      </Stack>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                              {dndAvailable.length === 0 && !snapshot.isDraggingOver && (
                                <Typography
                                  variant="caption"
                                  color="text.disabled"
                                  sx={{ p: 2, textAlign: 'center', display: 'block' }}
                                >
                                  Không còn nhân viên
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Droppable>
                      </Box>
                    </Box>
                  </Box>

                  {/* ===== Right Panel - Assigned Staff ===== */}
                  <Box sx={{ flex: 1, p: 3 }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 2 }}
                    >
                      <Typography variant="subtitle1" fontWeight={600}>
                        Nhân Viên Trong Ca
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {dndAssigned.length} người
                      </Typography>
                    </Stack>

                    <Droppable droppableId="assigned" type="STAFF">
                      {(provided, snapshot) => (
                        <Stack
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          spacing={1.5}
                          sx={{
                            maxHeight: 360,
                            overflowY: 'auto',
                            minHeight: 100,
                            borderRadius: 1.5,
                            p: 1,
                            bgcolor: snapshot.isDraggingOver
                              ? 'primary.lighter'
                              : 'transparent',
                            transition: 'background-color 0.2s',
                          }}
                        >
                          {dndAssigned.map((staffId, index) => {
                            const info = staffInfoMap.get(staffId);
                            if (!info) return null;
                            const isRegistered = originalRegisteredIds.includes(staffId);
                            return (
                              <Draggable key={staffId} draggableId={staffId} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                  <Stack
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    direction="row"
                                    alignItems="center"
                                    spacing={1.5}
                                    sx={{
                                      p: 1.5,
                                      borderRadius: 1.5,
                                      bgcolor: dragSnapshot.isDragging
                                        ? 'primary.light'
                                        : 'primary.lighter',
                                      border: '1px solid',
                                      borderColor: 'primary.light',
                                      cursor: 'grab',
                                    }}
                                  >
                                    <Avatar
                                      src={info.avatarUrl}
                                      sx={{ width: 36, height: 36, fontSize: 14 }}
                                    >
                                      {info.name
                                        .split(' ')
                                        .map((n) => n[0])
                                        .join('')
                                        .slice(-2)
                                        .toUpperCase()}
                                    </Avatar>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Stack direction="row" alignItems="center" spacing={0.75}>
                                        <Typography variant="body2" fontWeight={600} noWrap>
                                          {info.name}
                                        </Typography>
                                        {!isRegistered && (
                                          <Chip
                                            label="Chỉ định"
                                            size="small"
                                            variant="outlined"
                                            color="warning"
                                            sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
                                          />
                                        )}
                                      </Stack>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        noWrap
                                      >
                                        {info.role}
                                      </Typography>
                                    </Box>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleOpenSwap(staffId)}
                                      title="Đổi ca"
                                      sx={{
                                        bgcolor: 'info.lighter',
                                        color: 'info.main',
                                        '&:hover': { bgcolor: 'info.light' },
                                        width: 28,
                                        height: 28,
                                        mr: 0.5,
                                      }}
                                    >
                                      <Iconify icon="mdi:swap-horizontal" width={16} />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleRemoveFromAssigned(staffId)}
                                      sx={{
                                        bgcolor: 'error.lighter',
                                        color: 'error.main',
                                        '&:hover': { bgcolor: 'error.light' },
                                        width: 28,
                                        height: 28,
                                      }}
                                    >
                                      <Iconify icon="mingcute:close-line" width={16} />
                                    </IconButton>
                                  </Stack>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}

                          {/* Drop zone hint */}
                          <Box
                            sx={{
                              p: 2,
                              borderRadius: 1.5,
                              border: '2px dashed',
                              borderColor: snapshot.isDraggingOver
                                ? 'primary.main'
                                : 'divider',
                              textAlign: 'center',
                              bgcolor: snapshot.isDraggingOver
                                ? 'primary.lighter'
                                : 'transparent',
                              transition: 'all 0.2s',
                            }}
                          >
                            <Typography
                              variant="body2"
                              color={
                                snapshot.isDraggingOver ? 'primary.main' : 'text.disabled'
                              }
                            >
                              Kéo & thả vào đây
                            </Typography>
                          </Box>
                        </Stack>
                      )}
                    </Droppable>
                  </Box>
                </Stack>
              </DragDropContext>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button variant="outlined" onClick={manageDialog.onFalse}>
                Hủy
              </Button>
              <LoadingButton
                variant="contained"
                onClick={handleSaveAssignments}
                loading={manageSaving}
              >
                Lưu
              </LoadingButton>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Swap Dialog */}
      <Dialog
        open={swapDialog.value}
        onClose={swapDialog.onFalse}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="mdi:swap-horizontal" width={24} sx={{ color: 'info.main' }} />
            <Typography variant="h6" fontWeight={700}>
              Đổi ca làm việc
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {swapSource && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              {/* Source info */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  bgcolor: 'primary.lighter',
                  border: '1px solid',
                  borderColor: 'primary.light',
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Nhân viên cần đổi
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Avatar sx={{ width: 36, height: 36, fontSize: 14 }}>
                    {swapSource.staffName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(-2)
                      .toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2">{swapSource.staffName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {swapSource.scheduleName} | {new Date(swapSource.date).toLocaleDateString('vi-VN')}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ textAlign: 'center' }}>
                <Iconify icon="mdi:swap-vertical" width={28} sx={{ color: 'text.disabled' }} />
              </Box>

              {/* Target schedule */}
              <TextField
                select
                fullWidth
                label="Ca đổi đến"
                value={swapTargetScheduleId}
                onChange={(e) => setSwapTargetScheduleId(e.target.value)}
                helperText="Chọn ca muốn đổi đến"
              >
                {schedules.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          bgcolor: s.color,
                          flexShrink: 0,
                        }}
                      />
                      <span>
                        {s.templateName} ({s.startTime} - {s.endTime})
                      </span>
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>

              {/* Target date */}
              <DatePicker
                label="Ngày đổi đến"
                value={parseDateStr(swapTargetDate)}
                onChange={(val) => setSwapTargetDate(toDateStr(val))}
                format="dd/MM/yyyy"
                slotProps={{ textField: { fullWidth: true } }}
              />

              {/* Target staff */}
              <TextField
                select
                fullWidth
                label="Nhân viên đổi"
                value={swapTargetStaffId}
                onChange={(e) => setSwapTargetStaffId(e.target.value)}
                disabled={!swapTargetScheduleId || !swapTargetDate || swapLoadingCandidates}
                helperText={
                  swapLoadingCandidates
                    ? 'Đang tải...'
                    : swapTargetCandidates.length === 0 && swapTargetScheduleId && swapTargetDate
                      ? 'Không có nhân viên trong ca này'
                      : 'Chọn nhân viên muốn đổi'
                }
              >
                {swapTargetCandidates.map((c) => (
                  <MenuItem key={c.staffId} value={c.staffId}>
                    {c.staffName}
                  </MenuItem>
                ))}
              </TextField>

              {/* Preview */}
              {swapTargetStaffId && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 1.5,
                    bgcolor: 'info.lighter',
                    border: '1px solid',
                    borderColor: 'info.light',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Kết quả sau khi đổi
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      <strong>{swapSource.staffName}</strong> → {schedules.find((s) => s.id === swapTargetScheduleId)?.templateName}{' '}
                      ({new Date(swapTargetDate).toLocaleDateString('vi-VN')})
                    </Typography>
                    <Typography variant="body2">
                      <strong>{swapTargetCandidates.find((c) => c.staffId === swapTargetStaffId)?.staffName}</strong> → {swapSource.scheduleName}{' '}
                      ({new Date(swapSource.date).toLocaleDateString('vi-VN')})
                    </Typography>
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={swapDialog.onFalse}>
            Hủy
          </Button>
          <LoadingButton
            variant="contained"
            color="info"
            onClick={handleSwap}
            loading={swapSaving}
            disabled={!swapTargetScheduleId || !swapTargetDate || !swapTargetStaffId}
            startIcon={<Iconify icon="mdi:swap-horizontal" />}
          >
            Đổi ca
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
                  Lịch ca (Template)
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle1">
                    {selectedEvent.scheduleName || selectedEvent.shiftName}
                  </Typography>
                  {selectedEvent.scheduleVersion && (
                    <Chip label={`v${selectedEvent.scheduleVersion}`} size="small" />
                  )}
                </Stack>
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
                  {selectedEvent.startTime || selectedEvent.shiftStartTime} -{' '}
                  {selectedEvent.endTime || selectedEvent.shiftEndTime}
                </Typography>
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
          {selectedEvent && (
            <Button
              color="error"
              onClick={() => {
                setDeleteTarget(selectedEvent.id);
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
