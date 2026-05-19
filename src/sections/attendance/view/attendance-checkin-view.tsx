'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';

import { useAuthContext } from 'src/auth/hooks';

import { usePageTours } from 'src/hooks/use-tour';
import type { TourDefinition } from 'src/hooks/use-tour';

import { IShiftAssignment, IAttendanceLog, IBranchLocation } from 'src/types/corecms-api';
import {
  getMySchedule,
  getMyAttendanceLogs,
  getBranchLocations,
  checkIn,
  smartCheckIn,
  smartCheckOut,
} from 'src/api/attendance';
import { checkinFace } from 'src/api/checkinFace';

// ----------------------------------------------------------------------

const GPS_ACCURACY_THRESHOLD = 50;
const GEOFENCE_ENABLE_DELAY_MS = 3000;

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AttendanceCheckinView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [todayAssignments, setTodayAssignments] = useState<IShiftAssignment[]>([]);
  const [todayLogs, setTodayLogs] = useState<IAttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoAccuracy, setGeoAccuracy] = useState<number | null>(null);
  const [geoAddress, setGeoAddress] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [branches, setBranches] = useState<IBranchLocation[]>([]);
  const [nearestBranch, setNearestBranch] = useState<{ name: string; distance: number; radius: number } | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [gpsStableAt, setGpsStableAt] = useState<number | null>(null);
  const gpsReadyForCheckin = isWithinGeofence && gpsStableAt !== null && Date.now() - gpsStableAt >= GEOFENCE_ENABLE_DELAY_MS;

  const watchIdRef = useRef<number | null>(null);

  const [faceDialogOpen, setFaceDialogOpen] = useState(false);
  const [pendingCheckin, setPendingCheckin] = useState<{
    mode: 'smart' | 'overtime';
    shiftName?: string;
  } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [shiftTimelineOpen, setShiftTimelineOpen] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [tourMenuAnchor, setTourMenuAnchor] = useState<null | HTMLElement>(null);
  const tourDialogRef = useRef(false);

  const [today] = useState(() => new Date().toISOString());

  // ── GPS ──
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Trình duyệt không hỗ trợ GPS.');
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGeoLocation({ lat: latitude, lng: longitude });
        setGeoAccuracy(accuracy);
        setGeoError(null);
      },
      (error) => {
        setGeoError('Không lấy được vị trí GPS. Kiểm tra quyền trình duyệt.');
        console.error('Geolocation error:', error);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    watchIdRef.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    getBranchLocations()
      .then((data) => {
        const withCoords = data.filter((b: IBranchLocation) => b.latitude != null && b.longitude != null);
        setBranches(withCoords);
      })
      .catch((err) => console.error('Failed to fetch branch locations:', err));
  }, []);

  useEffect(() => {
    if (!geoLocation || branches.length === 0) {
      setNearestBranch(null);
      setIsWithinGeofence(false);
      return;
    }
    const distances = branches
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b) => ({
        name: b.branchName,
        distance: Math.round(getDistanceMeters(geoLocation.lat, geoLocation.lng, b.latitude!, b.longitude!)),
        radius: b.geofenceRadius,
      }));
    const closest = distances.length > 0 ? distances.reduce((a, b) => (a.distance < b.distance ? a : b)) : null;
    setNearestBranch(closest);
    const within = closest ? closest.distance <= closest.radius : false;
    const accuracyOk = !geoAccuracy || geoAccuracy <= GPS_ACCURACY_THRESHOLD;
    setIsWithinGeofence(within && accuracyOk);
  }, [geoLocation, geoAccuracy, branches]);

  useEffect(() => {
    if (isWithinGeofence && gpsStableAt === null) {
      setGpsStableAt(Date.now());
    } else if (!isWithinGeofence) {
      setGpsStableAt(null);
    }
  }, [isWithinGeofence, gpsStableAt]);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (gpsStableAt === null) return undefined;
    const remaining = GEOFENCE_ENABLE_DELAY_MS - (Date.now() - gpsStableAt);
    if (remaining <= 0) return undefined;
    const timer = setTimeout(() => forceUpdate((n) => n + 1), remaining + 50);
    return () => clearTimeout(timer);
  }, [gpsStableAt]);

  useEffect(() => {
    if (!geoLocation) return;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${geoLocation.lat}&lon=${geoLocation.lng}&format=json&addressdetails=1`,
      { headers: { 'User-Agent': 'CoreCms/1.0' } }
    )
      .then((res) => res.json())
      .then((data) => {
        if (isWithinGeofence && nearestBranch) {
          const addr = data?.address;
          const parts = [nearestBranch.name, addr?.road, addr?.city_district, addr?.city, addr?.country].filter(Boolean);
          setGeoAddress(parts.join(', ') || data?.display_name);
        } else if (data?.display_name) {
          setGeoAddress(data.display_name);
        }
      })
      .catch((err) => console.error('Reverse geocode failed:', err));
  }, [geoLocation, isWithinGeofence, nearestBranch]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [assignments, logs] = await Promise.all([
        getMySchedule(today, today),
        getMyAttendanceLogs(today, today),
      ]);
      setTodayAssignments(assignments);
      setTodayLogs(logs);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getLogForAssignment = (assignmentId: string) =>
    todayLogs.find((log) => log.shiftAssignmentId === assignmentId && !log.checkOutTime);

  const getCompletedLogs = (assignmentId: string) =>
    todayLogs.filter((log) => log.shiftAssignmentId === assignmentId);

  const openNonOvertimeLog = useMemo(
    () => todayLogs.find((l) => l.checkInTime && !l.checkOutTime && !l.isOvertime),
    [todayLogs]
  );
  const hasOpenCheckinFromSchedule = useMemo(
    () => todayAssignments.some((a) => a.hasCheckedIn && !a.hasCheckedOut),
    [todayAssignments]
  );
  const isCurrentlyWorking = !!openNonOvertimeLog || hasOpenCheckinFromSchedule;

  const shiftTimeline = useMemo(() => {
    if (todayAssignments.length === 0) return [];
    const sorted = [...todayAssignments].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return sorted.map((assignment, idx) => {
      const logs = getCompletedLogs(assignment.assignmentId);
      const openLog = logs.find((l) => l.checkInTime && !l.checkOutTime);
      const completedLog = logs.find((l) => l.checkInTime && l.checkOutTime);

      let status: 'upcoming' | 'active' | 'completed' | 'auto-transitioned';
      if (completedLog) {
        status = completedLog.isAutoClosedBySystem || completedLog.isAutoOpenedBySystem ? 'auto-transitioned' : 'completed';
      } else if (openLog) {
        status = 'active';
      } else if (assignment.hasCheckedIn && assignment.hasCheckedOut) {
        status = 'completed';
      } else if (assignment.hasCheckedIn && !assignment.hasCheckedOut) {
        status = 'active';
      } else {
        status = 'upcoming';
      }

      return {
        assignment,
        logs,
        openLog,
        completedLog,
        status,
        isConsecutiveWithPrev: idx > 0 && sorted[idx - 1].endTime === assignment.startTime,
        isConsecutiveWithNext: idx < sorted.length - 1 && assignment.endTime === sorted[idx + 1].startTime,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayAssignments, todayLogs]);

  const currentShiftDisplay = useMemo(() => {
    if (!isCurrentlyWorking) return null;
    let checkedInAssignment: IShiftAssignment | undefined;
    if (openNonOvertimeLog) {
      checkedInAssignment = todayAssignments.find((a) => a.assignmentId === openNonOvertimeLog.shiftAssignmentId);
    }
    if (!checkedInAssignment) {
      checkedInAssignment = todayAssignments.find((a) => a.hasCheckedIn && !a.hasCheckedOut);
    }
    if (!checkedInAssignment) return null;

    const sorted = [...todayAssignments].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const startIdx = sorted.findIndex((a) => a.assignmentId === checkedInAssignment!.assignmentId);
    if (startIdx < 0) return null;

    const chain = [sorted[startIdx]];
    for (let i = startIdx + 1; i < sorted.length; i++) {
      if (chain[chain.length - 1].endTime === sorted[i].startTime) {
        chain.push(sorted[i]);
      } else {
        break;
      }
    }

    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    let activeInChain = chain[0];
    for (const shift of chain) {
      if (nowTime >= shift.startTime && nowTime < shift.endTime) {
        activeInChain = shift;
        break;
      }
      if (nowTime >= shift.endTime) {
        activeInChain = shift;
      }
    }

    const lastShift = chain[chain.length - 1];
    return {
      checkedInShift: checkedInAssignment,
      currentShift: activeInChain,
      chain,
      overallStart: chain[0].startTime,
      overallEnd: lastShift.endTime,
      isMultiShift: chain.length > 1,
    };
  }, [isCurrentlyWorking, openNonOvertimeLog, todayAssignments]);

  // ── Camera ──
  const startCamera = useCallback(
    async (mode?: 'user' | 'environment') => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      const useMode = mode ?? facingMode;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: useMode, width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        streamRef.current = stream;
        setCameraActive(true);
        setCapturedImage(null);
      } catch {
        enqueueSnackbar('Không thể mở camera. Vui lòng cấp quyền.', { variant: 'error' });
      }
    },
    [enqueueSnackbar, facingMode]
  );

  const toggleCamera = useCallback(() => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    if (cameraActive) {
      startCamera(newMode);
    }
  }, [facingMode, cameraActive, startCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN');
    const locStr = geoLocation ? `${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)}` : 'N/A';
    const overlayHeight = geoAddress ? 80 : 60;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, canvas.height - overlayHeight, canvas.width, overlayHeight);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText(`⏰ ${timeStr}`, 10, canvas.height - overlayHeight + 18);
    ctx.fillText(`📍 ${locStr}`, 10, canvas.height - overlayHeight + 38);
    if (geoAddress) {
      const truncated = geoAddress.length > 60 ? `${geoAddress.slice(0, 60)}…` : geoAddress;
      ctx.fillText(`🏠 ${truncated}`, 10, canvas.height - overlayHeight + 58);
    }

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageBase64);
    stopCamera();
  }, [geoLocation, geoAddress, facingMode, stopCamera]);

  // ── Dialog ──
  const openFaceDialog = useCallback(
    (mode: 'smart' | 'overtime', shiftName?: string) => {
      setPendingCheckin({ mode, shiftName });
      setFaceDialogOpen(true);
      setCapturedImage(null);
      setTimeout(() => startCamera(), 300);
    },
    [startCamera]
  );

  const closeFaceDialog = useCallback(() => {
    stopCamera();
    setFaceDialogOpen(false);
    setPendingCheckin(null);
    setCapturedImage(null);
  }, [stopCamera]);

  // ── Submit ──
  const handleFaceCheckin = useCallback(async () => {
    if (!capturedImage || !pendingCheckin) return;
    setSubmitting(true);
    setActionLoading(pendingCheckin.mode);
    try {
      const staffName = user?.displayName || user?.name || user?.email || 'N/A';
      await checkinFace({
        candidateName: staffName,
        imageBase64: capturedImage,
        lat: geoLocation?.lat,
        lng: geoLocation?.lng,
        deviceName: navigator.userAgent.slice(0, 80),
        time: new Date().toISOString(),
        branchName: isWithinGeofence ? nearestBranch?.name : undefined,
      });

      if (pendingCheckin.mode === 'overtime') {
        await checkIn({
          isOvertime: true,
          latitude: geoLocation?.lat,
          longitude: geoLocation?.lng,
          accuracy: geoAccuracy ?? undefined,
          faceVerified: true,
        });
      } else {
        await smartCheckIn({
          latitude: geoLocation?.lat,
          longitude: geoLocation?.lng,
          accuracy: geoAccuracy ?? undefined,
          faceVerified: true,
        });
      }

      enqueueSnackbar(
        pendingCheckin.mode === 'overtime' ? 'Check-in ngoài giờ thành công!' : 'Check-in thành công!',
        { variant: 'success' }
      );
      closeFaceDialog();
      fetchData();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Check-in thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSubmitting(false);
      setActionLoading(null);
    }
  }, [capturedImage, pendingCheckin, user, geoLocation, geoAccuracy, isWithinGeofence, nearestBranch, enqueueSnackbar, closeFaceDialog, fetchData]);

  const handleSmartCheckOut = async () => {
    try {
      setActionLoading('checkout');
      await smartCheckOut({
        latitude: geoLocation?.lat,
        longitude: geoLocation?.lng,
        accuracy: geoAccuracy ?? undefined,
        faceVerified: false,
      });
      enqueueSnackbar('Kết thúc làm việc thành công!', { variant: 'success' });
      fetchData();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Check-out thất bại!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(
    () => () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    },
    []
  );

  // ── Tour ──
  const openTourDialog = useCallback(() => {
    tourDialogRef.current = true;
    setFaceDialogOpen(true);
    setCapturedImage(null);
  }, []);

  const closeTourDialog = useCallback(() => {
    if (tourDialogRef.current) {
      tourDialogRef.current = false;
      stopCamera();
      setFaceDialogOpen(false);
      setPendingCheckin(null);
      setCapturedImage(null);
    }
  }, [stopCamera]);

  const CHECKIN_TOURS: TourDefinition[] = useMemo(
    () => [
      {
        tourKey: 'attendance-checkin-overview-v2',
        label: 'Tổng quan Check-in',
        steps: [
          {
            element: '#tour-gps-status',
            popover: {
              title: 'Vị trí & Khu vực cửa hàng',
              description:
                'Hệ thống tự động xác định vị trí GPS của bạn. Bạn chỉ có thể check-in khi đang ở trong phạm vi 100m quanh cửa hàng.',
              side: 'bottom' as const,
              align: 'start' as const,
            },
          },
          {
            element: '#tour-current-time',
            popover: {
              title: 'Thời gian hiện tại',
              description: 'Hiển thị giờ hiện tại. Thời gian check-in/check-out sẽ được ghi nhận chính xác theo giờ server.',
              side: 'bottom' as const,
              align: 'center' as const,
            },
          },
          {
            element: '#tour-shift-list',
            popover: {
              title: 'Danh sách ca làm',
              description:
                'Hiển thị các ca làm hôm nay. Ca liên tiếp sẽ tự động chuyển — bạn chỉ cần check-out ở ca cuối cùng.',
              side: 'top' as const,
              align: 'start' as const,
            },
          },
          {
            element: '#tour-overtime-checkin',
            popover: {
              title: 'Check-in ngoài giờ',
              description: 'Nếu không có ca hoặc cần làm thêm ngoài giờ, nhấn nút này.',
              side: 'top' as const,
              align: 'start' as const,
            },
          },
        ],
      },
      {
        tourKey: 'attendance-checkin-face-v2',
        label: 'Chụp ảnh Check-in',
        steps: [
          {
            element: '#tour-face-dialog',
            popover: {
              title: 'Cửa sổ chụp ảnh',
              description: 'Khi nhấn "Bắt đầu làm việc", cửa sổ này sẽ mở ra. Camera sẽ tự bật.',
              side: 'top' as const,
              align: 'center' as const,
            },
            onHighlightStarted: () => {
              openTourDialog();
            },
          },
          {
            element: '#tour-camera-view',
            popover: {
              title: 'Khung camera',
              description: 'Hướng camera về phía khuôn mặt. Ảnh chụp sẽ kèm thời gian và toạ độ GPS.',
              side: 'top' as const,
              align: 'center' as const,
            },
          },
          {
            element: '#tour-capture-btn',
            popover: {
              title: 'Chụp ảnh',
              description: 'Nhấn "Chụp ảnh" để chụp. Nhấn 🔄 để đổi camera trước/sau.',
              side: 'top' as const,
              align: 'center' as const,
            },
          },
          {
            element: '#tour-confirm-btn',
            popover: {
              title: 'Xác nhận Check-in',
              description: 'Sau khi chụp ảnh, xem lại và nhấn "Xác nhận Check-in". Nếu chưa rõ, nhấn "Chụp lại".',
              side: 'top' as const,
              align: 'end' as const,
            },
            onDeselected: () => {
              closeTourDialog();
            },
          },
        ],
      },
      {
        tourKey: 'attendance-checkin-schedule-v2',
        label: 'Lịch làm & Ca liên tiếp',
        steps: [
          {
            element: '#tour-my-schedule-btn',
            popover: {
              title: 'Xem lịch làm cá nhân',
              description: 'Nhấn vào đây để xem toàn bộ lịch làm trong tuần/tháng.',
              side: 'bottom' as const,
              align: 'end' as const,
            },
          },
          {
            popover: {
              title: 'Hoàn thành hướng dẫn! 🎉',
              description:
                'Check-in yêu cầu ở gần cửa hàng (≤100m). Ca liên tiếp tự chuyển — chỉ checkout ca cuối. Nhấn ❓ bất kỳ lúc nào để xem lại.',
            },
          },
        ],
      },
    ],
    [openTourDialog, closeTourDialog]
  );

  const { startTour, resetAndRestartAll, completedMap, tours: tourList } = usePageTours({ tours: CHECKIN_TOURS });

  // ── GPS chip label ──
  const gpsChipLabel = (() => {
    if (!geoLocation) return 'Đang lấy GPS...';
    if (nearestBranch) {
      return `${nearestBranch.name} · ${nearestBranch.distance}m ${isWithinGeofence ? '✅' : '❌'}`;
    }
    return `${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)}${geoAccuracy != null ? ` ±${Math.round(geoAccuracy)}m` : ''}`;
  })();

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Check In / Check Out"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Attendance' },
          { name: 'Check In/Out' },
        ]}
        action={
          <>
            <Tooltip title="Hướng dẫn sử dụng">
              <IconButton onClick={(e) => setTourMenuAnchor(e.currentTarget)}>
                <Iconify icon="solar:question-circle-bold" width={24} />
              </IconButton>
            </Tooltip>
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
            <Button
              id="tour-my-schedule-btn"
              variant="outlined"
              startIcon={<Iconify icon="mdi:calendar-account" />}
              onClick={() => router.push(paths.dashboard.attendance.mySchedule)}
            >
              Lịch làm cá nhân
            </Button>
          </>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {/* GPS error banner */}
      {geoError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {geoError}
        </Alert>
      )}

      {/* ── Info bar: Date + GPS chip ── */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ mb: 3 }}
      >
        <Box id="tour-current-time">
          <Typography variant="h5" fontWeight="bold" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            <CurrentTime />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date().toLocaleDateString('vi-VN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Typography>
        </Box>

        <Chip
          id="tour-gps-status"
          icon={<Iconify icon="mdi:map-marker" width={16} />}
          label={gpsChipLabel}
          color={!geoLocation ? 'default' : isWithinGeofence ? 'success' : 'warning'}
          variant="soft"
          sx={{ fontWeight: 500, maxWidth: 340 }}
        />
      </Stack>

      {loading && (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      )}

      {!loading && (
        <Stack spacing={2.5}>
          {/* ── Main hero card (split: working / not working) ── */}
          {isCurrentlyWorking && currentShiftDisplay ? (
            /* WORKING state */
            <Card
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #00A76F 0%, #007867 100%)',
                color: '#fff',
                boxShadow: '0 8px 32px rgba(0,167,111,0.25)',
              }}
            >
              <Box sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: '#fff',
                      animation: 'pulseGreen 2s infinite',
                      '@keyframes pulseGreen': {
                        '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                        '50%': { opacity: 0.5, transform: 'scale(1.4)' },
                      },
                    }}
                  />
                  <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.85)', letterSpacing: 2 }}>
                    ĐANG LÀM VIỆC
                  </Typography>
                </Stack>

                <Typography
                  variant="h2"
                  fontWeight="bold"
                  sx={{ fontVariantNumeric: 'tabular-nums', mb: 1, fontSize: { xs: '2.5rem', md: '3rem' } }}
                >
                  {openNonOvertimeLog?.checkInTime ? (
                    <ElapsedTimer from={openNonOvertimeLog.checkInTime} />
                  ) : (
                    '--:--:--'
                  )}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mb: 2 }}>
                  thời gian đã làm
                </Typography>

                <Typography variant="body1" sx={{ opacity: 0.9, mb: 0.5 }}>
                  Ca:{' '}
                  <strong>
                    {currentShiftDisplay.currentShift.shiftName || currentShiftDisplay.currentShift.scheduleName}
                  </strong>
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.75, mb: 3 }}>
                  {currentShiftDisplay.currentShift.startTime} → {currentShiftDisplay.currentShift.endTime}
                  {currentShiftDisplay.isMultiShift &&
                    ` · chuỗi đến ${currentShiftDisplay.overallEnd} (${currentShiftDisplay.chain.length} ca)`}
                </Typography>

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleSmartCheckOut}
                  disabled={!!actionLoading}
                  startIcon={
                    actionLoading === 'checkout' ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <Iconify icon="mdi:logout" />
                    )
                  }
                  sx={{
                    bgcolor: '#FF5630',
                    '&:hover': { bgcolor: '#B71D18' },
                    '&.Mui-disabled': { bgcolor: 'rgba(255,86,48,0.5)', color: '#fff' },
                    py: 1.5,
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: 2,
                    boxShadow: '0 4px 16px rgba(255,86,48,0.4)',
                    color: '#fff',
                  }}
                >
                  Kết thúc làm việc
                </Button>

                {currentShiftDisplay.isMultiShift && (
                  <Typography variant="caption" sx={{ opacity: 0.65, display: 'block', mt: 1 }}>
                    Hệ thống tự ghi nhận chuyển ca cho các ca liên tiếp
                  </Typography>
                )}
              </Box>
            </Card>
          ) : (
            /* NOT WORKING state */
            <Card
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #1976d2 0%, #0D47A1 100%)',
                color: '#fff',
                boxShadow: '0 8px 32px rgba(25,118,210,0.25)',
              }}
            >
              <Box sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
                <Typography
                  variant="overline"
                  sx={{ color: 'rgba(255,255,255,0.8)', letterSpacing: 2, display: 'block', mb: 2 }}
                >
                  SẴN SÀNG LÀM VIỆC
                </Typography>

                <Typography
                  variant="h2"
                  fontWeight="bold"
                  sx={{ fontVariantNumeric: 'tabular-nums', mb: 3, fontSize: { xs: '2.5rem', md: '3rem' } }}
                >
                  <CurrentTime />
                </Typography>

                {todayAssignments.length > 0 && (
                  <Typography variant="body2" sx={{ opacity: 0.8, mb: 3 }}>
                    Hệ thống sẽ tự nhận diện ca phù hợp dựa vào thời gian hiện tại
                  </Typography>
                )}

                <Tooltip
                  title={
                    branches.length > 0 && !gpsReadyForCheckin
                      ? 'Bạn chưa ở trong phạm vi cửa hàng hoặc GPS chưa ổn định'
                      : ''
                  }
                >
                  <span>
                    <Button
                      variant="contained"
                      size="large"
                      fullWidth
                      onClick={() => openFaceDialog('smart')}
                      disabled={!!actionLoading || (branches.length > 0 && !gpsReadyForCheckin)}
                      startIcon={
                        actionLoading === 'smart' ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          <Iconify icon="mdi:camera" />
                        )
                      }
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.15)',
                        border: '2px solid rgba(255,255,255,0.5)',
                        backdropFilter: 'blur(8px)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
                        '&.Mui-disabled': { opacity: 0.45, bgcolor: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' },
                        py: 1.5,
                        fontSize: 16,
                        fontWeight: 700,
                        borderRadius: 2,
                        color: '#fff',
                      }}
                    >
                      Chụp ảnh & Bắt đầu làm việc
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Card>
          )}

          {/* ── Shift timeline (collapsible) ── */}
          {todayAssignments.length > 0 && (
            <Card id="tour-shift-list" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                onClick={() => setShiftTimelineOpen((o) => !o)}
                sx={{ px: 2.5, py: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Iconify icon="mdi:calendar-clock" width={20} color="text.secondary" />
                  <Typography variant="subtitle2">Lịch ca hôm nay</Typography>
                  <Chip size="small" label={`${todayAssignments.length} ca`} variant="soft" />
                </Stack>
                <Iconify icon={shiftTimelineOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'} width={20} />
              </Stack>

              <Collapse in={shiftTimelineOpen}>
                <Divider />
                <Stack spacing={0} sx={{ px: 2, pb: 2, pt: 1 }}>
                  {shiftTimeline.map((item) => {
                    const { assignment, status, isConsecutiveWithPrev, logs } = item;
                    const statusConfig = {
                      upcoming: { color: 'default' as const, label: 'Sắp tới' },
                      active: { color: 'success' as const, label: 'Đang làm' },
                      completed: { color: 'info' as const, label: 'Hoàn thành' },
                      'auto-transitioned': { color: 'warning' as const, label: 'Tự động' },
                    }[status];

                    const isActiveInChain =
                      isCurrentlyWorking &&
                      currentShiftDisplay?.currentShift.assignmentId === assignment.assignmentId;

                    return (
                      <Box key={assignment.id}>
                        {isConsecutiveWithPrev && (
                          <Stack direction="row" alignItems="center" sx={{ pl: 2, py: 0.5 }}>
                            <Box sx={{ width: 2, height: 16, bgcolor: 'warning.main', ml: '7px' }} />
                            <Typography variant="caption" color="warning.main" sx={{ ml: 1 }}>
                              liên tiếp
                            </Typography>
                          </Stack>
                        )}
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={2}
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            bgcolor: isActiveInChain ? 'success.lighter' : 'transparent',
                            border: isActiveInChain ? '1px solid' : 'none',
                            borderColor: 'success.light',
                          }}
                        >
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              flexShrink: 0,
                              bgcolor:
                                status === 'active' || isActiveInChain
                                  ? 'success.main'
                                  : status === 'completed'
                                  ? 'info.main'
                                  : status === 'auto-transitioned'
                                  ? 'warning.main'
                                  : 'grey.400',
                            }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2">
                              {assignment.shiftName || assignment.scheduleName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {assignment.startTime} - {assignment.endTime}
                            </Typography>
                          </Box>
                          <Label variant="soft" color={statusConfig.color}>
                            {statusConfig.label}
                          </Label>
                        </Stack>

                        {logs.length > 0 && (
                          <Stack spacing={0.5} sx={{ pl: 5, pb: 1 }}>
                            {logs.map((log) => (
                              <Stack key={log.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Chip
                                  size="small"
                                  label={`Vào: ${log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString('vi-VN') : '-'}`}
                                  color="success"
                                  variant="soft"
                                />
                                <Chip
                                  size="small"
                                  label={`Ra: ${log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString('vi-VN') : 'Đang làm'}`}
                                  color={log.checkOutTime ? 'info' : 'warning'}
                                  variant="soft"
                                />
                                {log.isLate && (
                                  <Chip size="small" label={`Trễ ${log.lateMinutes} phút`} color="error" variant="soft" />
                                )}
                                {log.isAutoClosedBySystem && (
                                  <Chip size="small" label="Tự đóng" color="warning" variant="soft" />
                                )}
                                {log.isAutoOpenedBySystem && (
                                  <Chip size="small" label="Tự mở" color="warning" variant="soft" />
                                )}
                                {log.workedHours != null && log.checkOutTime && (
                                  <Chip size="small" label={`${log.workedHours.toFixed(1)}h`} variant="soft" />
                                )}
                              </Stack>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              </Collapse>
            </Card>
          )}

          {/* No shifts today */}
          {todayAssignments.length === 0 && (
            <Alert severity="info" id="tour-shift-list">
              Hôm nay bạn không có ca làm nào.
            </Alert>
          )}

          {/* ── Overtime check-in ── */}
          <Card id="tour-overtime-checkin" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: 2.5, py: 2, bgcolor: 'warning.lighter' }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: '50%',
                    bgcolor: 'warning.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Iconify icon="mdi:clock-plus-outline" width={20} sx={{ color: '#fff' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="warning.darker">
                    Check-in ngoài giờ
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Làm việc ngoài ca
                  </Typography>
                </Box>
              </Stack>

              <Button
                variant="contained"
                color="warning"
                size="medium"
                startIcon={
                  actionLoading === 'overtime' ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <Iconify icon="mdi:camera" />
                  )
                }
                onClick={() => openFaceDialog('overtime', 'Ngoài giờ')}
                disabled={!!actionLoading || (branches.length > 0 && !gpsReadyForCheckin)}
                sx={{ borderRadius: 2, fontWeight: 600 }}
              >
                Chụp & Check In
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}

      {/* ── Face Capture Dialog ── */}
      <Dialog
        open={faceDialogOpen}
        onClose={tourDialogRef.current ? closeTourDialog : closeFaceDialog}
        fullScreen={isMobile}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: isMobile ? 0 : 3, overflow: 'hidden' },
          id: 'tour-face-dialog',
        }}
      >
        {/* Dark header */}
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'grey.900',
            color: '#fff',
            py: 1.5,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="mdi:camera-account" width={26} />
            <Typography variant="subtitle1" fontWeight={600}>
              {pendingCheckin?.mode === 'overtime' ? 'Check-in ngoài giờ' : 'Bắt đầu làm việc'}
              {pendingCheckin?.shiftName && ` — ${pendingCheckin.shiftName}`}
            </Typography>
          </Stack>
          <IconButton onClick={closeFaceDialog} size="small" sx={{ color: 'grey.400' }}>
            <Iconify icon="mdi:close" />
          </IconButton>
        </DialogTitle>

        {/* Camera / captured image area */}
        <DialogContent
          sx={{ p: 0, bgcolor: 'grey.900', display: 'flex', flexDirection: 'column', minHeight: isMobile ? '70vh' : 480 }}
        >
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {!capturedImage ? (
            <Box sx={{ position: 'relative', flex: 1 }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                id="tour-camera-view"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                }}
              />

              {/* Face oval guide */}
              {cameraActive && (
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
                    pointerEvents: 'none',
                  }}
                >
                  <Box
                    sx={{
                      width: 190,
                      height: 230,
                      borderRadius: '50%',
                      border: '3px solid rgba(255,255,255,0.75)',
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)',
                    }}
                  />
                </Box>
              )}

              {/* Flip camera button (top-right) */}
              {cameraActive && (
                <IconButton
                  onClick={toggleCamera}
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    bgcolor: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
                  }}
                >
                  <Iconify icon="mdi:camera-flip-outline" width={24} />
                </IconButton>
              )}

              {/* Live info overlay (bottom) */}
              {cameraActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    bgcolor: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    px: 2,
                    py: 1,
                  }}
                >
                  <Typography variant="caption" display="block">
                    ⏰ <CurrentTime showDate />
                  </Typography>
                  <Typography variant="caption" display="block">
                    📍{' '}
                    {geoLocation
                      ? `${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)}${geoAccuracy != null ? ` (±${Math.round(geoAccuracy)}m)` : ''}`
                      : 'Đang lấy vị trí...'}
                  </Typography>
                  {nearestBranch && (
                    <Typography variant="caption" display="block" sx={{ opacity: 0.85 }}>
                      🏪 {nearestBranch.name} — {nearestBranch.distance}m
                    </Typography>
                  )}
                  {geoAddress && (
                    <Typography variant="caption" display="block" sx={{ opacity: 0.8 }}>
                      🏠 {geoAddress.length > 60 ? `${geoAddress.slice(0, 60)}…` : geoAddress}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            /* Captured image preview */
            <Box sx={{ position: 'relative', flex: 1 }}>
              <Box
                component="img"
                src={capturedImage}
                alt="Captured face"
                sx={{
                  width: '100%',
                  display: 'block',
                  minHeight: isMobile ? '60vh' : 400,
                  objectFit: 'cover',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  bgcolor: 'success.main',
                  borderRadius: 1.5,
                  px: 1.5,
                  py: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Iconify icon="mdi:check-circle" width={16} sx={{ color: '#fff' }} />
                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700 }}>
                  Đã chụp
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>

        {/* Action buttons */}
        <DialogActions sx={{ bgcolor: 'grey.900', p: 2, gap: 1 }}>
          {!capturedImage ? (
            cameraActive ? (
              <>
                <Button
                  onClick={tourDialogRef.current ? closeTourDialog : closeFaceDialog}
                  sx={{ color: 'grey.400' }}
                >
                  Hủy
                </Button>
                <Button
                  id="tour-capture-btn"
                  variant="contained"
                  size="large"
                  color="primary"
                  startIcon={<Iconify icon="mdi:camera" />}
                  onClick={capturePhoto}
                  sx={{ flex: 1, borderRadius: 2, py: 1.5, fontSize: 15 }}
                >
                  Chụp ảnh
                </Button>
              </>
            ) : (
              <>
                <Button onClick={tourDialogRef.current ? closeTourDialog : closeFaceDialog} sx={{ color: 'grey.400' }}>
                  Hủy
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Iconify icon="mdi:camera" />}
                  onClick={() => startCamera()}
                  sx={{ flex: 1, borderRadius: 2, borderColor: 'grey.600', color: 'grey.300', py: 1.5 }}
                >
                  Mở Camera
                </Button>
              </>
            )
          ) : (
            <>
              <Button
                variant="outlined"
                startIcon={<Iconify icon="mdi:camera-retake" />}
                onClick={() => {
                  setCapturedImage(null);
                  startCamera();
                }}
                sx={{ borderColor: 'grey.600', color: 'grey.300' }}
              >
                Chụp lại
              </Button>
              <Button
                id="tour-confirm-btn"
                variant="contained"
                color="success"
                size="large"
                disabled={submitting}
                startIcon={
                  submitting ? <CircularProgress size={20} color="inherit" /> : <Iconify icon="mdi:check" />
                }
                onClick={handleFaceCheckin}
                sx={{ flex: 1, borderRadius: 2, py: 1.5, fontSize: 15, fontWeight: 700 }}
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận Check-in'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}

// ── Helper: live clock ──
function CurrentTime({ showDate }: { showDate?: boolean }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (showDate) return <>{time.toLocaleString('vi-VN')}</>;
  return <>{time.toLocaleTimeString('vi-VN')}</>;
}

// ── Helper: elapsed timer ──
function ElapsedTimer({ from }: { from: string }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Date.now() - new Date(from).getTime());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [from]);
  return <>{elapsed}</>;
}
