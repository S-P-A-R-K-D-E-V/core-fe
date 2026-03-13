'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

import { paths } from 'src/routes/paths';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';

import { useAuthContext } from 'src/auth/hooks';

import { IShiftAssignment, IAttendanceLog } from 'src/types/corecms-api';
import {
  getMySchedule,
  getMyAttendanceLogs,
  checkIn,
  checkOut,
} from 'src/api/attendance';
import { checkinFace } from 'src/api/checkinFace';

// ----------------------------------------------------------------------

export default function AttendanceCheckinView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const [todayAssignments, setTodayAssignments] = useState<IShiftAssignment[]>([]);
  const [todayLogs, setTodayLogs] = useState<IAttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoAddress, setGeoAddress] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Face capture dialog state
  const [faceDialogOpen, setFaceDialogOpen] = useState(false);
  const [pendingCheckin, setPendingCheckin] = useState<{
    assignmentId: string;
    isOvertime: boolean;
    shiftName?: string;
  } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Get geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          setGeoError('Không lấy được vị trí GPS. Kiểm tra quyền trình duyệt.');
          console.error('Geolocation error:', error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGeoError('Trình duyệt không hỗ trợ GPS.');
    }
  }, []);

  // Reverse geocode to get address
  useEffect(() => {
    if (!geoLocation) return;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${geoLocation.lat}&lon=${geoLocation.lng}&format=json`,
      { headers: { 'User-Agent': 'CoreCms/1.0' } }
    )
      .then((res) => res.json())
      .then((data) => {
        if (data?.display_name) setGeoAddress(data.display_name);
      })
      .catch((err) => console.error('Reverse geocode failed:', err));
  }, [geoLocation]);

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

  // ── Camera helpers ──

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
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
  }, [enqueueSnackbar]);

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

    ctx.drawImage(video, 0, 0);

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
    (assignmentId: string, isOvertime: boolean, shiftName?: string) => {
      setPendingCheckin({ assignmentId, isOvertime, shiftName });
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
    const loadingKey = pendingCheckin.assignmentId || 'overtime';
    setActionLoading(loadingKey);

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
      });

      // 2) Check-in ca làm
      await checkIn({
        shiftAssignmentId: pendingCheckin.isOvertime ? undefined : pendingCheckin.assignmentId,
        isOvertime: pendingCheckin.isOvertime,
        latitude: geoLocation?.lat,
        longitude: geoLocation?.lng,
        faceVerified: true,
      });

      enqueueSnackbar(
        pendingCheckin.isOvertime
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
  }, [capturedImage, pendingCheckin, user, geoLocation, enqueueSnackbar, closeFaceDialog, fetchData]);

  const handleCheckOut = async (logId: string) => {
    try {
      setActionLoading(logId);
      await checkOut({
        attendanceLogId: logId,
        latitude: geoLocation?.lat,
        longitude: geoLocation?.lng,
        faceVerified: false,
      });
      enqueueSnackbar('Check-out thành công!', { variant: 'success' });
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

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Check In / Check Out"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Attendance' },
          { name: 'Check In/Out' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {/* GPS Status */}
      {geoError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {geoError}
        </Alert>
      )}

      {geoLocation && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<Iconify icon="mdi:map-marker" />}>
          GPS: {geoLocation.lat.toFixed(6)}, {geoLocation.lng.toFixed(6)}
        </Alert>
      )}

      {/* Current Time */}
      <Card sx={{ p: 3, mb: 3, textAlign: 'center' }}>
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
        <Stack spacing={2}>
          <Alert severity="info">Hôm nay bạn không có ca làm nào.</Alert>

          {/* Overtime Check-in */}
          <Card sx={{ p: 3, bgcolor: 'warning.lighter' }}>
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
                onClick={() => openFaceDialog('', true, 'Ngoài giờ')}
                disabled={!!actionLoading}
              >
                Chụp ảnh & Check In
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}

      {!loading && todayAssignments.length > 0 && (
        <Stack spacing={3}>
          {todayAssignments.map((assignment) => {
            const openLog = getLogForAssignment(assignment.assignmentId);
            const completedLogs = getCompletedLogs(assignment.assignmentId);
            const isLoading = actionLoading === assignment.assignmentId || actionLoading === openLog?.id;

            return (
              <Card key={assignment.id} sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                  <Box>
                    <Typography variant="h6">{assignment.shiftName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {assignment.startTime} - {assignment.endTime}
                    </Typography>
                    {assignment.note && (
                      <Typography variant="caption" color="text.secondary">
                        Ghi chú: {assignment.note}
                      </Typography>
                    )}
                  </Box>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Label variant="soft" color={assignment.shiftType === 'Extra' ? 'warning' : 'info'}>
                      {assignment.shiftType}
                    </Label>

                    {openLog ? (
                      <Button
                        variant="contained"
                        color="error"
                        size="large"
                        startIcon={
                          isLoading ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            <Iconify icon="mdi:logout" />
                          )
                        }
                        onClick={() => handleCheckOut(openLog.id)}
                        disabled={!!isLoading}
                      >
                        Check Out
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="success"
                        size="large"
                        startIcon={
                          isLoading ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            <Iconify icon="mdi:camera" />
                          )
                        }
                        onClick={() =>
                          openFaceDialog(
                            assignment.assignmentId,
                            false,
                            assignment.shiftName || assignment.scheduleName
                          )
                        }
                        disabled={!!isLoading}
                      >
                        Chụp ảnh & Check In
                      </Button>
                    )}
                  </Stack>
                </Stack>

                {/* Show logs for this assignment */}
                {completedLogs.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Lịch sử chấm công:
                    </Typography>
                    <Stack spacing={1}>
                      {completedLogs.map((log) => (
                        <Stack
                          key={log.id}
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ pl: 2 }}
                        >
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
                            <Chip
                              size="small"
                              label={`Trễ ${log.lateMinutes} phút`}
                              color="error"
                              variant="soft"
                            />
                          )}
                          {log.isAutoClosedBySystem && (
                            <Chip size="small" label="Tự động đóng" color="warning" variant="soft" />
                          )}
                          {log.workedHours != null && log.checkOutTime && (
                            <Chip
                              size="small"
                              label={`${log.workedHours.toFixed(1)}h`}
                              variant="soft"
                            />
                          )}
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Card>
            );
          })}

          {/* Overtime Check-in - Always available */}
          <Card sx={{ p: 3, bgcolor: 'warning.lighter' }}>
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
                onClick={() => openFaceDialog('', true, 'Ngoài giờ')}
                disabled={!!actionLoading}
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
        onClose={closeFaceDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { overflow: 'visible' } }}
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
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                        ? `${geoLocation.lat.toFixed(4)}, ${geoLocation.lng.toFixed(4)}`
                        : 'Đang lấy vị trí...'}
                    </Typography>
                    {geoAddress && (
                      <Typography variant="caption" display="block" sx={{ opacity: 0.85 }}>
                        🏠 {geoAddress}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {cameraActive ? (
                <Button
                  variant="contained"
                  size="large"
                  color="primary"
                  startIcon={<Iconify icon="mdi:camera" />}
                  onClick={capturePhoto}
                  fullWidth
                >
                  Chụp ảnh
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Iconify icon="mdi:camera" />}
                  onClick={startCamera}
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
          <Button onClick={closeFaceDialog} color="inherit">
            Hủy
          </Button>
          <Button
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
