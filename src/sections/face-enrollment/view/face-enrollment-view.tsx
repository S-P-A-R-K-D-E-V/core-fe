'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { useAuthContext } from 'src/auth/hooks';

import { checkEnrollQuality, submitFaceEnrollment } from 'src/api/faceEnrollment';
import type { IEnrollQualityResponse } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type StepKey = 'straight' | 'left' | 'right' | 'up' | 'down' | 'blink';

const STEPS: { key: StepKey; label: string; hint: string }[] = [
  { key: 'straight', label: 'Nhìn thẳng', hint: 'Giữ khuôn mặt thẳng, nhìn vào camera' },
  { key: 'left', label: 'Quay trái', hint: 'Xoay đầu sang trái một góc rõ rệt' },
  { key: 'right', label: 'Quay phải', hint: 'Xoay đầu sang phải một góc rõ rệt' },
  { key: 'up', label: 'Ngước lên', hint: 'Ngước cằm lên trên' },
  { key: 'down', label: 'Cúi xuống', hint: 'Cúi cằm xuống dưới' },
  { key: 'blink', label: 'Chớp mắt', hint: 'Nhìn thẳng vào camera và chớp mắt ngay lúc chụp' },
];

// Ngưỡng heuristic — yaw/pitch từ Core-be là ước lượng thô (xem docstring estimate_yaw_pitch
// trong face-tracking-service), KHÔNG phải góc độ chính xác. Khớp app-mobile FaceEnrollmentScreen
// để 2 nền tảng chấp nhận/từ chối ảnh giống nhau.
const YAW_STRAIGHT_MAX = 0.08;
const YAW_TURN_MIN = 0.15;
const PITCH_STRAIGHT_MAX = 0.08;
const PITCH_TILT_MIN = 0.12;
const MIN_QUALITY = 0.35;

/** Validate kết quả enroll/quality theo đúng bước hiện tại. Trả về null nếu hợp lệ, hoặc
 *  thông báo lỗi để yêu cầu chụp lại. Xem cùng logic ở app-mobile FaceEnrollmentScreen —
 *  2 bước "Quay trái"/"Quay phải" CHỈ xác nhận đã xoay đủ góc, không phân biệt đúng chiều. */
function validateStep(step: StepKey, q: IEnrollQualityResponse): string | null {
  if (q.qualityScore < MIN_QUALITY) {
    return 'Ảnh chưa đủ rõ nét — vui lòng chụp lại ở nơi đủ sáng, giữ máy ổn định.';
  }
  switch (step) {
    case 'straight':
      if (Math.abs(q.yaw) > YAW_STRAIGHT_MAX || Math.abs(q.pitch) > PITCH_STRAIGHT_MAX) {
        return 'Vui lòng nhìn thẳng vào camera.';
      }
      return null;
    case 'left':
    case 'right':
      if (Math.abs(q.yaw) < YAW_TURN_MIN) {
        return 'Vui lòng xoay đầu rõ hơn nữa.';
      }
      return null;
    case 'up':
      if (q.pitch < PITCH_TILT_MIN) {
        return 'Vui lòng ngước cằm lên cao hơn.';
      }
      return null;
    case 'down':
      if (q.pitch > -PITCH_TILT_MIN) {
        return 'Vui lòng cúi cằm xuống thấp hơn.';
      }
      return null;
    case 'blink':
      if (!q.blinkDetected) {
        return 'Chưa phát hiện chớp mắt — vui lòng nhìn thẳng và chớp mắt ngay lúc chụp.';
      }
      return null;
    default:
      return null;
  }
}

function extractApiError(error: any): string {
  if (!error) return 'Thất bại. Vui lòng thử lại.';
  if (error?.errors && typeof error.errors === 'object' && !Array.isArray(error.errors)) {
    const key = Object.keys(error.errors)[0];
    if (key) {
      const msgs = error.errors[key];
      return Array.isArray(msgs) ? msgs[0] : String(msgs);
    }
  }
  return (
    error?.detail ||
    error?.description ||
    error?.message ||
    (error?.title !== 'One or more validation errors occurred.' ? error?.title : null) ||
    'Thất bại. Vui lòng thử lại.'
  );
}

export default function FaceEnrollmentView() {
  const theme = useTheme();
  const router = useRouter();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { refreshUser } = useAuthContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [images, setImages] = useState<string[]>([]); // raw base64, no data: prefix
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [failedReason, setFailedReason] = useState<string | null>(null);

  const step = STEPS[stepIndex];

  // ── Camera lifecycle — mở 1 lần, giữ nguyên xuyên suốt cả 6 bước (không đóng/mở lại
  // giữa các bước, chỉ ẩn/hiện preview) — khớp app-mobile FaceEnrollmentCameraModal. ──
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch {
      setCameraError('Không thể mở camera. Vui lòng cấp quyền truy cập camera cho trình duyệt.');
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [startCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror horizontally (front camera) so preview trông tự nhiên.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPreview(dataUrl);
    setCapturedBase64(dataUrl.split(',')[1] ?? '');
  }, []);

  const handleRetake = useCallback(() => {
    setCapturedPreview(null);
    setCapturedBase64(null);
  }, []);

  async function handleSubmit(finalImages: string[]) {
    setSubmitting(true);
    setFailedReason(null);
    try {
      await submitFaceEnrollment(finalImages);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setDone(true);
      refreshUser().catch(() => {});
    } catch (err) {
      setFailedReason(extractApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const handleUseThisPhoto = useCallback(async () => {
    if (!capturedBase64) return;
    setValidating(true);
    try {
      const quality = await checkEnrollQuality(capturedBase64);
      const error = validateStep(step.key, quality);
      if (error) {
        enqueueSnackbar(error, { variant: 'warning' });
        handleRetake();
        return;
      }

      const next = [...images, capturedBase64];
      setImages(next);
      setCapturedPreview(null);
      setCapturedBase64(null);

      if (stepIndex + 1 >= STEPS.length) {
        await handleSubmit(next);
      } else {
        setStepIndex(stepIndex + 1);
      }
    } catch (err) {
      enqueueSnackbar(extractApiError(err), { variant: 'error' });
      handleRetake();
    } finally {
      setValidating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedBase64, step.key, images, stepIndex, enqueueSnackbar, handleRetake]);

  function handleReset() {
    setStepIndex(0);
    setImages([]);
    setFailedReason(null);
    setDone(false);
    setCapturedPreview(null);
    setCapturedBase64(null);
    if (!streamRef.current) startCamera();
  }

  return (
    <RoleBasedGuard roles={['Admin', 'Manager', 'Staff']} hasContent>
      <Container maxWidth={settings.themeStretch ? false : 'sm'}>
        <CustomBreadcrumbs
          heading="Đăng ký khuôn mặt"
          links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Đăng ký khuôn mặt' }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {done ? (
          <Card sx={{ p: 5, textAlign: 'center' }}>
            <Iconify icon="mdi:check-decagram" width={64} sx={{ color: 'success.main', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 1 }}>
              Đăng ký khuôn mặt thành công!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Bạn có thể dùng khuôn mặt để chấm công tại quầy từ bây giờ.
            </Typography>
            <Button variant="contained" size="large" onClick={() => router.push(paths.dashboard.root)}>
              Về trang chủ
            </Button>
          </Card>
        ) : failedReason ? (
          <Card sx={{ p: 5, textAlign: 'center' }}>
            <Iconify icon="mdi:alert-circle-outline" width={64} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 1 }}>
              Đăng ký thất bại
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {failedReason}
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                size="large"
                startIcon={<Iconify icon="mdi:camera-retake" />}
                onClick={handleReset}
              >
                Thử lại từ đầu
              </Button>
              <Button variant="outlined" color="inherit" size="large" onClick={() => router.push(paths.dashboard.root)}>
                Để sau
              </Button>
            </Stack>
          </Card>
        ) : cameraError ? (
          <Card sx={{ p: 5, textAlign: 'center' }}>
            <Iconify icon="mdi:camera-off" width={64} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>
              {cameraError}
            </Typography>
            <Button variant="contained" onClick={startCamera}>
              Thử lại
            </Button>
          </Card>
        ) : (
          <Card sx={{ overflow: 'hidden' }}>
            {/* Progress */}
            <Box sx={{ px: 2, pt: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">
                  Bước {stepIndex + 1}/{STEPS.length}: {step.label}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={((stepIndex + (capturedPreview ? 1 : 0)) / STEPS.length) * 100}
                sx={{ height: 6, borderRadius: 1 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, mb: 2 }}>
                {step.hint}
              </Typography>
            </Box>

            {/* Camera / preview */}
            <Box
              sx={{
                position: 'relative',
                bgcolor: 'common.black',
                aspectRatio: '4/3',
                minHeight: isMobile ? '55vh' : 420,
              }}
            >
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {!capturedPreview ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      transform: 'scaleX(-1)',
                    }}
                  />
                  {cameraReady && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                      }}
                    >
                      <Box
                        sx={{
                          width: 200,
                          height: 250,
                          borderRadius: '50%',
                          border: '3px solid rgba(255,255,255,0.8)',
                        }}
                      />
                    </Box>
                  )}
                </>
              ) : (
                <Box
                  component="img"
                  src={capturedPreview}
                  alt="Captured"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
            </Box>

            {/* Actions */}
            <Stack spacing={1.5} sx={{ p: 2 }}>
              {!capturedPreview ? (
                <Button
                  variant="contained"
                  size="large"
                  disabled={!cameraReady}
                  startIcon={<Iconify icon="mdi:camera" />}
                  onClick={capturePhoto}
                  sx={{ py: 1.5 }}
                >
                  Chụp
                </Button>
              ) : (
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    fullWidth
                    disabled={validating}
                    startIcon={<Iconify icon="mdi:camera-retake" />}
                    onClick={handleRetake}
                  >
                    Chụp lại
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    disabled={validating}
                    startIcon={
                      validating ? <CircularProgress size={18} color="inherit" /> : <Iconify icon="mdi:check-circle" />
                    }
                    onClick={handleUseThisPhoto}
                  >
                    Dùng ảnh này
                  </Button>
                </Stack>
              )}
              {submitting && (
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    Đang gửi ảnh đăng ký…
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Card>
        )}
      </Container>
    </RoleBasedGuard>
  );
}
