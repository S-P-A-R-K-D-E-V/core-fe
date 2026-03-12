'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import { useAuthContext } from 'src/auth/hooks';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { checkinFace } from 'src/api/checkinFace';

// ----------------------------------------------------------------------

export default function CheckinFaceView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Get location
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt không hỗ trợ GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(null);
      },
      (err) => {
        setLocationError(`Không lấy được vị trí: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  // Start camera
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
    } catch (err) {
      enqueueSnackbar('Không thể mở camera. Vui lòng cấp quyền.', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Add overlay: time + location
    const now = new Date();
    const timeStr = now.toLocaleString('vi-VN');
    const locStr = location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'N/A';

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.fillText(`⏰ ${timeStr}`, 10, canvas.height - 38);
    ctx.fillText(`📍 ${locStr}`, 10, canvas.height - 16);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageBase64);
    stopCamera();
  }, [location, stopCamera]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  // Submit check-in
  const handleSubmit = useCallback(async () => {
    if (!capturedImage) {
      enqueueSnackbar('Vui lòng chụp ảnh trước', { variant: 'warning' });
      return;
    }
    if (!candidateName.trim()) {
      enqueueSnackbar('Vui lòng nhập tên Nhân viên', { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await checkinFace({
        candidateId: candidateId ? Number(candidateId) : undefined,
        candidateName: candidateName.trim(),
        imageBase64: capturedImage,
        lat: location?.lat,
        lng: location?.lng,
        deviceName: deviceName || undefined,
        time: new Date().toISOString(),
      });

      const notiStatus = result.notificationSent ? '✅ Đã gửi thông báo' : '⚠️ Chưa gửi thông báo';
      setLastResult(`Check-in thành công! ${notiStatus}`);
      enqueueSnackbar('Check-in khuôn mặt thành công!', { variant: 'success' });

      // Reset form for next checkin
      setCapturedImage(null);
      setCandidateName('');
      setCandidateId('');
    } catch (error: any) {
      const msg = error?.title || error?.message || 'Check-in thất bại';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [capturedImage, candidateName, candidateId, deviceName, location, enqueueSnackbar]);

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
    <RoleBasedGuard roles={['Admin', 'Manager', 'Staff']} hasContent>
      <Container maxWidth={settings.themeStretch ? false : 'md'}>
        <CustomBreadcrumbs
          heading="Check-in Khuôn mặt"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Check-in Khuôn mặt' },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Stack spacing={3}>
          {/* Form fields */}
          <Card sx={{ p: 3 }}>
            <Stack spacing={2}>
              <TextField
                label="Tên Nhân viên *"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                fullWidth
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Mã Nhân viên"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Tên thiết bị (Quầy)"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="VD: Quầy 1"
                  sx={{ flex: 1 }}
                />
              </Stack>

              {/* Location info */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Iconify icon="mdi:map-marker" width={20} />
                {location ? (
                  <Typography variant="body2" color="text.secondary">
                    📍 Vị trí: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="error">
                    {locationError || 'Đang lấy vị trí...'}
                  </Typography>
                )}
                <Button size="small" onClick={getLocation}>
                  Cập nhật
                </Button>
              </Stack>
            </Stack>
          </Card>

          {/* Camera section */}
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              📸 Camera
            </Typography>

            {!cameraActive && !capturedImage && (
              <Button
                variant="contained"
                size="large"
                startIcon={<Iconify icon="mdi:camera" />}
                onClick={startCamera}
                fullWidth
                sx={{ py: 2 }}
              >
                Mở Camera
              </Button>
            )}

            {/* Video preview */}
            {cameraActive && (
              <Stack spacing={2} alignItems="center">
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 640,
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: 'black',
                  }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', display: 'block' }}
                  />
                </Box>
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Iconify icon="mdi:camera" />}
                    onClick={capturePhoto}
                    size="large"
                  >
                    Chụp ảnh
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={stopCamera}>
                    Đóng camera
                  </Button>
                </Stack>
              </Stack>
            )}

            {/* Captured image preview */}
            {capturedImage && (
              <Stack spacing={2} alignItems="center">
                <Box
                  component="img"
                  src={capturedImage}
                  sx={{
                    width: '100%',
                    maxWidth: 640,
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: 'success.main',
                  }}
                  alt="Captured"
                />
                <Button
                  variant="outlined"
                  startIcon={<Iconify icon="mdi:camera-retake" />}
                  onClick={retakePhoto}
                >
                  Chụp lại
                </Button>
              </Stack>
            )}

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Card>

          {/* Submit */}
          <Button
            variant="contained"
            size="large"
            color="success"
            startIcon={
              submitting ? <CircularProgress size={20} color="inherit" /> : <Iconify icon="mdi:check" />
            }
            onClick={handleSubmit}
            disabled={submitting || !capturedImage || !candidateName.trim()}
            sx={{ py: 1.5 }}
          >
            {submitting ? 'Đang xử lý...' : 'Xác nhận Check-in'}
          </Button>

          {/* Result */}
          {lastResult && (
            <Alert severity={lastResult.includes('thành công') ? 'success' : 'warning'}>
              {lastResult}
            </Alert>
          )}
        </Stack>
      </Container>
    </RoleBasedGuard>
  );
}
