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
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Alert from '@mui/material/Alert';
import { useTheme, alpha } from '@mui/material/styles';

import Chart, { useChart } from 'src/components/chart';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';
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

import { IShiftSchedule, IShiftAssignment, IShiftRegistration, IStaffShiftPreferenceSummary, IUser } from 'src/types/corecms-api';
import { ICalendarEvent, ICalendarView, ICalendarScheduleEvent } from 'src/types/calendar';
import {
  getShiftAssignments,
  getAllAttendanceReports,
  createShiftAssignment,
  deleteShiftAssignment,
  bulkAssignShiftSchedule,
  manageShiftAssignments,
  swapShiftAssignments,
  getShiftSchedulesByDateRange,
} from 'src/api/attendance';
import { getShiftRegistrations } from 'src/api/shiftRegistration';
import { getAllStaffShiftPreferences } from 'src/api/userPreference';
import { getAllUsers } from 'src/api/users';


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

interface IAutoAssignSlot {
  scheduleId: string;
  date: string;
  scheduleName: string;
  color: string;
  startTime: string;
  endTime: string;
  existingStaffIds: string[];      // currently assigned (some may be overwritten)
  proposedStaffIds: string[];      // final staff after auto-assign (tối đa 2)
  registeredStaffIds: Set<string>; // subset of proposedStaffIds that registered the slot
}

// Seeded LCG shuffle — same seed produces same order
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = Math.imul(s, 1664525) + 1013904223;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Group items by keyFn, sort by key, shuffle within each group using the given seed
function groupAndShuffle<T>(arr: T[], keyFn: (item: T) => string, seed: number): T[] {
  const groups = new Map<string, T[]>();
  arr.forEach((item) => {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  const sortedKeys = Array.from(groups.keys()).sort();
  return sortedKeys.flatMap((key) => seededShuffle(groups.get(key)!, seed));
}

// Ca đã đến giờ bắt đầu chưa (so theo giờ máy client — giờ VN)
const isShiftStarted = (date: string, startTime?: string): boolean => {
  if (!date) return false;
  const hhmm = (startTime || '00:00').slice(0, 5);
  return new Date() >= new Date(`${date}T${hhmm}:00`);
};

const hasAttendance = (u?: { attendance?: any }): boolean => !!u?.attendance?.checkInTime;

export default function AttendanceAssignmentsView() {
  const theme = useTheme();
  const { user: authUser } = useAuthContext();
  // Manager bị chặn thao tác với ca đã bắt đầu / đã có chấm công — chỉ Admin được
  const isAdminUser =
    authUser?.role === 'Admin' || (authUser?.roles || []).includes('Admin');
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
  const [bulkWeekAssignments, setBulkWeekAssignments] = useState<IShiftAssignment[]>([]);
  const [bulkWeekRegistrations, setBulkWeekRegistrations] = useState<IShiftRegistration[]>([]);
  const [bulkOverwrite, setBulkOverwrite] = useState(false);
  // Danh sách staffId chỉ được xếp những ca chính họ đã đăng ký (rule xếp lịch theo từng nhân viên)
  const [bulkOnlyRegisteredIds, setBulkOnlyRegisteredIds] = useState<string[]>([]);
  // staffId đang hover trong cột nhân viên → tô viền các ca nhân viên đó đã đăng ký
  const [bulkHoverStaffId, setBulkHoverStaffId] = useState<string | null>(null);
  const [bulkTab, setBulkTab] = useState(0);
  const bulkConfirm = useBoolean();
  const autoAssignDialog = useBoolean();
  const [autoAssignSlots, setAutoAssignSlots] = useState<IAutoAssignSlot[]>([]);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [autoAssignSeed, setAutoAssignSeed] = useState(0);
  const [allStaffPrefs, setAllStaffPrefs] = useState<IStaffShiftPreferenceSummary[]>([]);
  const [punctualityMap, setPunctualityMap] = useState<Map<string, { lateCount: number; earlyLeaveCount: number }>>(new Map());
  // exclusionMap: slotKey → staffId[] — nhân viên không được xếp vào ca đó (bất khả kháng)
  const [exclusionMap, setExclusionMap] = useState<Record<string, string[]>>({});
  // designationMap: slotKey → staffId[] — nhân viên CHỈ ĐỊNH cho ca đó, luôn được xếp, không bị ảnh hưởng bởi rule chọn
  const [designationMap, setDesignationMap] = useState<Record<string, string[]>>({});
  // Trạng thái popover chọn ngoại trừ (chuột phải vào ô ca)
  const [exclusionAnchor, setExclusionAnchor] = useState<{
    el: HTMLElement;
    slotKey: string;
    scheduleName: string;
    date: string;
  } | null>(null);

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

  // Fetch assignments for the bulk dialog's visible week
  useEffect(() => {
    if (!bulkDialog.value) return;
    const weekEnd = new Date(bulkWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const from = toLocalDateStr(bulkWeekStart);
    const to = toLocalDateStr(weekEnd);
    getShiftAssignments(from, to)
      .then((data) => setBulkWeekAssignments(data))
      .catch(() => setBulkWeekAssignments([]));
  }, [bulkWeekStart, bulkDialog.value]);

  // Fetch registrations for the bulk dialog's visible week
  useEffect(() => {
    if (!bulkDialog.value) return;
    const weekEnd = new Date(bulkWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const from = toLocalDateStr(bulkWeekStart);
    const to = toLocalDateStr(weekEnd);
    getShiftRegistrations(from, to)
      .then((data) => setBulkWeekRegistrations(data))
      .catch(() => setBulkWeekRegistrations([]));
    // Đổi tuần → reset ngoại trừ & chỉ định
    setExclusionMap({});
    setDesignationMap({});
  }, [bulkWeekStart, bulkDialog.value]);

  // Map: "scheduleId_date" → assigned staff names (for tooltip)
  const bulkSlotStaffMap = useMemo(() => {
    const map = new Map<string, string[]>();
    bulkWeekAssignments.forEach((a) => {
      const dateStr = a.date.split('T')[0];
      const key = `${a.shiftScheduleId}_${dateStr}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a.staffName);
    });
    return map;
  }, [bulkWeekAssignments]);

  // Map: "scheduleId_date" → nhân viên đã chấm công (checkin/checkout) trong ca đó
  // Dùng để cảnh báo khi chỉ định/ghi đè vào ca đã có người chấm công.
  const bulkSlotAttendanceMap = useMemo(() => {
    const map = new Map<string, { staffId: string; staffName: string; checkedIn: boolean; checkedOut: boolean }[]>();
    bulkWeekAssignments.forEach((a) => {
      const checkedIn = !!a.attendanceLog?.checkInTime;
      const checkedOut = !!a.attendanceLog?.checkOutTime;
      if (!checkedIn && !checkedOut) return;
      const dateStr = a.date.split('T')[0];
      const key = `${a.shiftScheduleId}_${dateStr}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ staffId: a.staffId, staffName: a.staffName, checkedIn, checkedOut });
    });
    return map;
  }, [bulkWeekAssignments]);

  // Map: "scheduleId_date" → all registered staff names (for tooltip)
  const bulkAllRegistrationMap = useMemo(() => {
    const map = new Map<string, string[]>();
    bulkWeekRegistrations.forEach((r) => {
      const dateStr = r.date.split('T')[0];
      const key = `${r.shiftScheduleId}_${dateStr}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r.staffName);
    });
    return map;
  }, [bulkWeekRegistrations]);

  // Chart data: staff assignment counts for the bulk dialog week
  const bulkChartData = useMemo(() => {
    const countMap = new Map<string, number>();
    bulkWeekAssignments.forEach((a) => {
      countMap.set(a.staffName, (countMap.get(a.staffName) || 0) + 1);
    });
    const entries = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1]);
    return {
      categories: entries.map(([name]) => name),
      series: entries.map(([, count]) => count),
    };
  }, [bulkWeekAssignments]);

  // Chart data: số ca mỗi nhân viên sau khi phân công tự động (xem phân bổ)
  const autoAssignChartData = useMemo(() => {
    const countMap = new Map<string, number>();
    autoAssignSlots.forEach((slot) => {
      slot.proposedStaffIds.forEach((id) => {
        const name = staffInfoMap.get(id)?.name || id;
        countMap.set(name, (countMap.get(name) || 0) + 1);
      });
    });
    const entries = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1]);
    return {
      categories: entries.map(([name]) => name),
      series: entries.map(([, count]) => count),
    };
  }, [autoAssignSlots, staffInfoMap]);

  // Map: staffId → số ca nhân viên đã đăng ký trong tuần đang hiển thị
  const bulkRegistrationCountMap = useMemo(() => {
    const map = new Map<string, number>();
    bulkWeekRegistrations.forEach((r) => {
      map.set(r.staffId, (map.get(r.staffId) || 0) + 1);
    });
    return map;
  }, [bulkWeekRegistrations]);

  // Map: staffId → Set("scheduleId_date") các ca nhân viên đã đăng ký
  // (dùng để tô viền các ca khi hover vào nhân viên trong danh sách)
  const bulkStaffRegistrationSlotsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    bulkWeekRegistrations.forEach((r) => {
      const dateStr = r.date.split('T')[0];
      const key = `${r.shiftScheduleId}_${dateStr}`;
      if (!map.has(r.staffId)) map.set(r.staffId, new Set());
      map.get(r.staffId)!.add(key);
    });
    return map;
  }, [bulkWeekRegistrations]);

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
      const target = tableData.find((a) => a.id === id);
      if (!isAdminUser && target) {
        if (target.attendanceLog?.checkInTime) {
          enqueueSnackbar('Ca đã có chấm công, không thể xóa. Chỉ Admin mới được phép.', {
            variant: 'warning',
          });
          return;
        }
        if (isShiftStarted(target.date, target.startTime)) {
          enqueueSnackbar('Ca đã bắt đầu hoặc đã qua, không thể xóa. Chỉ Admin mới được phép.', {
            variant: 'warning',
          });
          return;
        }
      }
      try {
        await deleteShiftAssignment(id);
        enqueueSnackbar('Deleted!');
        fetchAssignments();
      } catch (error: any) {
        console.error(error);
        enqueueSnackbar(error?.title || error?.message || 'Delete failed!', { variant: 'error' });
      }
    },
    [enqueueSnackbar, fetchAssignments, tableData, isAdminUser]
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

  // Selected slots that already have at least one registered staff (for warning)
  const bulkSelectedRegisteredSlots = useMemo(() => {
    const regMap = new Map<string, string[]>();
    bulkWeekRegistrations.forEach((r) => {
      const dateStr = r.date.split('T')[0];
      const key = `${r.shiftScheduleId}_${dateStr}`;
      if (!regMap.has(key)) regMap.set(key, []);
      regMap.get(key)!.push(r.staffName);
    });
    return bulkSelectedSlots
      .map((slot) => {
        const key = `${slot.scheduleId}_${slot.date}`;
        const staffNames = regMap.get(key);
        if (!staffNames || staffNames.length === 0) return null;
        const schedule = schedules.find((s) => s.id === slot.scheduleId);
        return {
          scheduleId: slot.scheduleId,
          date: slot.date,
          shiftName: schedule?.templateName || 'Ca',
          staffNames,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [bulkSelectedSlots, bulkWeekRegistrations, schedules]);

  const doBulkAssign = async () => {
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
          overwrite: bulkOverwrite,
        });
        totalCount += result.count;
      }
      enqueueSnackbar(`Đã phân công ${totalCount} ca!`, { variant: 'success' });
      bulkConfirm.onFalse();
      bulkDialog.onFalse();
      setBulkStaffIds([]);
      setBulkSelectedSlots([]);
      setBulkOverwrite(false);
      setBulkOnlyRegisteredIds([]);
      setBulkHoverStaffId(null);
      setExclusionMap({});
      setDesignationMap({});
      fetchAssignments();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Phân công thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleBulkAssign = () => {
    // Cảnh báo nếu có ca đã được nhân viên đăng ký → hỏi xác nhận trước khi gán
    if (bulkSelectedRegisteredSlots.length > 0) {
      bulkConfirm.onTrue();
      return;
    }
    doBulkAssign();
  };

  // Core algorithm: compute proposals for all slots in the visible week given a seed
  const computeAutoAssignSlots = (
    prefsMap: Map<string, Set<string>>,
    punctMap: Map<string, { lateCount: number; earlyLeaveCount: number }>,
    seed: number
  ): IAutoAssignSlot[] => {
    const weekEnd = new Date(bulkWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Build all applicable slots for the week
    const allSlots: { scheduleId: string; date: string }[] = [];
    for (let d = new Date(bulkWeekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = toLocalDateStr(new Date(d));
      schedules.forEach((s) => {
        if (!s.isActive) return;
        const from = s.fromDate.split('T')[0];
        const to = s.toDate ? s.toDate.split('T')[0] : null;
        if (dateStr >= from && (to === null || dateStr <= to)) {
          allSlots.push({ scheduleId: s.id, date: dateStr });
        }
      });
    }

    // Build existing assignment map: slotKey → staffId[]
    const existingMap = new Map<string, string[]>();
    bulkWeekAssignments.forEach((a) => {
      const dateStr = a.date.split('T')[0];
      const key = `${a.shiftScheduleId}_${dateStr}`;
      if (!existingMap.has(key)) existingMap.set(key, []);
      existingMap.get(key)!.push(a.staffId);
    });

    // Build registration map: slotKey → staffId[]
    const registrationMap = new Map<string, string[]>();
    bulkWeekRegistrations.forEach((r) => {
      const dateStr = r.date.split('T')[0];
      const key = `${r.shiftScheduleId}_${dateStr}`;
      if (!registrationMap.has(key)) registrationMap.set(key, []);
      registrationMap.get(key)!.push(r.staffId);
    });

    // Toàn bộ ca trong tuần sẽ được phân công lại (ghi đè), nên running count bắt đầu từ 0
    // và chỉ tăng theo các đề xuất mới → phân bổ số ca đều cho nhân viên đã chọn.
    const runningCount = new Map<string, number>();

    const punctScore = (id: string) => {
      const p = punctMap.get(id);
      return p ? p.lateCount + p.earlyLeaveCount : 0;
    };

    // Chỉ gợi ý phân công cho những nhân viên đã được tích chọn
    const selectedSet = new Set(bulkStaffIds);
    const selectedUsers = users.filter((u) => selectedSet.has(u.id));
    // Nhân viên chỉ được xếp ca chính họ đã đăng ký → không xét ở các tier dự phòng
    const onlyRegisteredSet = new Set(bulkOnlyRegisteredIds);
    const rankKey = (u: IUser) => `${runningCount.get(u.id) || 0}_${punctScore(u.id)}`;

    const MAX_STAFF = 2; // mỗi ca tối đa 2 người
    const result: IAutoAssignSlot[] = [];

    allSlots.forEach((slot) => {
      const schedule = schedules.find((s) => s.id === slot.scheduleId);
      if (!schedule) return;

      const slotKey = `${slot.scheduleId}_${slot.date}`;
      const existingIds = existingMap.get(slotKey) || [];
      const registeredSet = new Set(registrationMap.get(slotKey) || []);
      const templateId = schedule.shiftTemplateId;
      // Nhân viên bị ngoại trừ khỏi ca này (bất khả kháng)
      const excludedSet = new Set(exclusionMap[slotKey] || []);
      // Nhân viên được CHỈ ĐỊNH cho ca này — luôn xếp, không bị ảnh hưởng bởi rule chọn
      const designatedIds = designationMap[slotKey] || [];

      // Ghi đè: bỏ qua phân công cũ, chọn lại tối đa 2 người từ nhân viên đã tích chọn.
      const chosen: string[] = [];
      const taken = new Set<string>();
      const pick = (ids: string[]) => {
        for (const id of ids) {
          if (chosen.length >= MAX_STAFF) break;
          // Bỏ qua nhân viên bị ngoại trừ khỏi ca này
          if (!taken.has(id) && !excludedSet.has(id)) {
            chosen.push(id);
            taken.add(id);
          }
        }
      };

      // Ưu tiên 0: nhân viên chỉ định — luôn xếp trước, bỏ qua ngoại trừ / đăng ký / tích chọn
      for (const id of designatedIds) {
        if (chosen.length >= MAX_STAFF) break;
        if (!taken.has(id)) {
          chosen.push(id);
          taken.add(id);
        }
      }

      // Tier 1: nhân viên đã đăng ký & đã tích chọn (không bị ngoại trừ)
      const tier1Pool = selectedUsers.filter((u) => registeredSet.has(u.id) && !excludedSet.has(u.id));
      pick(groupAndShuffle(tier1Pool, rankKey, seed + slot.date.length).map((u) => u.id));

      if (chosen.length < MAX_STAFF) {
        // Tier 2: nhân viên đã chọn có ca này trong ca ưa thích (không bị ngoại trừ)
        // Bỏ qua nhân viên "chỉ xếp ca đã đăng ký" vì họ không đăng ký ca này.
        const tier2Pool = selectedUsers.filter((u) => !taken.has(u.id) && !excludedSet.has(u.id) && !onlyRegisteredSet.has(u.id) && (prefsMap.get(u.id)?.has(templateId) ?? false));
        pick(groupAndShuffle(tier2Pool, rankKey, seed + slot.date.length).map((u) => u.id));
      }

      if (chosen.length < MAX_STAFF) {
        // Tier 3: nhân viên đã chọn còn lại (không bị ngoại trừ)
        // Bỏ qua nhân viên "chỉ xếp ca đã đăng ký".
        const tier3Pool = selectedUsers.filter((u) => !taken.has(u.id) && !excludedSet.has(u.id) && !onlyRegisteredSet.has(u.id) && !(prefsMap.get(u.id)?.has(templateId) ?? false));
        pick(groupAndShuffle(tier3Pool, rankKey, seed + slot.scheduleId.length).map((u) => u.id));
      }

      // Tăng running count cho các ca sau
      chosen.forEach((id) => runningCount.set(id, (runningCount.get(id) || 0) + 1));

      result.push({
        scheduleId: slot.scheduleId,
        date: slot.date,
        scheduleName: schedule.templateName,
        color: schedule.color,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        existingStaffIds: existingIds,
        proposedStaffIds: chosen,
        registeredStaffIds: new Set(chosen.filter((id) => registeredSet.has(id))),
      });
    });

    return result;
  };

  // Có ít nhất 1 nhân viên được chỉ định cho ca nào đó không
  const hasAnyDesignation = useMemo(
    () => Object.values(designationMap).some((arr) => arr.length > 0),
    [designationMap]
  );

  const handleAutoAssign = async () => {
    // Cần có nhân viên đã chọn HOẶC nhân viên chỉ định để gợi ý phân công
    if (bulkStaffIds.length === 0 && !hasAnyDesignation) {
      enqueueSnackbar('Vui lòng chọn nhân viên hoặc chỉ định nhân viên cho ca trước khi phân công tự động', { variant: 'warning' });
      return;
    }

    // Fetch preferences if not cached
    let prefsData = allStaffPrefs;
    if (prefsData.length === 0) {
      try { prefsData = await getAllStaffShiftPreferences(); setAllStaffPrefs(prefsData); } catch { prefsData = []; }
    }

    // Fetch last month punctuality if not cached
    let pMap = punctualityMap;
    if (pMap.size === 0) {
      try {
        const now = new Date();
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const fmt = (d: Date) => toLocalDateStr(d);
        const reports = await getAllAttendanceReports(fmt(firstOfLastMonth), fmt(lastOfLastMonth));
        pMap = new Map(reports.map((r) => [r.staffId, { lateCount: r.lateCount, earlyLeaveCount: r.earlyLeaveCount ?? 0 }]));
        setPunctualityMap(pMap);
      } catch { pMap = new Map(); }
    }

    const prefsMap = new Map<string, Set<string>>();
    prefsData.forEach((p) => prefsMap.set(p.userId, new Set(p.shiftTemplateIds)));

    const newSeed = Date.now();
    setAutoAssignSeed(newSeed);
    const slots = computeAutoAssignSlots(prefsMap, pMap, newSeed);
    setAutoAssignSlots(slots);
    autoAssignDialog.onTrue();
  };

  const handleRegenerateAutoAssign = () => {
    const prefsMap = new Map<string, Set<string>>();
    allStaffPrefs.forEach((p) => prefsMap.set(p.userId, new Set(p.shiftTemplateIds)));
    const newSeed = autoAssignSeed + 1;
    setAutoAssignSeed(newSeed);
    const slots = computeAutoAssignSlots(prefsMap, punctualityMap, newSeed);
    setAutoAssignSlots(slots);
  };

  const doAutoAssign = async () => {
    try {
      setAutoAssigning(true);

      // Lookup assignmentId theo (scheduleId, date, staffId) để gỡ phân công cũ khi ghi đè
      const assignmentIdMap = new Map<string, string>();
      bulkWeekAssignments.forEach((a) => {
        const dateStr = a.date.split('T')[0];
        assignmentIdMap.set(`${a.shiftScheduleId}_${dateStr}_${a.staffId}`, a.id);
      });

      let added = 0;
      let removed = 0;
      for (const slot of autoAssignSlots) {
        const proposedSet = new Set(slot.proposedStaffIds);
        const existingSet = new Set(slot.existingStaffIds);

        // Ghi đè: gỡ nhân viên đã phân công trước đó nhưng không nằm trong đề xuất mới
        for (const staffId of slot.existingStaffIds) {
          if (!proposedSet.has(staffId)) {
            const aid = assignmentIdMap.get(`${slot.scheduleId}_${slot.date}_${staffId}`);
            if (aid) {
              // eslint-disable-next-line no-await-in-loop
              await deleteShiftAssignment(aid);
              removed += 1;
            }
          }
        }

        // Thêm nhân viên mới chưa có trong ca
        for (const staffId of slot.proposedStaffIds) {
          if (!existingSet.has(staffId)) {
            // eslint-disable-next-line no-await-in-loop
            await createShiftAssignment({ staffId, shiftScheduleId: slot.scheduleId, date: slot.date });
            added += 1;
          }
        }
      }
      enqueueSnackbar(`Phân công tự động: +${added} thêm mới, -${removed} gỡ bỏ`, { variant: 'success' });
      autoAssignDialog.onFalse();
      bulkDialog.onFalse();
      setBulkSelectedSlots([]);
      setBulkStaffIds([]);
      setBulkOnlyRegisteredIds([]);
      setBulkHoverStaffId(null);
      setExclusionMap({});
      setDesignationMap({});
      fetchAssignments();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Phân công thất bại!', { variant: 'error' });
    } finally {
      setAutoAssigning(false);
    }
  };

  const toggleBulkStaff = (staffId: string) => {
    setBulkStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  // Bật/tắt rule "chỉ xếp ca đã đăng ký" cho 1 nhân viên cụ thể
  const toggleBulkOnlyRegistered = (staffId: string) => {
    setBulkOnlyRegisteredIds((prev) =>
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

  const toggleExclusion = (slotKey: string, staffId: string) => {
    setExclusionMap((prev) => {
      const current = prev[slotKey] || [];
      const next = current.includes(staffId)
        ? current.filter((id) => id !== staffId)
        : [...current, staffId];
      return { ...prev, [slotKey]: next };
    });
    // Ngoại trừ & chỉ định loại trừ lẫn nhau → khi ngoại trừ thì bỏ chỉ định
    setDesignationMap((prev) => {
      const current = prev[slotKey] || [];
      if (!current.includes(staffId)) return prev;
      return { ...prev, [slotKey]: current.filter((id) => id !== staffId) };
    });
  };

  const toggleDesignation = (slotKey: string, staffId: string) => {
    setDesignationMap((prev) => {
      const current = prev[slotKey] || [];
      const next = current.includes(staffId)
        ? current.filter((id) => id !== staffId)
        : [...current, staffId];
      return { ...prev, [slotKey]: next };
    });
    // Chỉ định thì bỏ ngoại trừ
    setExclusionMap((prev) => {
      const current = prev[slotKey] || [];
      if (!current.includes(staffId)) return prev;
      return { ...prev, [slotKey]: current.filter((id) => id !== staffId) };
    });
  };

  const openExclusionPopover = (e: { preventDefault: () => void; stopPropagation: () => void; currentTarget: HTMLElement }, slotKey: string, scheduleName: string, date: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExclusionAnchor({ el: e.currentTarget, slotKey, scheduleName, date });
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

    if (!isAdminUser && isShiftStarted(managingEvent.date, managingEvent.startTime)) {
      enqueueSnackbar('Ca đã bắt đầu hoặc đã qua, không thể thay đổi phân công. Chỉ Admin mới được phép.', {
        variant: 'warning',
      });
      return;
    }

    // Không cho gỡ nhân viên đã có chấm công khỏi ca (trừ Admin)
    if (!isAdminUser) {
      const removedWithCheckin = managingEvent.users.filter(
        (u) => !dndAssigned.includes(u.staffId) && hasAttendance(u)
      );
      if (removedWithCheckin.length > 0) {
        enqueueSnackbar(
          `Không thể gỡ nhân viên đã chấm công: ${removedWithCheckin.map((u) => u.staffName).join(', ')}`,
          { variant: 'warning' }
        );
        return;
      }
    }

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

      const sourceUser = managingEvent.users.find((u) => u.staffId === staffId);
      if (!isAdminUser && hasAttendance(sourceUser)) {
        enqueueSnackbar('Nhân viên này đã chấm công, không thể đổi ca. Chỉ Admin mới được phép.', {
          variant: 'warning',
        });
        return;
      }
      if (!isAdminUser && isShiftStarted(managingEvent.date, managingEvent.startTime)) {
        enqueueSnackbar('Ca đã bắt đầu hoặc đã qua, không thể đổi ca. Chỉ Admin mới được phép.', {
          variant: 'warning',
        });
        return;
      }

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
    [managingEvent, staffInfoMap, swapDialog, isAdminUser, enqueueSnackbar]
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

    if (!isAdminUser) {
      const targetSchedule = schedules.find((s) => s.id === swapTargetScheduleId);
      if (isShiftStarted(swapTargetDate, targetSchedule?.startTime)) {
        enqueueSnackbar('Ca muốn đổi đã bắt đầu hoặc đã qua, không thể đổi. Chỉ Admin mới được phép.', {
          variant: 'warning',
        });
        return;
      }
      const targetEvent = events.find((e) => e.id === `${swapTargetScheduleId}_${swapTargetDate}`);
      const targetUser = (targetEvent?.extendedProps.users as any[] | undefined)?.find(
        (u) => u.staffId === swapTargetStaffId
      );
      if (hasAttendance(targetUser)) {
        enqueueSnackbar('Nhân viên muốn đổi đã chấm công ca này, không thể đổi. Chỉ Admin mới được phép.', {
          variant: 'warning',
        });
        return;
      }
    }

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
                locale="vi"
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

            <TextField
              label="Ngày"
              type="date"
              value={newDate.split('T')[0]}
              onChange={(e) => setNewDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
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
      <Dialog open={assignMode === 'bulk' && bulkDialog.value} onClose={bulkDialog.onFalse} maxWidth="lg" fullWidth fullScreen={!smUp}>
        <DialogTitle sx={{ pb: 1, px: { xs: 2, sm: 3 } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Phân công hàng loạt</Typography>
            {!smUp && (
              <IconButton onClick={bulkDialog.onFalse} edge="end">
                <Iconify icon="mingcute:close-line" />
              </IconButton>
            )}
          </Stack>
          {!smUp && (
            <Tabs
              value={bulkTab}
              onChange={(_, v) => setBulkTab(v)}
              sx={{ mt: 1 }}
            >
              <Tab
                label={`Nhân viên (${bulkStaffIds.length})`}
                icon={<Iconify icon="solar:users-group-rounded-bold" width={18} />}
                iconPosition="start"
                sx={{ minHeight: 40, fontSize: 13 }}
              />
              <Tab
                label="Lịch tuần"
                icon={<Iconify icon="solar:calendar-bold" width={18} />}
                iconPosition="start"
                sx={{ minHeight: 40, fontSize: 13 }}
              />
            </Tabs>
          )}
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          {smUp ? (
          /* ===== Desktop: side-by-side layout ===== */
          <Stack direction="row" sx={{ height: 700 }}>
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
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.3 }}>
                  Di chuột vào nhân viên để xem ca họ đã đăng ký · bật{' '}
                  <Iconify icon="solar:lock-keyhole-bold" width={12} sx={{ verticalAlign: 'text-bottom' }} /> để chỉ xếp ca đã đăng ký
                </Typography>
              </Box>
              <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                <FormGroup>
                  {users.map((user) => {
                    const regCount = bulkRegistrationCountMap.get(user.id) || 0;
                    const isOnlyReg = bulkOnlyRegisteredIds.includes(user.id);
                    return (
                      <FormControlLabel
                        key={user.id}
                        onMouseEnter={() => setBulkHoverStaffId(user.id)}
                        onMouseLeave={() => setBulkHoverStaffId((prev) => (prev === user.id ? null : prev))}
                        control={
                          <Checkbox
                            checked={bulkStaffIds.includes(user.id)}
                            onChange={() => toggleBulkStaff(user.id)}
                            size="small"
                          />
                        }
                        label={
                          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ width: '100%' }}>
                            <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
                              {user.fullName}
                            </Typography>
                            {regCount > 0 && (
                              <Tooltip title={`Đã đăng ký ${regCount} ca trong tuần này`} arrow>
                                <Chip
                                  size="small"
                                  label={`📝 ${regCount}`}
                                  color="info"
                                  variant="soft"
                                  sx={{ height: 18, fontSize: 10, '& .MuiChip-label': { px: 0.75 } }}
                                />
                              </Tooltip>
                            )}
                            <Tooltip
                              title={
                                isOnlyReg
                                  ? 'Đang bật: chỉ xếp những ca nhân viên này đã đăng ký — bấm để tắt'
                                  : 'Chỉ xếp những ca nhân viên này đã đăng ký (không xếp ca khác)'
                              }
                              arrow
                            >
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleBulkOnlyRegistered(user.id);
                                }}
                                sx={{ p: 0.25, color: isOnlyReg ? 'primary.main' : 'text.disabled' }}
                              >
                                <Iconify
                                  icon={isOnlyReg ? 'solar:lock-keyhole-bold' : 'solar:lock-keyhole-minimalistic-linear'}
                                  width={16}
                                />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        }
                        sx={{
                          mx: 0,
                          my: 0.25,
                          width: '100%',
                          borderRadius: 1,
                          transition: 'background-color 0.15s',
                          bgcolor: bulkHoverStaffId === user.id ? alpha(theme.palette.warning.main, 0.12) : 'transparent',
                          '& .MuiFormControlLabel-label': { flexGrow: 1, minWidth: 0 },
                        }}
                      />
                    );
                  })}
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
                          const slotKey = `${schedule.id}_${dateStr}`;
                          const isSelected = bulkSelectedSlots.some(
                            (s) => s.scheduleId === schedule.id && s.date === dateStr
                          );
                          const assignedStaff = bulkSlotStaffMap.get(slotKey) || [];
                          const allRegisteredStaff = bulkAllRegistrationMap.get(slotKey) || [];
                          // Khi hover vào 1 nhân viên: tô viền các ca nhân viên đó đã đăng ký
                          const isHoverRegistered =
                            !!bulkHoverStaffId &&
                            (bulkStaffRegistrationSlotsMap.get(bulkHoverStaffId)?.has(slotKey) ?? false);
                          const excludedIds = exclusionMap[slotKey] || [];
                          const designatedIds = designationMap[slotKey] || [];
                          // Cảnh báo: chỉ định/ghi đè vào ca đã có người chấm công (không phải chính người được chỉ định)
                          const attendanceAtRisk = (bulkSlotAttendanceMap.get(slotKey) || []).filter((s) => !designatedIds.includes(s.staffId));
                          const designationOverwriteRisk = designatedIds.length > 0 && attendanceAtRisk.length > 0;
                          const tooltipParts: string[] = [];
                          if (assignedStaff.length > 0) tooltipParts.push(`Đã phân công (${assignedStaff.length}): ${assignedStaff.join(', ')}`);
                          if (allRegisteredStaff.length > 0) tooltipParts.push(`Đã đăng ký (${allRegisteredStaff.length}): ${allRegisteredStaff.join(', ')}`);
                          if (designatedIds.length > 0) tooltipParts.push(`Chỉ định (${designatedIds.length}): ${designatedIds.map((id) => staffInfoMap.get(id)?.name || id).join(', ')}`);
                          if (designationOverwriteRisk) tooltipParts.push(`⚠️ Sẽ ghi đè người đã chấm công: ${attendanceAtRisk.map((s) => s.staffName).join(', ')}`);
                          if (excludedIds.length > 0) tooltipParts.push(`Ngoại trừ (${excludedIds.length}): ${excludedIds.map((id) => staffInfoMap.get(id)?.name || id).join(', ')}`);
                          tooltipParts.push('Chuột phải để chỉ định / ngoại trừ');
                          const tooltipTitle = tooltipParts.join('\n');
                          return (
                            <Tooltip
                              key={schedule.id}
                              title={tooltipTitle}
                              arrow
                              placement="top"
                            >
                              <Box
                                onClick={() => toggleBulkSlot(schedule.id, dateStr)}
                                onContextMenu={(e) => openExclusionPopover(e, slotKey, schedule.templateName, dateStr)}
                                sx={{
                                  mb: 0.5,
                                  p: 0.75,
                                  borderRadius: 1,
                                  cursor: 'context-menu',
                                  position: 'relative',
                                  bgcolor: isSelected
                                    ? alpha(schedule.color, 0.22)
                                    : alpha(schedule.color, 0.07),
                                  border: '2px solid',
                                  borderColor: isSelected ? schedule.color : 'transparent',
                                  // Hover nhân viên → viền nổi bật các ca họ đã đăng ký
                                  boxShadow: isHoverRegistered ? `0 0 0 2px ${theme.palette.warning.main}` : 'none',
                                  transition: 'all 0.15s',
                                  '&:hover': {
                                    bgcolor: alpha(schedule.color, 0.15),
                                    borderColor: alpha(schedule.color, 0.5),
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
                                {assignedStaff.map((name) => (
                                  <Typography
                                    key={name}
                                    variant="caption"
                                    sx={{ display: 'block', fontSize: 10, mt: 0.25, color: 'text.secondary' }}
                                  >
                                    👤 {name}
                                  </Typography>
                                ))}
                                {excludedIds.length > 0 && (
                                  <Box
                                    sx={{
                                      position: 'absolute', top: 3, right: 3,
                                      bgcolor: 'error.main', color: 'white',
                                      borderRadius: '50%', width: 16, height: 16,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 9, fontWeight: 700, lineHeight: 1,
                                    }}
                                  >
                                    {excludedIds.length}
                                  </Box>
                                )}
                                {designatedIds.length > 0 && (
                                  <Box
                                    sx={{
                                      position: 'absolute', top: 3, left: 3,
                                      bgcolor: designationOverwriteRisk ? 'warning.main' : 'primary.main', color: 'white',
                                      borderRadius: 1, height: 16, px: 0.5,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 9, fontWeight: 700, lineHeight: 1, gap: 0.25,
                                    }}
                                  >
                                    {designationOverwriteRisk ? '⚠️' : '📌'} {designatedIds.length}
                                  </Box>
                                )}
                              </Box>
                            </Tooltip>
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

                {/* Bar chart: staff assignment counts */}
                {bulkChartData.categories.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Số ca đã phân công trong tuần
                    </Typography>
                    <Chart
                      type="bar"
                      series={[{ name: 'Số ca', data: bulkChartData.series }]}
                      options={{
                        chart: { toolbar: { show: false }, zoom: { enabled: false } },
                        plotOptions: {
                          bar: {
                            horizontal: true,
                            borderRadius: 4,
                            barHeight: '60%',
                          },
                        },
                        xaxis: {
                          categories: bulkChartData.categories,
                          labels: { style: { fontSize: '11px' } },
                        },
                        yaxis: {
                          labels: { style: { fontSize: '12px' } },
                        },
                        tooltip: {
                          y: { formatter: (val: number) => `${val} ca` },
                        },
                        dataLabels: { enabled: true, style: { fontSize: '11px' } },
                        colors: [theme.palette.primary.main],
                        grid: { borderColor: theme.palette.divider, strokeDashArray: 3 },
                      }}
                      height={Math.max(180, bulkChartData.categories.length * 36)}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          </Stack>
          ) : (
          /* ===== Mobile: tab-based layout ===== */
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {/* Tab 0: Staff list */}
            {bulkTab === 0 && (
              <Box sx={{ p: 1.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">
                    Nhân viên ({bulkStaffIds.length}/{users.length})
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      setBulkStaffIds(
                        bulkStaffIds.length === users.length ? [] : users.map((u) => u.id)
                      )
                    }
                  >
                    {bulkStaffIds.length === users.length ? 'Bỏ chọn' : 'Chọn tất cả'}
                  </Button>
                </Stack>
                <FormGroup>
                  {users.map((user) => {
                    const regCount = bulkRegistrationCountMap.get(user.id) || 0;
                    const isOnlyReg = bulkOnlyRegisteredIds.includes(user.id);
                    return (
                      <FormControlLabel
                        key={user.id}
                        onMouseEnter={() => setBulkHoverStaffId(user.id)}
                        onMouseLeave={() => setBulkHoverStaffId((prev) => (prev === user.id ? null : prev))}
                        control={
                          <Checkbox
                            checked={bulkStaffIds.includes(user.id)}
                            onChange={() => toggleBulkStaff(user.id)}
                            size="small"
                          />
                        }
                        label={
                          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ width: '100%' }}>
                            <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
                              {user.fullName}
                            </Typography>
                            {regCount > 0 && (
                              <Chip
                                size="small"
                                label={`📝 ${regCount}`}
                                color="info"
                                variant="soft"
                                sx={{ height: 18, fontSize: 10, '& .MuiChip-label': { px: 0.75 } }}
                              />
                            )}
                            <Tooltip
                              title={
                                isOnlyReg
                                  ? 'Đang bật: chỉ xếp những ca nhân viên này đã đăng ký — bấm để tắt'
                                  : 'Chỉ xếp những ca nhân viên này đã đăng ký (không xếp ca khác)'
                              }
                              arrow
                            >
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleBulkOnlyRegistered(user.id);
                                }}
                                sx={{ p: 0.25, color: isOnlyReg ? 'primary.main' : 'text.disabled' }}
                              >
                                <Iconify
                                  icon={isOnlyReg ? 'solar:lock-keyhole-bold' : 'solar:lock-keyhole-minimalistic-linear'}
                                  width={16}
                                />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        }
                        sx={{
                          mx: 0,
                          my: 0.25,
                          width: '100%',
                          borderRadius: 1,
                          bgcolor: bulkHoverStaffId === user.id ? alpha(theme.palette.warning.main, 0.12) : 'transparent',
                          '& .MuiFormControlLabel-label': { flexGrow: 1, minWidth: 0 },
                        }}
                      />
                    );
                  })}
                </FormGroup>
              </Box>
            )}

            {/* Tab 1: Week calendar */}
            {bulkTab === 1 && (
              <Box sx={{ p: 1.5 }}>
                {/* Week navigation */}
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="center"
                  spacing={0.5}
                  sx={{ mb: 1.5 }}
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
                    <Iconify icon="eva:arrow-ios-back-fill" />
                  </IconButton>
                  <Typography variant="subtitle2" sx={{ fontSize: 13, textAlign: 'center', minWidth: 140 }}>
                    {bulkWeekStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    {' \u2014 '}
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
                    <Iconify icon="eva:arrow-ios-forward-fill" />
                  </IconButton>
                </Stack>

                {bulkSelectedSlots.length > 0 && (
                  <Chip
                    size="small"
                    label={`${bulkSelectedSlots.length} ca đã chọn`}
                    color="primary"
                    onDelete={() => setBulkSelectedSlots([])}
                    sx={{ mb: 1.5 }}
                  />
                )}

                {/* Mobile: vertical day-by-day */}
                <Stack spacing={1.5}>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(bulkWeekStart);
                    d.setDate(d.getDate() + i);
                    const dateStr = toLocalDateStr(d);
                    const isToday = dateStr === toLocalDateStr(new Date());
                    const DAY_NAMES_M = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                    const daySchedules = schedules
                      .filter((s) => {
                        if (!s.isActive) return false;
                        const from = s.fromDate.split('T')[0];
                        const to = s.toDate ? s.toDate.split('T')[0] : null;
                        return dateStr >= from && (to === null || dateStr <= to);
                      })
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));
                    if (daySchedules.length === 0) return null;
                    return (
                      <Box key={i}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                          <Box
                            sx={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              ...(isToday
                                ? { bgcolor: 'primary.main', color: 'primary.contrastText' }
                                : { bgcolor: 'background.neutral' }),
                            }}
                          >
                            <Typography variant="caption" fontWeight={700}>
                              {d.getDate()}
                            </Typography>
                          </Box>
                          <Typography variant="subtitle2" color={i >= 5 ? 'error.main' : 'text.primary'}>
                            {DAY_NAMES_M[d.getDay()]},{' '}
                            {d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ pl: 0.5 }}>
                          {daySchedules.map((schedule) => {
                            const slotKey = `${schedule.id}_${dateStr}`;
                            const isSelected = bulkSelectedSlots.some(
                              (s) => s.scheduleId === schedule.id && s.date === dateStr
                            );
                            const assignedStaff = bulkSlotStaffMap.get(slotKey) || [];
                            const allRegisteredStaffMobile = bulkAllRegistrationMap.get(slotKey) || [];
                            const isHoverRegisteredMobile =
                              !!bulkHoverStaffId &&
                              (bulkStaffRegistrationSlotsMap.get(bulkHoverStaffId)?.has(slotKey) ?? false);
                            const excludedIdsMobile = exclusionMap[slotKey] || [];
                            const designatedIdsMobile = designationMap[slotKey] || [];
                            const attendanceAtRiskMobile = (bulkSlotAttendanceMap.get(slotKey) || []).filter((s) => !designatedIdsMobile.includes(s.staffId));
                            const designationOverwriteRiskMobile = designatedIdsMobile.length > 0 && attendanceAtRiskMobile.length > 0;
                            const tooltipPartsMobile: string[] = [];
                            if (assignedStaff.length > 0) tooltipPartsMobile.push(`Đã phân công (${assignedStaff.length}): ${assignedStaff.join(', ')}`);
                            if (allRegisteredStaffMobile.length > 0) tooltipPartsMobile.push(`Đã đăng ký (${allRegisteredStaffMobile.length}): ${allRegisteredStaffMobile.join(', ')}`);
                            if (designatedIdsMobile.length > 0) tooltipPartsMobile.push(`Chỉ định (${designatedIdsMobile.length}): ${designatedIdsMobile.map((id) => staffInfoMap.get(id)?.name || id).join(', ')}`);
                            if (designationOverwriteRiskMobile) tooltipPartsMobile.push(`⚠️ Sẽ ghi đè người đã chấm công: ${attendanceAtRiskMobile.map((s) => s.staffName).join(', ')}`);
                            if (excludedIdsMobile.length > 0) tooltipPartsMobile.push(`Ngoại trừ (${excludedIdsMobile.length}): ${excludedIdsMobile.map((id) => staffInfoMap.get(id)?.name || id).join(', ')}`);
                            tooltipPartsMobile.push('Nhấn giữ để chỉ định / ngoại trừ');
                            const tooltipTitleMobile = tooltipPartsMobile.join('\n');
                            return (
                              <Tooltip key={schedule.id} title={tooltipTitleMobile} arrow placement="top">
                              <Box
                                onClick={() => toggleBulkSlot(schedule.id, dateStr)}
                                onContextMenu={(e) => openExclusionPopover(e, slotKey, schedule.templateName, dateStr)}
                                sx={{
                                  flex: 1,
                                  minWidth: 0,
                                  px: 1.5,
                                  py: 1,
                                  borderRadius: 1,
                                  cursor: 'context-menu',
                                  transition: 'all 0.15s',
                                  userSelect: 'none',
                                  textAlign: 'center',
                                  position: 'relative',
                                  bgcolor: isSelected
                                    ? alpha(schedule.color, 0.22)
                                    : alpha(schedule.color, 0.07),
                                  border: '2px solid',
                                  borderColor: isSelected ? schedule.color : 'transparent',
                                  boxShadow: isHoverRegisteredMobile ? `0 0 0 2px ${theme.palette.warning.main}` : 'none',
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  fontWeight={700}
                                  display="block"
                                  sx={{ color: schedule.color, lineHeight: 1.4 }}
                                >
                                  {schedule.templateName}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  display="block"
                                  sx={{ color: schedule.color, opacity: 0.7, lineHeight: 1.3, fontSize: 11 }}
                                >
                                  {schedule.startTime}–{schedule.endTime}
                                </Typography>
                                {(assignedStaff.length > 0 || allRegisteredStaffMobile.length > 0) && (
                                  <Typography
                                    variant="caption"
                                    sx={{ display: 'block', fontSize: 10, mt: 0.25, color: 'text.secondary' }}
                                  >
                                    {assignedStaff.length > 0 && `👤 ${assignedStaff.length}`}
                                    {assignedStaff.length > 0 && allRegisteredStaffMobile.length > 0 && ' · '}
                                    {allRegisteredStaffMobile.length > 0 && `📝 ${allRegisteredStaffMobile.length}`}
                                  </Typography>
                                )}
                                {excludedIdsMobile.length > 0 && (
                                  <Box
                                    sx={{
                                      position: 'absolute', top: 3, right: 3,
                                      bgcolor: 'error.main', color: 'white',
                                      borderRadius: '50%', width: 16, height: 16,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 9, fontWeight: 700,
                                    }}
                                  >
                                    {excludedIdsMobile.length}
                                  </Box>
                                )}
                                {designatedIdsMobile.length > 0 && (
                                  <Box
                                    sx={{
                                      position: 'absolute', top: 3, left: 3,
                                      bgcolor: designationOverwriteRiskMobile ? 'warning.main' : 'primary.main', color: 'white',
                                      borderRadius: 1, height: 16, px: 0.5,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 9, fontWeight: 700, gap: 0.25,
                                    }}
                                  >
                                    {designationOverwriteRiskMobile ? '⚠️' : '📌'} {designatedIdsMobile.length}
                                  </Box>
                                )}
                              </Box>
                              </Tooltip>
                            );
                          })}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>

                {/* Bar chart */}
                {bulkChartData.categories.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Số ca đã phân công trong tuần
                    </Typography>
                    <Chart
                      type="bar"
                      series={[{ name: 'Số ca', data: bulkChartData.series }]}
                      options={{
                        chart: { toolbar: { show: false }, zoom: { enabled: false } },
                        plotOptions: {
                          bar: { horizontal: true, borderRadius: 4, barHeight: '60%' },
                        },
                        xaxis: {
                          categories: bulkChartData.categories,
                          labels: { style: { fontSize: '10px' } },
                        },
                        yaxis: { labels: { style: { fontSize: '11px' } } },
                        tooltip: { y: { formatter: (val: number) => `${val} ca` } },
                        dataLabels: { enabled: true, style: { fontSize: '10px' } },
                        colors: [theme.palette.primary.main],
                        grid: { borderColor: theme.palette.divider, strokeDashArray: 3 },
                      }}
                      height={Math.max(160, bulkChartData.categories.length * 32)}
                    />
                  </Box>
                )}
              </Box>
            )}
          </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Tooltip title="Khi bật: gỡ những nhân viên chưa được chọn khỏi ca rồi thêm nhân viên đang chọn. Nhân viên đã chấm công sẽ được giữ nguyên.">
            <FormControlLabel
              sx={{ mr: 'auto' }}
              control={
                <Checkbox
                  checked={bulkOverwrite}
                  onChange={(e) => setBulkOverwrite(e.target.checked)}
                />
              }
              label="Ghi đè ca đã có người"
            />
          </Tooltip>
          <Button variant="outlined" onClick={bulkDialog.onFalse}>
            Hủy
          </Button>
          <Tooltip title={bulkStaffIds.length === 0 && !hasAnyDesignation ? 'Hãy chọn nhân viên hoặc chỉ định nhân viên cho ca trước' : 'Phân công tự động cho toàn tuần: nhân viên chỉ định luôn được xếp trước (bỏ qua rule), sau đó ưu tiên nhân viên đăng ký ca → ca ưa thích → số ca ít → đúng giờ. Hiển thị preview trước khi lưu.'}>
            <span>
              <Button
                variant="outlined"
                color="info"
                onClick={handleAutoAssign}
                disabled={bulkStaffIds.length === 0 && !hasAnyDesignation}
                startIcon={<Iconify icon="eva:flash-fill" />}
              >
                Phân công tự động
              </Button>
            </span>
          </Tooltip>
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

      {/* Bulk assign confirmation: some selected slots already have registered staff */}
      <ConfirmDialog
        open={bulkConfirm.value}
        onClose={bulkConfirm.onFalse}
        title="Ca đã có nhân viên đăng ký"
        content={
          <Stack spacing={1}>
            <Typography variant="body2">
              {bulkSelectedRegisteredSlots.length} ca bạn đang phân công đã có nhân viên đăng ký
              {bulkOverwrite
                ? '. Bật "Ghi đè" sẽ gỡ những nhân viên chưa được chọn khỏi các ca này (trừ người đã chấm công).'
                : '. Bạn vẫn muốn tiếp tục phân công?'}
            </Typography>
            <Box
              sx={{
                maxHeight: 200,
                overflowY: 'auto',
                bgcolor: 'background.neutral',
                borderRadius: 1,
                p: 1.5,
              }}
            >
              {bulkSelectedRegisteredSlots.map((slot) => (
                <Typography key={`${slot.scheduleId}_${slot.date}`} variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                  • <b>{slot.shiftName}</b> ({slot.date}): {slot.staffNames.join(', ')}
                </Typography>
              ))}
            </Box>
          </Stack>
        }
        action={
          <LoadingButton variant="contained" color="warning" loading={bulkAssigning} onClick={doBulkAssign}>
            Tiếp tục phân công
          </LoadingButton>
        }
      />

      {/* Popover cấu hình ca — chuột phải vào ô ca để chỉ định / ngoại trừ nhân viên */}
      <Popover
        open={Boolean(exclusionAnchor)}
        anchorEl={exclusionAnchor?.el}
        onClose={() => setExclusionAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { p: 1.5, minWidth: 280, maxWidth: 340 } }}
      >
        {exclusionAnchor && (
          <>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="subtitle2" noWrap>
                {exclusionAnchor.scheduleName}
              </Typography>
              <Typography variant="caption" color="text.secondary">{exclusionAnchor.date}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.4 }}>
              <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>📌 Chỉ định</Box>: luôn xếp NV vào ca này (không bị ảnh hưởng bởi rule chọn) ·{' '}
              <Box component="span" sx={{ color: 'error.main', fontWeight: 600 }}>🚫 Ngoại trừ</Box>: không xếp
            </Typography>
            {(() => {
              // Cảnh báo: đang chỉ định vào ca đã có nhân viên chấm công (sẽ bị ghi đè khi phân công tự động)
              const designatedThisSlot = designationMap[exclusionAnchor.slotKey] || [];
              const attendance = bulkSlotAttendanceMap.get(exclusionAnchor.slotKey) || [];
              const atRisk = attendance.filter((s) => !designatedThisSlot.includes(s.staffId));
              if (designatedThisSlot.length === 0 || atRisk.length === 0) return null;
              return (
                <Alert
                  severity="warning"
                  icon={<Iconify icon="solar:danger-triangle-bold" width={18} />}
                  sx={{ mb: 1, py: 0.5, '& .MuiAlert-message': { fontSize: 12, py: 0.25 } }}
                >
                  Ca này đã có {atRisk.length} nhân viên chấm công:{' '}
                  {atRisk.map((s) => `${s.staffName} (${s.checkedOut ? 'đã check-out' : 'đã check-in'})`).join(', ')}.
                  Chỉ định / ghi đè có thể gỡ phân công của họ.
                </Alert>
              );
            })()}
            <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
              {users.map((u) => {
                const isDesignated = (designationMap[exclusionAnchor.slotKey] || []).includes(u.id);
                const isExcluded = (exclusionMap[exclusionAnchor.slotKey] || []).includes(u.id);
                return (
                  <Stack key={u.id} direction="row" alignItems="center" spacing={0.5} sx={{ py: 0.25 }}>
                    <Typography variant="body2" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                      {u.fullName}
                    </Typography>
                    <Tooltip title="Chỉ định — luôn xếp vào ca này" arrow>
                      <IconButton
                        size="small"
                        onClick={() => toggleDesignation(exclusionAnchor.slotKey, u.id)}
                        sx={{ p: 0.25, color: isDesignated ? 'primary.main' : 'text.disabled' }}
                      >
                        <Iconify icon={isDesignated ? 'solar:pin-bold' : 'solar:pin-linear'} width={18} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Ngoại trừ — không xếp vào ca này" arrow>
                      <IconButton
                        size="small"
                        onClick={() => toggleExclusion(exclusionAnchor.slotKey, u.id)}
                        sx={{ p: 0.25, color: isExcluded ? 'error.main' : 'text.disabled' }}
                      >
                        <Iconify icon={isExcluded ? 'solar:forbidden-circle-bold' : 'solar:forbidden-circle-linear'} width={18} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                );
              })}
            </Box>
            {((designationMap[exclusionAnchor.slotKey]?.length ?? 0) > 0 ||
              (exclusionMap[exclusionAnchor.slotKey]?.length ?? 0) > 0) && (
              <Button
                size="small"
                color="inherit"
                sx={{ mt: 1 }}
                onClick={() => {
                  setDesignationMap((prev) => ({ ...prev, [exclusionAnchor.slotKey]: [] }));
                  setExclusionMap((prev) => ({ ...prev, [exclusionAnchor.slotKey]: [] }));
                }}
              >
                Xoá tất cả cấu hình ca này
              </Button>
            )}
          </>
        )}
      </Popover>

      {/* Auto-assign preview dialog — week calendar grid */}
      <Dialog open={autoAssignDialog.value} onClose={autoAssignDialog.onFalse} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6">Xem trước Phân công tự động</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Tuần{' '}
            {bulkWeekStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
            {' — '}
            {(() => {
              const end = new Date(bulkWeekStart);
              end.setDate(end.getDate() + 6);
              return end.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            })()}
            {' · '}
            Chỉ phân công cho {bulkStaffIds.length} nhân viên đã chọn
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1.5 }}>
          {/* Legend */}
          <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 0.5 }}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary">Đăng ký ca</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary">Chỉ định</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.light', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>Bị ghi đè</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Iconify icon="eva:slash-outline" width={10} sx={{ color: 'error.main' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>Ngoại trừ (bất khả kháng)</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">✓ giữ nguyên · tối đa 2 người/ca</Typography>
          </Stack>

          {/* 7-column grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
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
                  sx={{ textAlign: 'center', pb: 1, borderBottom: '1px solid', borderColor: 'divider', mb: 0.5 }}
                >
                  <Typography variant="caption" color={isToday ? 'primary.main' : 'text.secondary'} display="block">
                    {DAY_NAMES[d.getDay()]}
                  </Typography>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      width: 26, height: 26, mx: 'auto', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
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

            {/* Slot cells per day */}
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(bulkWeekStart);
              d.setDate(d.getDate() + i);
              const dateStr = toLocalDateStr(d);
              const daySlots = autoAssignSlots.filter((s) => s.date === dateStr);
              return (
                <Box key={dateStr} sx={{ minHeight: 80 }}>
                  {daySlots.map((slot) => (
                    <Box
                      key={slot.scheduleId}
                      sx={{
                        mb: 0.5, p: 0.75, borderRadius: 1,
                        border: '2px solid', borderColor: slot.color,
                        bgcolor: alpha(slot.color, 0.07),
                      }}
                    >
                      <Typography variant="caption" fontWeight={600} noWrap sx={{ color: slot.color, display: 'block' }}>
                        {slot.scheduleName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mb: 0.25 }}>
                        {slot.startTime}–{slot.endTime}
                      </Typography>
                      {/* Nhân viên bị ngoại trừ (bất khả kháng) */}
                      {(exclusionMap[`${slot.scheduleId}_${slot.date}`] || []).map((id) => (
                        <Stack key={`excl_${id}`} direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                          <Iconify icon="eva:slash-outline" width={10} sx={{ color: 'error.main', flexShrink: 0 }} />
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ fontSize: 10, lineHeight: 1.3, color: 'error.main', fontStyle: 'italic' }}
                          >
                            {staffInfoMap.get(id)?.name || id}
                          </Typography>
                        </Stack>
                      ))}
                      {/* Nhân viên bị gỡ khi ghi đè (đã phân công nhưng không nằm trong đề xuất) */}
                      {slot.existingStaffIds
                        .filter((id) => !slot.proposedStaffIds.includes(id))
                        .map((id) => (
                          <Stack key={id} direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, bgcolor: 'error.light' }} />
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{ fontSize: 10, lineHeight: 1.3, color: 'error.main', textDecoration: 'line-through' }}
                            >
                              {staffInfoMap.get(id)?.name || id}
                            </Typography>
                          </Stack>
                        ))}
                      {/* Nhân viên trong đề xuất cuối cùng (tối đa 2) */}
                      {slot.proposedStaffIds.map((id) => {
                        const isRegistered = slot.registeredStaffIds.has(id);
                        const isKept = slot.existingStaffIds.includes(id);
                        return (
                          <Stack key={id} direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, bgcolor: isRegistered ? 'success.main' : 'warning.main' }} />
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{ fontSize: 10, lineHeight: 1.3, color: isRegistered ? 'success.dark' : 'warning.dark' }}
                            >
                              {staffInfoMap.get(id)?.name || id}
                              {isKept && ' ✓'}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Box>
                  ))}
                  {daySlots.length === 0 && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', pt: 2 }}>
                      —
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Chart: số ca mỗi nhân viên sau phân công — xem phân bổ */}
          {autoAssignChartData.categories.length > 0 && (
            <Box sx={{ mt: 2.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Phân bổ số ca mỗi nhân viên trong tuần
              </Typography>
              <Chart
                type="bar"
                series={[{ name: 'Số ca', data: autoAssignChartData.series }]}
                options={{
                  chart: { toolbar: { show: false }, zoom: { enabled: false } },
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%' } },
                  xaxis: {
                    categories: autoAssignChartData.categories,
                    labels: { style: { fontSize: '11px' } },
                  },
                  yaxis: { labels: { style: { fontSize: '12px' } } },
                  tooltip: { y: { formatter: (val: number) => `${val} ca` } },
                  dataLabels: { enabled: true, style: { fontSize: '11px' } },
                  colors: [theme.palette.info.main],
                  grid: { borderColor: theme.palette.divider, strokeDashArray: 3 },
                }}
                height={Math.max(180, autoAssignChartData.categories.length * 36)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={autoAssignDialog.onFalse}>
            Huỷ
          </Button>
          <Button
            variant="outlined"
            color="info"
            onClick={handleRegenerateAutoAssign}
            startIcon={<Iconify icon="eva:refresh-fill" />}
          >
            Gợi ý lại
          </Button>
          <LoadingButton
            variant="contained"
            loading={autoAssigning}
            onClick={doAutoAssign}
            startIcon={<Iconify icon="eva:checkmark-circle-2-fill" />}
          >
            Xác nhận phân công
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
              <TextField
                label="Ngày đổi đến"
                type="date"
                value={swapTargetDate}
                onChange={(e) => setSwapTargetDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
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
