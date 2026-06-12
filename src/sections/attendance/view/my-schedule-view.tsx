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
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Portal from '@mui/material/Portal';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

import { useResponsive } from 'src/hooks/use-responsive';

import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Label from 'src/components/label';

import { IShiftSchedule, IShiftAssignment, IAttendanceLog, IShiftPoolPost, PoolNeedType } from 'src/types/corecms-api';
import { ICalendarEvent, ICalendarView } from 'src/types/calendar';
import { getMySchedule, getMyAttendanceLogs, getShiftSchedulesByDateRange } from 'src/api/attendance';
import { cancelShiftPoolPost, claimShiftPoolPost, createShiftPoolPost, getMyShiftPoolClaims, getMyShiftPoolPosts, getOpenShiftPoolPosts, reviewShiftPoolPost } from 'src/api/shiftPool';
import { useShiftNotificationRefresh } from 'src/hooks/use-shift-notification-refresh';
import { fmtDate, needTypeHex, needTypeLabel, partialCoverSubTypeLabel, partialSideLabel, poolStatusColor, poolStatusLabel, statusHex } from 'src/sections/shift-pool/view/pool-helpers';
import LegendDot from 'src/sections/shift-pool/view/pool-legend';

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

const POOL_POSTED_COLOR = '#FF6F00'; // amber — ca cá nhân đang đăng pool

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
  const { enqueueSnackbar } = useSnackbar();
  const smUp = useResponsive('up', 'sm');
  const calendarRef = useRef<any>(null);

  // visibleRange được cập nhật bởi datesSet callback của FullCalendar
  // → đúng cho mọi view (month / week / list), không dùng monthOffset nữa
  const [visibleRange, setVisibleRange] = useState<{ from: string; to: string }>(
    () => getMonthRange(0)
  );
  const [assignments, setAssignments] = useState<IAssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ICalendarView>(smUp ? 'dayGridMonth' : 'listWeek');
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<IAssignmentWithDetails | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  // Publish-to-pool dialog state
  const [openPublish, setOpenPublish] = useState(false);
  const [needType, setNeedType] = useState<PoolNeedType>('Swap');
  const [partialSubType, setPartialSubType] = useState<'LateArrive' | 'EarlyLeave'>('LateArrive');
  const [partialStart, setPartialStart] = useState('');
  const [partialEnd, setPartialEnd] = useState('');
  const [poolNote, setPoolNote] = useState('');
  const [publishing, setPublishing] = useState(false);

  // Pool overlay state
  const [openPoolPosts, setOpenPoolPosts] = useState<IShiftPoolPost[]>([]);
  const [myPoolPosts, setMyPoolPosts] = useState<IShiftPoolPost[]>([]);
  const [myClaims, setMyClaims] = useState<IShiftPoolPost[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<Set<'personal' | 'open-pool' | 'my-claim'>>(
    new Set(['personal', 'my-claim'])  // open-pool mặc định ẩn
  );
  const [claimTarget, setClaimTarget] = useState<IShiftPoolPost | null>(null);
  const [claimOfferedId, setClaimOfferedId] = useState('');
  const [claimMyAssignments, setClaimMyAssignments] = useState<IShiftAssignment[]>([]);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimDetailTarget, setClaimDetailTarget] = useState<IShiftPoolPost | null>(null);

  // Manage-post dialog (khi click ca amber đang có post active)
  const [openManagePost, setOpenManagePost] = useState(false);
  const [cancellingPost, setCancellingPost] = useState(false);
  // Poster review actions (Duyệt / Từ chối claim)
  const [showRejectNote, setShowRejectNote] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [reviewingPost, setReviewingPost] = useState(false);

  // Tour state
  const [tourMenuAnchor, setTourMenuAnchor] = useState<null | HTMLElement>(null);
  // Sample popup shown by the "Đổi ca & Làm hộ" tour (illustrative only, no real data)
  const [tourDemo, setTourDemo] = useState<null | 'publish' | 'claim' | 'manage'>(null);
  const tourDemoRef = useRef(setTourDemo);
  tourDemoRef.current = setTourDemo;

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduleData, attendanceData, openPosts, myPosts, claims] = await Promise.all([
        getMySchedule(visibleRange.from, visibleRange.to),
        getMyAttendanceLogs(visibleRange.from, visibleRange.to),
        getOpenShiftPoolPosts().catch(() => [] as IShiftPoolPost[]),
        getMyShiftPoolPosts().catch(() => [] as IShiftPoolPost[]),
        getMyShiftPoolClaims().catch(() => [] as IShiftPoolPost[]),
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
      setOpenPoolPosts(openPosts);
      setMyPoolPosts(myPosts);
      setMyClaims(claims);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoading(false);
    }
  }, [visibleRange.from, visibleRange.to]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Auto-refresh calendar khi có thao tác ca liên quan đến bản thân (SignalR)
  useShiftNotificationRefresh(fetchSchedule);

  // Set of my assignment IDs currently locked as offered in a WaitingApproval claim
  const lockedAsOfferedIds = useMemo(
    () =>
      new Set(
        myClaims
          .filter((c) => c.status === 'WaitingApproval' && c.claimerOfferedAssignmentId)
          .map((c) => c.claimerOfferedAssignmentId!)
      ),
    [myClaims]
  );

  // Map of active pool posts keyed by shiftAssignmentId (for amber colour)
  const postedMap = useMemo(
    () =>
      new Map(
        myPoolPosts
          .filter((p) => p.status === 'Open' || p.status === 'WaitingApproval')
          .map((p) => [p.shiftAssignmentId, p])
      ),
    [myPoolPosts]
  );

  // Open posts from others, filtered to current month
  const filteredOpenPosts = useMemo(
    () =>
      openPoolPosts.filter(
        (p) => p.shiftDate >= visibleRange.from && p.shiftDate <= visibleRange.to
      ),
    [openPoolPosts, visibleRange.from, visibleRange.to]
  );

  // Chỉ WaitingApproval claims hiện trên calendar dạng tentative.
  // Approved đã được phản ánh vào Layer A (StaffId đã cập nhật sau khi duyệt).
  const filteredMyClaims = useMemo(
    () =>
      myClaims.filter(
        (p) =>
          p.shiftDate >= visibleRange.from &&
          p.shiftDate <= visibleRange.to &&
          p.status === 'WaitingApproval'
      ),
    [myClaims, visibleRange.from, visibleRange.to]
  );

  // PartialCover Approved (tôi là poster): badge "đang được làm hộ X giờ" trên Layer A
  const approvedPartialCoverMap = useMemo(
    () =>
      new Map(
        myPoolPosts
          .filter((p) => p.status === 'Approved' && p.needType === 'PartialCover')
          .map((p) => [p.shiftAssignmentId, p])
      ),
    [myPoolPosts]
  );

  // Toàn bộ hoạt động pool tháng này (cả poster lẫn claimer) để hiện lịch sử
  const historyItems = useMemo(() => {
    const posterItems = myPoolPosts
      .filter((p) => p.shiftDate >= visibleRange.from && p.shiftDate <= visibleRange.to)
      .map((p) => ({ role: 'poster' as const, post: p }));
    const claimerItems = myClaims
      .filter((p) => p.shiftDate >= visibleRange.from && p.shiftDate <= visibleRange.to)
      .map((p) => ({ role: 'claimer' as const, post: p }));
    return [...posterItems, ...claimerItems].sort((a, b) =>
      b.post.shiftDate.localeCompare(a.post.shiftDate)
    );
  }, [myPoolPosts, myClaims, visibleRange.from, visibleRange.to]);

  // 3-layer calendar events
  const allEvents = useMemo(() => {
    const layerA = visibleLayers.has('personal')
      ? assignments.map((a) => ({
          ...transformAssignmentToEvent(a),
          id: `personal-${a.assignmentId}`,
          color: postedMap.has(a.assignmentId) ? POOL_POSTED_COLOR : getEventColor(a),
          extendedProps: {
            layerType: 'personal' as const,
            assignmentId: a.assignmentId,
            hasActivePost: postedMap.has(a.assignmentId),
            partialCoverPost: approvedPartialCoverMap.get(a.assignmentId) ?? null,
          },
        }))
      : [];

    const layerB = visibleLayers.has('open-pool')
      ? filteredOpenPosts.map((p) => ({
          id: `pool-${p.id}`,
          title: `🔄 ${needTypeLabel(p.needType)} · ${p.posterName}`,
          start: new Date(`${p.shiftDate}T${p.shiftStartTime}`).getTime(),
          end: new Date(`${p.shiftDate}T${p.shiftEndTime}`).getTime(),
          allDay: false,
          color: needTypeHex(p.needType),
          description: p.note || '',
          extendedProps: { layerType: 'open-pool' as const, post: p },
        }))
      : [];

    // Layer C: chỉ WaitingApproval, hiện dạng tentative (mờ + viền nét đứt)
    const TENTATIVE_COLOR = '#7986cb'; // indigo nhạt cho ca chờ duyệt
    const layerC = visibleLayers.has('my-claim')
      ? filteredMyClaims.map((p) => ({
          id: `claim-${p.id}`,
          title: `⏳ ${needTypeLabel(p.needType)} · ${p.shiftName}`,
          start: new Date(`${p.shiftDate}T${p.shiftStartTime}`).getTime(),
          end: new Date(`${p.shiftDate}T${p.shiftEndTime}`).getTime(),
          allDay: false,
          backgroundColor: `${TENTATIVE_COLOR}55`,
          borderColor: TENTATIVE_COLOR,
          textColor: TENTATIVE_COLOR,
          description: '',
          extendedProps: { layerType: 'my-claim' as const, post: p, tentative: true },
        }))
      : [];

    return [...layerA, ...layerB, ...layerC];
  }, [assignments, visibleLayers, postedMap, approvedPartialCoverMap, filteredOpenPosts, filteredMyClaims]);

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
      // datesSet sẽ fire và cập nhật visibleRange → fetch tự động
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
      const { layerType, assignmentId, hasActivePost, post } = (arg.event.extendedProps ?? {}) as any;
      if (layerType === 'personal') {
        const assignment = assignments.find((a) => a.assignmentId === assignmentId);
        if (!assignment) return;
        setSelectedEvent(assignment);
        if (hasActivePost && postedMap.has(assignmentId)) {
          // Ca đang có bài đăng pool → mở dialog quản lý post
          setOpenManagePost(true);
        } else {
          setOpenDialog(true);
        }
      } else if (layerType === 'open-pool') {
        setClaimTarget(post);
        setClaimOfferedId('');
        setClaimMyAssignments([]);
      } else if (layerType === 'my-claim') {
        setClaimDetailTarget(post);
      } else {
        // fallback cho events chưa có extendedProps
        const assignment = assignments.find((a) => a.assignmentId === arg.event.id);
        if (assignment) {
          setSelectedEvent(assignment);
          setOpenDialog(true);
        }
      }
    },
    [assignments, postedMap]
  );

  const handleCloseDialog = useCallback(() => {
    setOpenDialog(false);
    setSelectedEvent(null);
  }, []);

  const handleOpenPublish = useCallback(() => {
    if (!selectedEvent) return;
    const shiftStart = (selectedEvent.startTime || selectedEvent.shiftStartTime || '').slice(0, 5);
    setNeedType('Swap');
    setPartialSubType('LateArrive');
    setPartialStart(shiftStart); // "đến muộn": start = đầu ca (cố định)
    setPartialEnd('');            // user chọn giờ đến
    setPoolNote('');
    setOpenPublish(true);
  }, [selectedEvent]);

  /** Khi đổi sub-type PartialCover, auto-fill đầu hoặc cuối ca */
  const handleSubTypeChange = useCallback(
    (sub: 'LateArrive' | 'EarlyLeave') => {
      if (!selectedEvent) return;
      const shiftStart = (selectedEvent.startTime || selectedEvent.shiftStartTime || '').slice(0, 5);
      const shiftEnd = (selectedEvent.endTime || selectedEvent.shiftEndTime || '').slice(0, 5);
      setPartialSubType(sub);
      if (sub === 'LateArrive') {
        setPartialStart(shiftStart); // cố định đầu ca
        setPartialEnd('');           // user chọn giờ đến
      } else {
        setPartialStart('');         // user chọn giờ về
        setPartialEnd(shiftEnd);     // cố định cuối ca
      }
    },
    [selectedEvent]
  );

  const handlePublishSubmit = useCallback(async () => {
    if (!selectedEvent) return;

    // Đổi ca / làm hộ toàn ca: chỉ được trước khi ca bắt đầu
    if (needType !== 'PartialCover') {
      const startHHmm = (selectedEvent.startTime || selectedEvent.shiftStartTime || '00:00').slice(0, 5);
      if (new Date() >= new Date(`${selectedEvent.date}T${startHHmm}:00`)) {
        enqueueSnackbar('Ca đã bắt đầu, chỉ có thể đăng "Làm hộ 1 khoảng thời gian".', {
          variant: 'warning',
        });
        return;
      }
    }

    setPublishing(true);
    try {
      await createShiftPoolPost({
        shiftAssignmentId: selectedEvent.assignmentId || selectedEvent.id,
        needType,
        // Mô hình mới: PartialCover chỉ gửi phía (đi muộn/về sớm). Khoảng giờ
        // được suy ra từ chấm công thực tế khi tính lương.
        partialSide: needType === 'PartialCover' ? partialSubType : undefined,
        note: poolNote || undefined,
      });
      enqueueSnackbar('Đã đăng ca lên pool!', { variant: 'success' });
      setOpenPublish(false);
      setOpenDialog(false);
      setSelectedEvent(null);
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Đăng ca thất bại!', { variant: 'error' });
    } finally {
      setPublishing(false);
    }
  }, [selectedEvent, needType, partialSubType, poolNote, enqueueSnackbar]);

  // Chỉ cho đăng ca lên pool khi chưa check-in, chưa có post active, và không đang dùng làm offered
  const canPublishSelected =
    !!selectedEvent &&
    !selectedEvent.attendanceLog?.checkInTime &&
    !postedMap.has(selectedEvent.assignmentId) &&
    !lockedAsOfferedIds.has(selectedEvent.assignmentId);

  const isLockedAsOffered = !!selectedEvent && lockedAsOfferedIds.has(selectedEvent.assignmentId);

  // Load upcoming assignments for Swap claim (filter out locked-as-offered + already started + target ca)
  useEffect(() => {
    if (!claimTarget || claimTarget.needType !== 'Swap') return;
    const from = new Date().toISOString().split('T')[0];
    const to = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split('T')[0];
    getMySchedule(from, to)
      .then((all) => {
        const now = Date.now();
        const upcoming = all.filter((a) => {
          const dateStr = (a.date ?? '').split('T')[0];
          const start = a.startTime || (a as any).shiftStartTime || '00:00';
          const startMs = new Date(`${dateStr}T${start}`).getTime();
          const aid = a.id || (a as any).assignmentId;
          return (
            startMs > now &&
            aid !== claimTarget.shiftAssignmentId &&
            !lockedAsOfferedIds.has(aid)  // bỏ qua ca đang dùng làm offered trong pending claim khác
          );
        });
        setClaimMyAssignments(upcoming);
      })
      .catch(() => setClaimMyAssignments([]));
  }, [claimTarget, lockedAsOfferedIds]);

  const handleSubmitClaim = useCallback(async () => {
    if (!claimTarget) return;
    if (claimTarget.needType === 'Swap' && !claimOfferedId) return;
    setClaimSubmitting(true);
    try {
      await claimShiftPoolPost(claimTarget.id, {
        offeredAssignmentId: claimTarget.needType === 'Swap' ? claimOfferedId : undefined,
      });
      enqueueSnackbar('Đã nhận ca! Chờ người đăng xác nhận.', { variant: 'success' });
      setClaimTarget(null);
      fetchSchedule();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Nhận ca thất bại!', { variant: 'error' });
    } finally {
      setClaimSubmitting(false);
    }
  }, [claimTarget, claimOfferedId, enqueueSnackbar, fetchSchedule]);

  const closeManagePost = useCallback(() => {
    setOpenManagePost(false);
    setSelectedEvent(null);
    setShowRejectNote(false);
    setRejectNote('');
  }, []);

  const handleApprovePost = useCallback(async () => {
    if (!selectedEvent) return;
    const post = postedMap.get(selectedEvent.assignmentId);
    if (!post) return;
    setReviewingPost(true);
    try {
      await reviewShiftPoolPost(post.id, { action: 'Approve' });
      enqueueSnackbar('Đã duyệt! Ca đã được hoán đổi/làm hộ.', { variant: 'success' });
      closeManagePost();
      fetchSchedule();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Duyệt thất bại!', { variant: 'error' });
    } finally {
      setReviewingPost(false);
    }
  }, [selectedEvent, postedMap, enqueueSnackbar, closeManagePost, fetchSchedule]);

  const handleRejectPost = useCallback(async () => {
    if (!selectedEvent) return;
    const post = postedMap.get(selectedEvent.assignmentId);
    if (!post) return;
    setReviewingPost(true);
    try {
      await reviewShiftPoolPost(post.id, { action: 'RejectClaim', reviewNote: rejectNote || undefined });
      enqueueSnackbar('Đã từ chối claim. Bài đăng quay về trạng thái mở.', { variant: 'info' });
      closeManagePost();
      fetchSchedule();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Từ chối thất bại!', { variant: 'error' });
    } finally {
      setReviewingPost(false);
    }
  }, [selectedEvent, postedMap, rejectNote, enqueueSnackbar, closeManagePost, fetchSchedule]);

  const handleCancelPost = useCallback(async () => {
    if (!selectedEvent) return;
    const post = postedMap.get(selectedEvent.assignmentId);
    if (!post) return;
    setCancellingPost(true);
    try {
      await cancelShiftPoolPost(post.id);
      enqueueSnackbar('Đã huỷ bài đăng.', { variant: 'success' });
      closeManagePost();
      fetchSchedule();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Huỷ thất bại!', { variant: 'error' });
    } finally {
      setCancellingPost(false);
    }
  }, [selectedEvent, postedMap, enqueueSnackbar, closeManagePost, fetchSchedule]);

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
      {
        tourKey: 'my-schedule-pool-guide',
        label: 'Đổi ca & Làm hộ',
        steps: [
          {
            element: '#tour-layer-chips',
            onHighlightStarted: () => tourDemoRef.current(null),
            popover: {
              title: '🔄 Đổi ca & Làm hộ ngay trên lịch',
              description:
                'Ngay tại lịch cá nhân, bạn có thể đăng ca cần đổi/nhờ làm hộ và nhận ca của người khác. 3 lớp hiển thị:\n\n🟦 Lịch của tôi — ca được phân của bạn\n🔵 Chợ ca — ca người khác đang cần đổi/làm hộ (mặc định ẩn, bật để xem)\n🟣 Ca chờ nhận — ca bạn đã nhận, đang chờ duyệt\n\nNhấn vào từng chip để bật/tắt lớp tương ứng.',
              side: 'bottom' as const,
              align: 'start' as const,
            },
          },
          {
            element: '#tour-layer-chips',
            onHighlightStarted: () => { setTimeout(() => tourDemoRef.current('publish'), 1000); },
            popover: {
              title: '1️⃣ Đăng ca lên Chợ',
              description:
                'Nhấn vào một ca của bạn trên lịch → chọn "Đăng lên pool". Chọn 1 trong 3 loại nhu cầu (xem popup mẫu phía dưới):\n\n• Đổi ca — đổi lấy ca của người nhận\n• Làm hộ cả ca — nhờ người khác làm trọn ca\n• Làm hộ 1 phần — chỉ nhờ một khoảng giờ (đến muộn / về sớm)\n\nSau khi đăng, ca xuất hiện ở Chợ ca cho người khác nhận.',
              side: 'bottom' as const,
              align: 'start' as const,
            },
          },
          {
            element: '#tour-layer-chips',
            onHighlightStarted: () => { setTimeout(() => tourDemoRef.current('claim'), 1000); },
            popover: {
              title: '2️⃣ Nhận / Đổi ca từ Chợ',
              description:
                'Bật lớp "Chợ ca", nhấn vào ca của người khác để mở popup nhận (xem mẫu phía dưới):\n\n• Làm hộ → xác nhận nhận ca, xem phụ cấp (nếu là làm hộ 1 phần)\n• Đổi ca → chọn một ca của bạn để đổi lại\n\nSau khi nhận, ca chuyển sang trạng thái "Chờ duyệt".',
              side: 'bottom' as const,
              align: 'start' as const,
            },
          },
          {
            element: '#tour-layer-chips',
            onHighlightStarted: () => { setTimeout(() => tourDemoRef.current('manage'), 1000); },
            popover: {
              title: '3️⃣ Duyệt người nhận',
              description:
                'Ca bạn đã đăng và có người nhận sẽ hiển thị viền cam. Nhấn vào để mở popup quản lý (xem mẫu phía dưới): bạn có thể Duyệt ngay hoặc Từ chối người nhận, hoặc để Admin/Manager xử lý.\n\nTrạng thái: Đang mở → Chờ duyệt → Đã duyệt.',
              side: 'bottom' as const,
              align: 'start' as const,
            },
          },
          {
            element: '#tour-month-summary',
            onHighlightStarted: () => tourDemoRef.current(null),
            popover: {
              title: 'Hoàn thành! 🎉',
              description:
                'Bạn đã nắm được cách Đổi ca & Làm hộ ngay trên lịch. Lịch sử các lượt đăng/nhận hiển thị bên dưới phần tổng quan tháng. Nhấn ❓ bất kỳ lúc nào để xem lại.',
              side: 'top' as const,
              align: 'start' as const,
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
  } = usePageTours({
    tours: SCHEDULE_TOURS,
    // Mờ nền vừa phải để vẫn đọc được popup mẫu phía trên; dọn popup mẫu khi đóng tour
    driverConfig: {
      overlayOpacity: 0.5,
      onDestroyed: () => tourDemoRef.current(null),
    },
  });

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

              {/* Layer filter chips */}
              <Stack id="tour-layer-chips" direction="row" spacing={1} sx={{ px: 2, pb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                {(
                  [
                    { key: 'personal', label: 'Lịch của tôi', color: '#42A5F5' },
                    { key: 'open-pool', label: 'Chợ ca', color: '#1976d2' },
                    { key: 'my-claim', label: 'Ca chờ nhận', color: '#7986cb' },
                  ] as const
                ).map(({ key, label, color }) => {
                  const active = visibleLayers.has(key);
                  return (
                    <Chip
                      key={key}
                      label={label}
                      size="small"
                      variant={active ? 'filled' : 'outlined'}
                      onClick={() => {
                        setVisibleLayers((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        });
                      }}
                      sx={{
                        borderColor: color,
                        color: active ? '#fff' : color,
                        bgcolor: active ? color : 'transparent',
                        '&:hover': { bgcolor: active ? color : `${color}22` },
                      }}
                    />
                  );
                })}
              </Stack>
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
                events={allEvents as any}
                headerToolbar={false}
                eventClick={handleClickEvent}
                datesSet={(arg) => {
                  // FullCalendar end là exclusive — trừ 1 ngày để thành inclusive
                  const from = arg.startStr.split('T')[0];
                  const endExclusive = new Date(arg.end);
                  endExclusive.setDate(endExclusive.getDate() - 1);
                  const to = endExclusive.toISOString().split('T')[0];
                  setVisibleRange((prev) => (prev.from === from && prev.to === to ? prev : { from, to }));
                }}
                height={smUp ? 720 : 'auto'}
                  plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                  eventContent={(eventInfo) => {
                    const ep = (eventInfo.event.extendedProps ?? {}) as any;
                    const isTentative = ep.tentative === true;
                    let color: string;
                    if (ep.layerType === 'personal') {
                      const assignment = assignments.find((a) => a.assignmentId === ep.assignmentId);
                      color = assignment ? getEventColor(assignment) : '#9E9E9E';
                      if (ep.hasActivePost) color = POOL_POSTED_COLOR;
                    } else {
                      color = eventInfo.event.backgroundColor?.replace(/55$/, '') || '#7986cb';
                    }
                    return (
                      <Box
                        sx={{
                          width: '100%',
                          borderRadius: 1,
                          overflow: 'hidden',
                          fontSize: 12,
                          opacity: isTentative ? 0.75 : 1,
                          border: isTentative ? `1.5px dashed ${color}` : 'none',
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
                          }}
                        >
                          {eventInfo.event.title}
                        </Box>
                        {/* Badge: ca đang được làm hộ 1 phần (PartialCover Approved) */}
                        {ep.layerType === 'personal' && ep.partialCoverPost && (
                          <Box
                            sx={{
                              px: 1,
                              py: 0.25,
                              fontSize: 10,
                              fontWeight: 500,
                              bgcolor: '#ed6c0218',
                              color: '#e65100',
                              borderTop: '1px solid #ed6c0230',
                            }}
                          >
                            🤝 {ep.partialCoverPost.claimerName}
                            {ep.partialCoverPost.coveringHours
                              ? ` · ${ep.partialCoverPost.coveringHours.toFixed(1)}h`
                              : ''}
                          </Box>
                        )}
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

              <Divider sx={{ my: 2 }} />

              {/* Legend */}
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 600 }}>
                Chú thích màu
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ gap: 1.5 }}>
                <LegendDot color="#9E9E9E" label="Chưa chấm công" />
                <LegendDot color="#42A5F5" label="Đã check-in" />
                <LegendDot color="#FFA726" label="Đi muộn" />
                <LegendDot color="#66BB6A" label="Hoàn thành" />
                <LegendDot color={POOL_POSTED_COLOR} label="Đang đăng pool" />
                <LegendDot color="#e65100" label="Có người làm hộ 1 phần" />
                <LegendDot color="#1976d2" label="Chợ ca – Đổi ca (khi bật)" />
                <LegendDot color="#7b1fa2" label="Chợ ca – Làm hộ cả ca (khi bật)" />
                <LegendDot color="#ed6c02" label="Chợ ca – Làm hộ 1 phần (khi bật)" />
                <LegendDot color="#7986cb" label="Ca đang chờ nhận (nét đứt)" />
              </Stack>
            </Card>
          )}

          {/* Lịch sử đổi ca & làm hộ tháng này */}
          {historyItems.length > 0 && (
            <Card sx={{ mt: 3, p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Lịch sử đổi ca & làm hộ
              </Typography>
              <Stack spacing={1.5}>
                {historyItems.map(({ role, post }) => (
                  <Box
                    key={`${role}-${post.id}`}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Label variant="soft" color={role === 'poster' ? 'warning' : 'info'} sx={{ flexShrink: 0 }}>
                      {role === 'poster' ? 'Bạn đăng' : 'Bạn nhận'}
                    </Label>

                    <Label variant="soft" color="default" sx={{ flexShrink: 0 }}>
                      {needTypeLabel(post.needType)}
                    </Label>

                    <Box sx={{ flexGrow: 1, minWidth: 140 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {post.shiftName} · {fmtDate(post.shiftDate)}
                      </Typography>
                      {post.needType === 'PartialCover' && post.partialStartTime && (
                        <Typography variant="caption" color="text.secondary">
                          {post.partialStartTime.slice(0, 5)} – {post.partialEndTime?.slice(0, 5)}
                        </Typography>
                      )}
                      {post.needType === 'Swap' && role === 'claimer' && post.claimerOfferedShiftName && (
                        <Typography variant="caption" color="text.secondary">
                          Đổi lại: {post.claimerOfferedShiftName}
                          {post.claimerOfferedShiftDate ? ` · ${fmtDate(post.claimerOfferedShiftDate)}` : ''}
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ minWidth: 90 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {role === 'poster' ? 'Người nhận' : 'Người đăng'}
                      </Typography>
                      <Typography variant="body2">
                        {role === 'poster' ? (post.claimerName || '—') : post.posterName}
                      </Typography>
                    </Box>

                    {post.extraPayAmount != null && post.extraPayAmount > 0 && (
                      <Typography variant="body2" color="success.main" fontWeight={600} sx={{ flexShrink: 0 }}>
                        +{post.extraPayAmount.toLocaleString('vi-VN')}đ
                      </Typography>
                    )}

                    <Label variant="soft" color={poolStatusColor(post.status)} sx={{ flexShrink: 0 }}>
                      {poolStatusLabel(post.status)}
                    </Label>
                  </Box>
                ))}
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
        <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {canPublishSelected && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="solar:share-bold" />}
              onClick={handleOpenPublish}
            >
              Đăng lên pool (đổi ca / làm hộ)
            </Button>
          )}
          {isLockedAsOffered && (
            <Label variant="soft" color="warning">
              Ca đang dùng để đổi — không thể đăng pool
            </Label>
          )}
          <Button color="inherit" onClick={handleCloseDialog}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manage-post dialog — khi click ca amber đang có bài đăng pool active */}
      {(() => {
        const activePost = selectedEvent ? postedMap.get(selectedEvent.assignmentId) : undefined;
        return (
          <Dialog
            fullWidth
            maxWidth="xs"
            open={openManagePost}
            onClose={closeManagePost}
          >
            <DialogTitle>Bài đăng của bạn</DialogTitle>
            <DialogContent>
              {activePost && selectedEvent && (
                <Stack spacing={2} sx={{ pt: 1 }}>
                  {/* Assignment info */}
                  <Box>
                    <Typography variant="caption" color="text.secondary">Ca</Typography>
                    <Typography variant="subtitle2">
                      {selectedEvent.shiftName} · {new Date(selectedEvent.date).toLocaleDateString('vi-VN')} · {(selectedEvent.startTime || selectedEvent.shiftStartTime || '').slice(0,5)}-{(selectedEvent.endTime || selectedEvent.shiftEndTime || '').slice(0,5)}
                    </Typography>
                  </Box>

                  {/* Post type */}
                  <Box>
                    <Typography variant="caption" color="text.secondary">Loại yêu cầu</Typography>
                    <Typography variant="body2">{needTypeLabel(activePost.needType)}</Typography>
                  </Box>

                  {/* Partial cover: phía (mô hình mới) hoặc khoảng giờ (dữ liệu cũ) */}
                  {activePost.needType === 'PartialCover' && activePost.partialSide && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Loại làm hộ</Typography>
                      <Typography variant="body2">{partialSideLabel(activePost.partialSide)}</Typography>
                      {activePost.actualCoverStart && activePost.actualCoverEnd && (
                        <Typography variant="caption" color="text.secondary">
                          Khoảng đã làm hộ (theo chấm công): {activePost.actualCoverStart} → {activePost.actualCoverEnd}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {activePost.needType === 'PartialCover' && !activePost.partialSide && activePost.partialStartTime && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Khoảng giờ</Typography>
                      <Typography variant="body2">
                        {activePost.partialStartTime.slice(0,5)} – {activePost.partialEndTime?.slice(0,5)}
                        {' · '}{partialCoverSubTypeLabel(activePost.partialStartTime, activePost.partialEndTime, selectedEvent.startTime || selectedEvent.shiftStartTime, selectedEvent.endTime || selectedEvent.shiftEndTime).label}
                      </Typography>
                    </Box>
                  )}

                  {/* Note */}
                  {activePost.note && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Ghi chú</Typography>
                      <Typography variant="body2">{activePost.note}</Typography>
                    </Box>
                  )}

                  {/* Status */}
                  <Box>
                    <Typography variant="caption" color="text.secondary">Trạng thái</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Label variant="soft" color={poolStatusColor(activePost.status)}>
                        {poolStatusLabel(activePost.status)}
                      </Label>
                    </Box>
                  </Box>

                  {/* WaitingApproval: claimer info + poster action */}
                  {activePost.status === 'WaitingApproval' && activePost.claimerName && (
                    <Box sx={{ p: 1.5, bgcolor: 'warning.lighter', borderRadius: 1, border: '1px solid', borderColor: 'warning.light' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Người muốn nhận ca
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>{activePost.claimerName}</Typography>
                      {activePost.needType === 'Swap' && activePost.claimerOfferedShiftName && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Đổi lại: {activePost.claimerOfferedShiftName}
                          {activePost.claimerOfferedShiftDate ? ` · ${fmtDate(activePost.claimerOfferedShiftDate)}` : ''}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Bạn có thể duyệt ngay hoặc để Admin/Manager xử lý
                      </Typography>
                    </Box>
                  )}

                  {/* Reject note input (hiện khi bấm Từ chối) */}
                  {activePost.status === 'WaitingApproval' && showRejectNote && (
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Lý do từ chối (tuỳ chọn)"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      autoFocus
                    />
                  )}

                  {/* Rejected note nếu có */}
                  {activePost.lastClaimRejectedNote && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Lý do từ chối lần trước</Typography>
                      <Typography variant="body2" color="error.main">{activePost.lastClaimRejectedNote}</Typography>
                    </Box>
                  )}
                </Stack>
              )}
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {/* Open: chỉ có Huỷ bài đăng */}
              {activePost?.status === 'Open' && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleCancelPost}
                  disabled={cancellingPost}
                >
                  {cancellingPost ? 'Đang huỷ...' : 'Huỷ bài đăng'}
                </Button>
              )}

              {/* WaitingApproval: Duyệt + Từ chối (poster có thể tự quyết) */}
              {activePost?.status === 'WaitingApproval' && !showRejectNote && (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleApprovePost}
                    disabled={reviewingPost}
                  >
                    {reviewingPost ? 'Đang duyệt...' : 'Duyệt'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => setShowRejectNote(true)}
                    disabled={reviewingPost}
                  >
                    Từ chối
                  </Button>
                </>
              )}

              {/* Sau khi bấm Từ chối: hiện nút Xác nhận */}
              {activePost?.status === 'WaitingApproval' && showRejectNote && (
                <>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleRejectPost}
                    disabled={reviewingPost}
                  >
                    {reviewingPost ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                  </Button>
                  <Button
                    color="inherit"
                    onClick={() => { setShowRejectNote(false); setRejectNote(''); }}
                    disabled={reviewingPost}
                  >
                    Quay lại
                  </Button>
                </>
              )}

              <Button color="inherit" onClick={closeManagePost}>
                Đóng
              </Button>
            </DialogActions>
          </Dialog>
        );
      })()}

      {/* Claim dialog — khi click vào ca trong Chợ ca */}
      <Dialog fullWidth maxWidth="xs" open={!!claimTarget} onClose={() => setClaimTarget(null)}>
        <DialogTitle>Nhận ca từ Chợ ca</DialogTitle>
        <DialogContent>
          {claimTarget && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Ca</Typography>
                <Typography variant="subtitle2">
                  {claimTarget.shiftName} · {fmtDate(claimTarget.shiftDate)} · {claimTarget.shiftStartTime?.slice(0,5)}-{claimTarget.shiftEndTime?.slice(0,5)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Người đăng</Typography>
                <Typography variant="body2">{claimTarget.posterName}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Loại</Typography>
                <Typography variant="body2">{needTypeLabel(claimTarget.needType)}</Typography>
              </Box>
              {claimTarget.needType === 'PartialCover' && claimTarget.partialSide && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Loại làm hộ</Typography>
                  <Typography variant="body2">{partialSideLabel(claimTarget.partialSide)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {claimTarget.partialSide === 'LateArrive'
                      ? 'Bạn cần có ca liền TRƯỚC ca này. Phụ cấp tính theo giờ thực tế người nhờ đến.'
                      : 'Bạn cần có ca liền SAU ca này. Phụ cấp tính theo giờ thực tế người nhờ về.'}
                  </Typography>
                </Box>
              )}
              {claimTarget.needType === 'PartialCover' && !claimTarget.partialSide && claimTarget.partialStartTime && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Khoảng giờ cần làm hộ</Typography>
                  <Typography variant="body2">
                    {claimTarget.partialStartTime?.slice(0,5)} – {claimTarget.partialEndTime?.slice(0,5)}
                    {' · '}{partialCoverSubTypeLabel(claimTarget.partialStartTime, claimTarget.partialEndTime, claimTarget.shiftStartTime, claimTarget.shiftEndTime).label}
                  </Typography>
                </Box>
              )}
              {claimTarget.note && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Ghi chú</Typography>
                  <Typography variant="body2">{claimTarget.note}</Typography>
                </Box>
              )}
              {claimTarget.needType === 'Swap' && (
                <TextField
                  select
                  fullWidth
                  label="Ca của bạn để đổi lại *"
                  value={claimOfferedId}
                  onChange={(e) => setClaimOfferedId(e.target.value)}
                  helperText="Chọn ca sắp tới của bạn để đưa đổi"
                >
                  {claimMyAssignments.length === 0 ? (
                    <MenuItem disabled value="">Không có ca phù hợp</MenuItem>
                  ) : (
                    claimMyAssignments.map((a) => {
                      const aid = (a as any).assignmentId || a.id;
                      const dateStr = ((a as any).date ?? '').split('T')[0];
                      return (
                        <MenuItem key={aid} value={aid}>
                          {(a as any).shiftName} · {new Date(dateStr).toLocaleDateString('vi-VN')} · {(a.startTime || (a as any).shiftStartTime || '').slice(0,5)}
                        </MenuItem>
                      );
                    })
                  )}
                </TextField>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setClaimTarget(null)}>Huỷ</Button>
          <Button
            variant="contained"
            onClick={handleSubmitClaim}
            disabled={claimSubmitting || (claimTarget?.needType === 'Swap' && !claimOfferedId)}
          >
            {claimSubmitting ? 'Đang nhận...' : 'Nhận ca'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Claim-detail dialog — khi click vào ca tôi nhận */}
      <Dialog fullWidth maxWidth="xs" open={!!claimDetailTarget} onClose={() => setClaimDetailTarget(null)}>
        <DialogTitle>Ca tôi đã nhận</DialogTitle>
        <DialogContent>
          {claimDetailTarget && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Ca</Typography>
                <Typography variant="subtitle2">
                  {claimDetailTarget.shiftName} · {fmtDate(claimDetailTarget.shiftDate)} · {claimDetailTarget.shiftStartTime?.slice(0,5)}-{claimDetailTarget.shiftEndTime?.slice(0,5)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Người đăng</Typography>
                <Typography variant="body2">{claimDetailTarget.posterName}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Loại</Typography>
                <Typography variant="body2">{needTypeLabel(claimDetailTarget.needType)}</Typography>
              </Box>
              {claimDetailTarget.needType === 'PartialCover' && claimDetailTarget.partialStartTime && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Khoảng giờ</Typography>
                  <Typography variant="body2">
                    {claimDetailTarget.partialStartTime?.slice(0,5)} – {claimDetailTarget.partialEndTime?.slice(0,5)}
                  </Typography>
                </Box>
              )}
              {claimDetailTarget.extraPayAmount != null && claimDetailTarget.extraPayAmount > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Phụ cấp</Typography>
                  <Typography variant="body2" color="success.main" fontWeight={600}>
                    +{claimDetailTarget.extraPayAmount.toLocaleString('vi-VN')}đ
                  </Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">Trạng thái</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Label variant="soft" color={poolStatusColor(claimDetailTarget.status)}>
                    {poolStatusLabel(claimDetailTarget.status)}
                  </Label>
                </Box>
              </Box>
              {claimDetailTarget.reviewNote && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Ghi chú duyệt</Typography>
                  <Typography variant="body2">{claimDetailTarget.reviewNote}</Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setClaimDetailTarget(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {/* Publish to pool dialog */}
      <Dialog fullWidth maxWidth="xs" open={openPublish} onClose={() => setOpenPublish(false)}>
        <DialogTitle>Đăng ca lên pool</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {selectedEvent && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Ca
                </Typography>
                <Typography variant="subtitle2">
                  {selectedEvent.shiftName} ·{' '}
                  {new Date(selectedEvent.date).toLocaleDateString('vi-VN')} ·{' '}
                  {(selectedEvent.startTime || selectedEvent.shiftStartTime || '').slice(0, 5)}-
                  {(selectedEvent.endTime || selectedEvent.shiftEndTime || '').slice(0, 5)}
                </Typography>
              </Box>
            )}

            <TextField
              select
              fullWidth
              label="Nhu cầu"
              value={needType}
              onChange={(e) => setNeedType(e.target.value as PoolNeedType)}
            >
              <MenuItem value="Swap">Đổi ca (tìm người đổi ca khác)</MenuItem>
              <MenuItem value="FullCover">Làm hộ cả ca</MenuItem>
              <MenuItem value="PartialCover">Làm hộ 1 khoảng thời gian</MenuItem>
            </TextField>

            {needType === 'PartialCover' && (
              <Stack spacing={2}>
                {/* Sub-type selector */}
                <ToggleButtonGroup
                  value={partialSubType}
                  exclusive
                  onChange={(_, v) => v && handleSubTypeChange(v)}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="LateArrive" sx={{ flex: 1 }}>
                    ⏰ Tôi đến muộn
                  </ToggleButton>
                  <ToggleButton value="EarlyLeave" sx={{ flex: 1 }}>
                    🚪 Tôi về sớm
                  </ToggleButton>
                </ToggleButtonGroup>

                {/* Description hint — không cần nhập giờ, hệ thống tự tính theo chấm công */}
                <Box sx={{ p: 1.5, bgcolor: 'info.lighter', borderRadius: 1, border: '1px solid', borderColor: 'info.light' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {partialSubType === 'LateArrive'
                      ? '⏰ Nhờ nhân sự ca liền TRƯỚC ở lại làm hộ phần đầu ca. Khoảng làm hộ = từ đầu ca đến đúng lúc bạn check-in.'
                      : '🚪 Nhờ nhân sự ca liền SAU đến sớm làm hộ phần cuối ca. Khoảng làm hộ = từ lúc bạn check-out đến hết ca.'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                    Bạn KHÔNG cần nhập giờ — hệ thống tự tính theo giờ check-in/out thực tế và ghi nhận phụ cấp cho người làm hộ.
                  </Typography>
                </Box>
              </Stack>
            )}

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Ghi chú (tuỳ chọn)"
              value={poolNote}
              onChange={(e) => setPoolNote(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setOpenPublish(false)}>
            Huỷ
          </Button>
          <Button
            variant="contained"
            onClick={handlePublishSubmit}
            disabled={publishing || (needType === 'PartialCover' && (!partialStart || !partialEnd))}
          >
            Đăng
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Popup MẪU cho tour "Đổi ca & Làm hộ" (chỉ minh hoạ, không thao tác thật) ── */}
      {tourDemo && (
        <Portal>
          <Paper
            elevation={12}
            sx={{
              position: 'fixed',
              top: 76,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'min(380px, 90vw)',
              maxHeight: '72vh',
              overflowY: 'auto',
              p: 2,
              borderRadius: 2,
              // Overlay driver: z-index 10000 (inline JS); Popover driver: z-index 1_000_000_000 (CSS).
              // Đặt popup mẫu GIỮA hai giá trị này → hiện trên nền tối nhưng để popover tour đè lên trên.
              zIndex: 500_000,
              pointerEvents: 'none',
            }}
          >
            <Box sx={{ mb: 1.5 }}>
              <Label variant="soft" color="info" sx={{ fontWeight: 700, fontSize: 10 }}>
                MẪU HƯỚNG DẪN
              </Label>
            </Box>

            {tourDemo === 'publish' && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>Đăng ca lên Chợ ca</Typography>
                <Box>
                  <Typography variant="caption" color="text.secondary">Ca</Typography>
                  <Typography variant="body2" fontWeight={600}>Ca Sáng · 24/06/2026 · 08:30–12:30</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">Bạn cần gì?</Typography>
                <Stack spacing={1}>
                  {[
                    { t: 'Đổi ca', d: 'Đổi lấy ca của người nhận', c: needTypeHex('Swap'), on: false },
                    { t: 'Làm hộ cả ca', d: 'Nhờ làm trọn ca', c: needTypeHex('FullCover'), on: false },
                    { t: 'Làm hộ 1 phần', d: 'Chỉ nhờ một khoảng giờ', c: needTypeHex('PartialCover'), on: true },
                  ].map((o) => (
                    <Box key={o.t} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, border: '1.5px solid', borderColor: o.on ? o.c : 'divider', bgcolor: o.on ? `${o.c}14` : 'transparent' }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: o.c }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={o.on ? 700 : 500} sx={{ color: o.on ? o.c : 'text.primary' }}>{o.t}</Typography>
                        <Typography variant="caption" color="text.secondary">{o.d}</Typography>
                      </Box>
                      {o.on && <Iconify icon="eva:checkmark-circle-2-fill" sx={{ color: o.c }} />}
                    </Box>
                  ))}
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary">Khoảng giờ làm hộ</Typography>
                  <Typography variant="body2">11:00 – 12:30 · Về sớm</Typography>
                </Box>
                <Button variant="contained" size="small" sx={{ alignSelf: 'flex-end' }}>Đăng</Button>
              </Stack>
            )}

            {tourDemo === 'claim' && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>Nhận ca từ Chợ</Typography>
                <Box>
                  <Typography variant="caption" color="text.secondary">Ca cần đổi</Typography>
                  <Typography variant="body2" fontWeight={600}>Ca Chiều · 24/06/2026 · 12:30–18:00</Typography>
                  <Typography variant="caption" color="text.secondary">Người đăng: Nguyễn Văn A · Loại: Đổi ca</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">Chọn ca của bạn để đổi lại</Typography>
                <Stack spacing={1}>
                  {[
                    { n: 'Ca Sáng · 25/06 · 08:30–12:30', on: true },
                    { n: 'Ca Tối · 26/06 · 18:00–22:00', on: false },
                  ].map((s) => (
                    <Box key={s.n} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, border: '1.5px solid', borderColor: s.on ? 'primary.main' : 'divider', bgcolor: s.on ? 'primary.lighter' : 'transparent' }}>
                      <Typography variant="body2" sx={{ flex: 1 }} fontWeight={s.on ? 700 : 500}>{s.n}</Typography>
                      {s.on && <Iconify icon="eva:checkmark-circle-2-fill" sx={{ color: 'primary.main' }} />}
                    </Box>
                  ))}
                </Stack>
                <Button variant="contained" size="small" sx={{ alignSelf: 'flex-end' }}>Xác nhận nhận ca</Button>
              </Stack>
            )}

            {tourDemo === 'manage' && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>Bài đăng của bạn</Typography>
                <Box>
                  <Typography variant="caption" color="text.secondary">Ca</Typography>
                  <Typography variant="body2" fontWeight={600}>Ca Sáng · 24/06/2026 · 08:30–12:30 · Đổi ca</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Trạng thái</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Label variant="soft" color="warning">Chờ duyệt</Label>
                  </Box>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: 'warning.lighter', borderRadius: 1, border: '1px solid', borderColor: 'warning.light' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Người muốn nhận ca</Typography>
                  <Typography variant="body2" fontWeight={600}>Trần Thị B</Typography>
                  <Typography variant="caption" color="text.secondary">Đổi lại: Ca Chiều · 25/06</Typography>
                </Box>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" color="error" size="small">Từ chối</Button>
                  <Button variant="contained" color="success" size="small">Duyệt</Button>
                </Stack>
              </Stack>
            )}
          </Paper>
        </Portal>
      )}
    </Container>
  );
}
