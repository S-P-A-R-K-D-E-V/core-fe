'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
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

const GPS_ACCURACY_THRESHOLD = 50; // metres — reject if accuracy > this
const GEOFENCE_ENABLE_DELAY_MS = 3000; // anti-fraud: wait 3s before enabling check-in

/** Haversine distance in metres */
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

  const [todayAssignments, setTodayAssignments] = useState<IShiftAssignment[]>([]);
  const [todayLogs, setTodayLogs] = useState<IAttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoAccuracy, setGeoAccuracy] = useState<number | null>(null);
  const [geoAddress, setGeoAddress] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Branch geofencing
  const [branches, setBranches] = useState<IBranchLocation[]>([]);
  const [nearestBranch, setNearestBranch] = useState<{ name: string; distance: number; radius: number } | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [gpsStableAt, setGpsStableAt] = useState<number | null>(null); // timestamp when first valid GPS signal arrived
  const gpsReadyForCheckin = isWithinGeofence && gpsStableAt !== null && Date.now() - gpsStableAt >= GEOFENCE_ENABLE_DELAY_MS;

  const watchIdRef = useRef<number | null>(null);

  // Face capture dialog state
  const [faceDialogOpen, setFaceDialogOpen] = useState(false);
  const [pendingCheckin, setPendingCheckin] = useState<{
    mode: 'smart' | 'overtime';
    shiftName?: string;
  } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Tour state
  const [tourMenuAnchor, setTourMenuAnchor] = useState<null | HTMLElement>(null);
  const tourDialogRef = useRef(false); // flag: dialog opened by tour

  const [today] = useState(() => new Date().toISOString());

  // ── Continuous GPS tracking with watchPosition ──
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

  // Fetch branch locations for geofencing
  useEffect(() => {
    getBranchLocations()
      .then((data) => {
        const withCoords = data.filter((b: IBranchLocation) => b.latitude != null && b.longitude != null);
        setBranches(withCoords);
      })
      .catch((err) => console.error('Failed to fetch branch locations:', err));
  }, []);

  // Calculate distance to nearest branch whenever GPS updates
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

    const closest = distances.length > 0
      ? distances.reduce((a, b) => (a.distance < b.distance ? a : b))
      : null;

    setNearestBranch(closest);
    const within = closest ? closest.distance <= closest.radius : false;
    const accuracyOk = !geoAccuracy || geoAccuracy <= GPS_ACCURACY_THRESHOLD;
    setIsWithinGeofence(within && accuracyOk);
  }, [geoLocation, geoAccuracy, branches]);

  // Anti-fraud: track when GPS first becomes stable + within geofence → start delay timer
  useEffect(() => {
    if (isWithinGeofence && gpsStableAt === null) {
      setGpsStableAt(Date.now());
    } else if (!isWithinGeofence) {
      setGpsStableAt(null);
    }
  }, [isWithinGeofence, gpsStableAt]);

  // Force re-render after GEOFENCE_ENABLE_DELAY_MS to update gpsReadyForCheckin
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (gpsStableAt === null) return undefined;
    const remaining = GEOFENCE_ENABLE_DELAY_MS - (Date.now() - gpsStableAt);
    if (remaining <= 0) return undefined;
    const timer = setTimeout(() => forceUpdate((n) => n + 1), remaining + 50);
    return () => clearTimeout(timer);
  }, [gpsStableAt]);

  // Reverse geocode to get address
  useEffect(() => {
    if (!geoLocation) return;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${geoLocation.lat}&lon=${geoLocation.lng}&format=json&addressdetails=1`,
      { headers: { 'User-Agent': 'CoreCms/1.0' } }
    )
      .then((res) => res.json())
      .then((data) => {
        if (isWithinGeofence && nearestBranch) {
          // Near a branch: use branch name + short address components
          const addr = data?.address;
          const parts = [
            nearestBranch.name,
            addr?.road,
            addr?.city_district,
            addr?.city,
            addr?.country,
          ].filter(Boolean);
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

  // ── Smart shift state ──
  // Detect if employee currently has an open check-in (any non-overtime log without checkout)
  const openNonOvertimeLog = useMemo(
    () => todayLogs.find((l) => l.checkInTime && !l.checkOutTime && !l.isOvertime),
    [todayLogs]
  );
  // Also check schedule-embedded data (hasCheckedIn from my-schedule API)
  const hasOpenCheckinFromSchedule = useMemo(
    () => todayAssignments.some((a) => a.hasCheckedIn && !a.hasCheckedOut),
    [todayAssignments]
  );
  const isCurrentlyWorking = !!openNonOvertimeLog || hasOpenCheckinFromSchedule;

  // Build consecutive chain info for display
  const shiftTimeline = useMemo(() => {
    if (todayAssignments.length === 0) return [];

    const sorted = [...todayAssignments].sort((a, b) => a.startTime.localeCompare(b.startTime));

    return sorted.map((assignment, idx) => {
      const logs = getCompletedLogs(assignment.assignmentId);
      const openLog = logs.find((l) => l.checkInTime && !l.checkOutTime);
      const completedLog = logs.find((l) => l.checkInTime && l.checkOutTime);

      // Determine status from logs first, then fall back to schedule-embedded data
      let status: 'upcoming' | 'active' | 'completed' | 'auto-transitioned';
      if (completedLog) {
        status = completedLog.isAutoClosedBySystem || completedLog.isAutoOpenedBySystem
          ? 'auto-transitioned'
          : 'completed';
      } else if (openLog) {
        status = 'active';
      } else if (assignment.hasCheckedIn && assignment.hasCheckedOut) {
        status = 'completed';
      } else if (assignment.hasCheckedIn && !assignment.hasCheckedOut) {
        status = 'active';
      } else {
        status = 'upcoming';
      }

      // Check if consecutive with previous
      const isConsecutiveWithPrev =
        idx > 0 && sorted[idx - 1].endTime === assignment.startTime;
      // Check if consecutive with next
      const isConsecutiveWithNext =
        idx < sorted.length - 1 && assignment.endTime === sorted[idx + 1].startTime;

      return {
        assignment,
        logs,
        openLog,
        completedLog,
        status,
        isConsecutiveWithPrev,
        isConsecutiveWithNext,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayAssignments, todayLogs]);

  // Determine what shift is "currently active" for display (based on time, for consecutive chain)
  const currentShiftDisplay = useMemo(() => {
    if (!isCurrentlyWorking) return null;

    // Find the assignment that has the open log (from logs API or schedule-embedded data)
    let checkedInAssignment: IShiftAssignment | undefined;
    if (openNonOvertimeLog) {
      checkedInAssignment = todayAssignments.find(
        (a) => a.assignmentId === openNonOvertimeLog.shiftAssignmentId
      );
    }
    // Fallback: use schedule-embedded hasCheckedIn data
    if (!checkedInAssignment) {
      checkedInAssignment = todayAssignments.find(
        (a) => a.hasCheckedIn && !a.hasCheckedOut
      );
    }
    if (!checkedInAssignment) return null;

    // Build consecutive chain starting from checked-in assignment
    const sorted = [...todayAssignments].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const startIdx = sorted.findIndex((a) => a.assignmentId === checkedInAssignment.assignmentId);
    if (startIdx < 0) return null;

    const chain = [sorted[startIdx]];
    for (let i = startIdx + 1; i < sorted.length; i++) {
      if (chain[chain.length - 1].endTime === sorted[i].startTime) {
        chain.push(sorted[i]);
      } else {
        break;
      }
    }

    // Determine which shift in the chain should be "active" based on current time
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    let activeInChain = chain[0]; // default: first shift
    for (const shift of chain) {
      if (nowTime >= shift.startTime && nowTime < shift.endTime) {
        activeInChain = shift;
        break;
      }
      if (nowTime >= shift.endTime) {
        // Past this shift, check next
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

  // ── Camera helpers ──

  const startCamera = useCallback(async (mode?: 'user' | 'environment') => {
    // Stop existing stream first
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
  }, [enqueueSnackbar, facingMode]);

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

    // Flip canvas horizontally for front camera so the saved image is natural
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    // Reset transform before drawing overlay text
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Overlay: time + location + address
    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN');
    const locStr = geoLocation
      ? `${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)}`
      : 'N/A';

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
  }, [geoLocation, geoAddress, stopCamera]);

  // ── Dialog open / close ──

  const openFaceDialog = useCallback(
    (mode: 'smart' | 'overtime', shiftName?: string) => {
      setPendingCheckin({ mode, shiftName });
      setFaceDialogOpen(true);
      setCapturedImage(null);
      // Start camera after dialog renders
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

  // ── Submit: capture face → checkin face API → attendance checkIn API ──

  const handleFaceCheckin = useCallback(async () => {
    if (!capturedImage || !pendingCheckin) return;

    setSubmitting(true);
    setActionLoading(pendingCheckin.mode);

    try {
      const staffName = user?.displayName || user?.name || user?.email || 'N/A';

      // 1) Gửi ảnh khuôn mặt + vị trí + thời gian
      await checkinFace({
        candidateName: staffName,
        imageBase64: capturedImage,
        lat: geoLocation?.lat,
        lng: geoLocation?.lng,
        deviceName: navigator.userAgent.slice(0, 80),
        time: new Date().toISOString(),
        branchName: isWithinGeofence ? nearestBranch?.name : undefined,
      });

      // 2) Check-in
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
        pendingCheckin.mode === 'overtime'
          ? 'Check-in ngoài giờ thành công!'
          : 'Check-in thành công!',
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

  // Cleanup camera on unmount
  useEffect(
    () => () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    },
    []
  );

  // ── Tour definitions ──

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
                'Hệ thống tự động xác định vị trí GPS của bạn. Bạn chỉ có thể check-in khi đang ở trong phạm vi 100m quanh cửa hàng. Nếu có lỗi GPS, hãy kiểm tra quyền trình duyệt hoặc tải lại trang.',
              side: 'bottom' as const,
              align: 'start' as const,
            },
          },
          {
            element: '#tour-current-time',
            popover: {
              title: 'Thời gian hiện tại',
              description:
                'Hiển thị ngày và giờ hiện tại. Thời gian check-in/check-out sẽ được ghi nhận chính xác theo giờ server.',
              side: 'bottom' as const,
              align: 'center' as const,
            },
          },
          {
            element: '#tour-shift-list',
            popover: {
              title: 'Danh sách ca làm',
              description:
                'Hiển thị các ca làm hôm nay. Nếu bạn có nhiều ca liên tiếp, hệ thống sẽ tự động check-out ca trước và check-in ca sau khi chuyển ca — bạn chỉ cần check-out ở ca cuối cùng.',
              side: 'top' as const,
              align: 'start' as const,
            },
          },
          {
            element: '#tour-overtime-checkin',
            popover: {
              title: 'Check-in ngoài giờ',
              description:
                'Nếu bạn không có ca được phân hoặc cần làm thêm ngoài giờ, nhấn nút này để check-in ngoài ca. Yêu cầu phải ở trong phạm vi cửa hàng.',
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
              description:
                'Khi nhấn "Chụp ảnh & Check In", cửa sổ này sẽ mở ra. Camera sẽ tự bật để bạn chụp ảnh xác nhận danh tính.',
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
              description:
                'Hướng camera về phía khuôn mặt. Ảnh chụp sẽ kèm theo thời gian, toạ độ GPS và địa chỉ để xác minh vị trí.',
              side: 'top' as const,
              align: 'center' as const,
            },
          },
          {
            element: '#tour-capture-btn',
            popover: {
              title: 'Chụp ảnh',
              description:
                'Nhấn "Chụp ảnh" để chụp. Bạn có thể nhấn nút lật camera 🔄 bên cạnh để đổi camera trước/sau.',
              side: 'top' as const,
              align: 'center' as const,
            },
          },
          {
            element: '#tour-confirm-btn',
            popover: {
              title: 'Xác nhận Check-in',
              description:
                'Sau khi chụp ảnh, xem lại và nhấn "Xác nhận Check-in" để hoàn tất. Nếu ảnh chưa rõ, nhấn "Chụp lại".',
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
              description:
                'Nhấn vào đây để xem toàn bộ lịch làm việc trong tuần/tháng. Các ca liên tiếp sẽ được hiển thị dạng chuỗi để bạn dễ theo dõi.',
              side: 'bottom' as const,
              align: 'end' as const,
            },
          },
          {
            popover: {
              title: 'Hoàn thành hướng dẫn! 🎉',
              description:
                'Lưu ý: Check-in yêu cầu ở gần cửa hàng (≤100m). Ca liên tiếp sẽ tự chuyển — bạn chỉ checkout ca cuối. Nhấn ❓ bất kỳ lúc nào để xem lại.',
            },
          },
        ],
      },
    ],
    [openTourDialog, closeTourDialog]
  );

  const {
    startTour,
    resetAndRestartAll,
    completedMap,
    tours: tourList,
  } = usePageTours({ tours: CHECKIN_TOURS });

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

      {/* GPS Status */}
      {geoError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {geoError}
        </Alert>
      )}

      {geoLocation && (
        <Alert
          id="tour-gps-status"
          severity={isWithinGeofence ? 'success' : 'warning'}
          sx={{ mb: 2 }}
          icon={<Iconify icon="mdi:map-marker" />}
        >
          <Stack spacing={0.5}>
            <Typography variant="body2">
              GPS: {geoLocation.lat.toFixed(6)}, {geoLocation.lng.toFixed(6)}
              {geoAccuracy != null && ` (±${Math.round(geoAccuracy)}m)`}
            </Typography>
            {geoAccuracy != null && geoAccuracy > GPS_ACCURACY_THRESHOLD && (
              <Typography variant="body2" color="error.main">
                ⚠️ GPS không chính xác (accuracy {'>'}{geoAccuracy}/{GPS_ACCURACY_THRESHOLD}m). Hãy ra nơi thoáng hơn.
              </Typography>
            )}
            {nearestBranch && (
              <Typography variant="body2">
                📍 Cửa hàng gần nhất: <strong>{nearestBranch.name}</strong> — cách{' '}
                <strong>{nearestBranch.distance}m</strong> (cho phép: {nearestBranch.radius}m)
                {nearestBranch.distance <= nearestBranch.radius ? ' ✅' : ' ❌ Ngoài phạm vi'}
              </Typography>
            )}
            {branches.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Chưa có cửa hàng nào cài đặt vị trí. Liên hệ admin.
              </Typography>
            )}
          </Stack>
        </Alert>
      )}

      {/* GPS fallback for tour when there is no location yet */}
      {!geoLocation && !geoError && (
        <Alert id="tour-gps-status" severity="info" sx={{ mb: 2 }} icon={<Iconify icon="mdi:map-marker" />}>
          Đang lấy vị trí GPS...
        </Alert>
      )}

      {/* Current Time */}
      <Card id="tour-current-time" sx={{ p: 3, mb: 3, textAlign: 'center' }}>
        <Typography variant="h4">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Typography>
        <Typography variant="h2" color="primary" sx={{ mt: 1 }}>
          <CurrentTime />
        </Typography>
      </Card>

      {loading && (
        <Box display="flex" justifyContent="center" py={5}>
          <CircularProgress />
        </Box>
      )}

      {!loading && todayAssignments.length === 0 && (
        <Stack id="tour-shift-list" spacing={2}>
          <Alert severity="info">Hôm nay bạn không có ca làm nào.</Alert>

          {/* Overtime Check-in */}
          <Card id="tour-overtime-checkin" sx={{ p: 3, bgcolor: 'warning.lighter' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h6" color="warning.darker">
                  Check In Ngoài giờ
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Làm việc ngoài giờ 
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="warning"
                size="large"
                startIcon={
                  actionLoading === 'overtime' ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <Iconify icon="mdi:clock-plus-outline" />
                  )
                }
                onClick={() => openFaceDialog('overtime', 'Ngoài giờ')}
                disabled={!!actionLoading || (branches.length > 0 && !gpsReadyForCheckin)}
              >
                Chụp ảnh & Check In
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}

      {!loading && todayAssignments.length > 0 && (
        <Stack id="tour-shift-list" spacing={3}>
          {/* ── Smart Action Card ── */}
          <Card sx={{ p: 3, border: '2px solid', borderColor: isCurrentlyWorking ? 'success.main' : 'primary.main' }}>
            <Stack spacing={2}>
              {isCurrentlyWorking && currentShiftDisplay ? (
                <>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'success.main', animation: 'pulse 2s infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                    <Typography variant="h6" color="success.main">Đang làm việc</Typography>
                  </Stack>
                  <Typography variant="body1">
                    Ca hiện tại: <strong>{currentShiftDisplay.currentShift.shiftName || currentShiftDisplay.currentShift.scheduleName}</strong>{' '}
                    ({currentShiftDisplay.currentShift.startTime} - {currentShiftDisplay.currentShift.endTime})
                  </Typography>
                  {currentShiftDisplay.isMultiShift && (
                    <Typography variant="body2" color="text.secondary">
                      Chuỗi ca liên tiếp: {currentShiftDisplay.overallStart} → {currentShiftDisplay.overallEnd}
                      {' '}({currentShiftDisplay.chain.length} ca)
                    </Typography>
                  )}
                  <Button
                    variant="contained"
                    color="error"
                    size="large"
                    fullWidth
                    startIcon={
                      actionLoading === 'checkout' ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <Iconify icon="mdi:logout" />
                      )
                    }
                    onClick={handleSmartCheckOut}
                    disabled={!!actionLoading}
                    sx={{ py: 1.5 }}
                  >
                    Kết thúc làm việc
                  </Button>
                  {currentShiftDisplay.isMultiShift && (
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      Hệ thống sẽ tự ghi nhận chuyển ca cho các ca liên tiếp
                    </Typography>
                  )}
                </>
              ) : (
                <>
                  <Typography variant="h6" color="primary">
                    Sẵn sàng làm việc
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Hệ thống sẽ tự nhận diện ca phù hợp dựa vào thời gian hiện tại
                  </Typography>
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
                        color="success"
                        size="large"
                        fullWidth
                        startIcon={
                          actionLoading === 'smart' ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            <Iconify icon="mdi:camera" />
                          )
                        }
                        onClick={() => openFaceDialog('smart')}
                        disabled={!!actionLoading || (branches.length > 0 && !gpsReadyForCheckin)}
                        sx={{ py: 1.5 }}
                      >
                        Chụp ảnh & Bắt đầu làm việc
                      </Button>
                    </span>
                  </Tooltip>
                </>
              )}
            </Stack>
          </Card>

          {/* ── Shift Timeline ── */}
          <Card sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>
              Lịch ca hôm nay
            </Typography>
            <Stack spacing={0}>
              {shiftTimeline.map((item, idx) => {
                const { assignment, status, isConsecutiveWithPrev, isConsecutiveWithNext, logs } = item;
                const statusConfig = {
                  upcoming: { color: 'default' as const, label: 'Sắp tới', icon: 'mdi:clock-outline' },
                  active: { color: 'success' as const, label: 'Đang làm', icon: 'mdi:play-circle' },
                  completed: { color: 'info' as const, label: 'Hoàn thành', icon: 'mdi:check-circle' },
                  'auto-transitioned': { color: 'warning' as const, label: 'Tự động', icon: 'mdi:swap-horizontal-circle' },
                }[status];

                // Determine if this shift is the "currently active" one in a consecutive chain
                const isActiveInChain = isCurrentlyWorking
                  && currentShiftDisplay?.currentShift.assignmentId === assignment.assignmentId;

                return (
                  <Box key={assignment.id}>
                    {/* Consecutive connector */}
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
                        borderRadius: 1,
                        bgcolor: isActiveInChain ? 'success.lighter' : 'transparent',
                        border: isActiveInChain ? '1px solid' : 'none',
                        borderColor: 'success.light',
                      }}
                    >
                      {/* Timeline dot */}
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          bgcolor: status === 'active' || isActiveInChain ? 'success.main'
                            : status === 'completed' ? 'info.main'
                            : status === 'auto-transitioned' ? 'warning.main'
                            : 'grey.400',
                          flexShrink: 0,
                        }}
                      />

                      {/* Shift info */}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2">
                          {assignment.shiftName || assignment.scheduleName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {assignment.startTime} - {assignment.endTime}
                        </Typography>
                      </Box>

                      {/* Status chip */}
                      <Label variant="soft" color={statusConfig.color}>
                        {statusConfig.label}
                      </Label>
                    </Stack>

                    {/* Show log details for completed/auto shifts */}
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
          </Card>

          {/* Overtime Check-in - Always available */}
          <Card id="tour-overtime-checkin" sx={{ p: 3, bgcolor: 'warning.lighter' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h6" color="warning.darker">
                  Check In ngoài giờ
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Làm việc ngoài ca 
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="warning"
                size="large"
                startIcon={
                  actionLoading === 'overtime' ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <Iconify icon="mdi:clock-plus-outline" />
                  )
                }
                onClick={() => openFaceDialog('overtime', 'Ngoài giờ')}
                disabled={!!actionLoading || (branches.length > 0 && !gpsReadyForCheckin)}
              >
                Chụp ảnh & Check In
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}

      {/* ── Face Capture Dialog ── */}
      <Dialog
        open={faceDialogOpen}
        onClose={tourDialogRef.current ? closeTourDialog : closeFaceDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { overflow: 'visible' }, id: 'tour-face-dialog' }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="mdi:camera-account" width={28} />
            <span>
              Chụp ảnh Check-in
              {pendingCheckin?.shiftName && ` — ${pendingCheckin.shiftName}`}
            </span>
          </Stack>
          <IconButton onClick={closeFaceDialog} size="small">
            <Iconify icon="mdi:close" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {!capturedImage ? (
            <Stack spacing={2} alignItems="center">
              <Box
                id="tour-camera-view"
                sx={{
                  width: '100%',
                  aspectRatio: '4/3',
                  bgcolor: 'grey.900',
                  borderRadius: 2,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                  }}
                />
                {/* Live overlay */}
                {cameraActive && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      bgcolor: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      px: 1.5,
                      py: 0.5,
                    }}
                  >
                    <Typography variant="caption" display="block">
                      ⏰ <CurrentTime showDate />
                    </Typography>
                    <Typography variant="caption" display="block">
                      📍 {geoLocation
                        ? `${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)}${geoAccuracy != null ? ` (±${Math.round(geoAccuracy)}m)` : ''}`
                        : 'Đang lấy vị trí...'}
                    </Typography>
                    {nearestBranch && (
                      <Typography variant="caption" display="block" sx={{ opacity: 0.85 }}>
                        🏪 {nearestBranch.name} — {nearestBranch.distance}m
                      </Typography>
                    )}
                    {geoAddress && (
                      <Typography variant="caption" display="block" sx={{ opacity: 0.85 }}>
                        🏠 {geoAddress}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {cameraActive ? (
                <Stack id="tour-capture-btn" direction="row" spacing={1} sx={{ width: '100%' }}>
                  <Button
                    variant="contained"
                    size="large"
                    color="primary"
                    startIcon={<Iconify icon="mdi:camera" />}
                    onClick={capturePhoto}
                    sx={{ flex: 1 }}
                  >
                    Chụp ảnh
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={toggleCamera}
                    sx={{ minWidth: 'auto', px: 2 }}
                  >
                    <Iconify icon="mdi:camera-flip-outline" width={24} />
                  </Button>
                </Stack>
              ) : (
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Iconify icon="mdi:camera" />}
                  onClick={() => startCamera()}
                  fullWidth
                >
                  Mở Camera
                </Button>
              )}
            </Stack>
          ) : (
            <Stack spacing={2} alignItems="center">
              <Box
                component="img"
                src={capturedImage}
                alt="Captured face"
                sx={{
                  width: '100%',
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: 'success.main',
                }}
              />
              <Button
                variant="outlined"
                startIcon={<Iconify icon="mdi:camera-retake" />}
                onClick={() => {
                  setCapturedImage(null);
                  startCamera();
                }}
              >
                Chụp lại
              </Button>
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={tourDialogRef.current ? closeTourDialog : closeFaceDialog} color="inherit">
            Hủy
          </Button>
          <Button
            id="tour-confirm-btn"
            variant="contained"
            color="success"
            disabled={!capturedImage || submitting}
            startIcon={
              submitting ? <CircularProgress size={20} color="inherit" /> : <Iconify icon="mdi:check" />
            }
            onClick={handleFaceCheckin}
          >
            Xác nhận Check-in
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

// Helper: live clock
function CurrentTime({ showDate }: { showDate?: boolean }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (showDate) {
    return <>{time.toLocaleString('vi-VN')}</>;
  }

  return <>{time.toLocaleTimeString('vi-VN')}</>;
}
