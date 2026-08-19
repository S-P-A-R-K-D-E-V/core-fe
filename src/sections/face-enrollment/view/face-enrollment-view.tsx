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

import { SelfVerifyDialog } from './self-verify-dialog';

// ----------------------------------------------------------------------

type StepKey = 'straight' | 'left' | 'right' | 'up' | 'down' | 'blink';

const STEPS: { key: StepKey; label: string; hint: string }[] = [
  { key: 'straight', label: 'Nhìn thẳng', hint: 'Giữ khuôn mặt thẳng, nhìn vào camera' },
  { key: 'left', label: 'Quay trái', hint: 'Xoay đầu sang trái một góc rõ rệt' },
  { key: 'right', label: 'Quay phải', hint: 'Xoay đầu sang phải một góc rõ rệt' },
  { key: 'up', label: 'Ngước lên', hint: 'Ngước cằm lên trên' },
  { key: 'down', label: 'Cúi xuống', hint: 'Cúi cằm xuống dưới' },
  // 'blink' tạm bỏ khỏi luồng — BLINK_EAR_THRESHOLD chưa được calibrate bằng ảnh mẫu thật
  // (xem README face-tracking-service), single-frame EAR check hiện gần như không bao giờ
  // bắt được đúng khoảnh khắc nhắm mắt qua polling 600ms. validateStep vẫn giữ case 'blink'
  // để bật lại nhanh sau khi calibrate xong.
];

// Ngưỡng heuristic — yaw/pitch từ Core-be là ước lượng thô (xem docstring estimate_yaw_pitch
// trong face-tracking-service), KHÔNG phải góc độ chính xác. Khớp app-mobile FaceEnrollmentScreen.
const YAW_STRAIGHT_MAX = 0.08;
const YAW_TURN_MIN = 0.15;
const PITCH_STRAIGHT_MAX = 0.08;
const PITCH_TILT_MIN = 0.12;
const MIN_QUALITY = 0.35;

// Nhịp lấy mẫu frame nền — đủ nhanh để cảm giác "tự động", không dồn dập gọi BE quá mức.
const POLL_INTERVAL_MS = 600;
// Khoảng nghỉ hiển thị dấu ✓ trước khi chuyển bước kế tiếp.
const STEP_PASS_PAUSE_MS = 600;

function validateStep(step: StepKey, q: IEnrollQualityResponse): string | null {
  if (q.qualityScore < MIN_QUALITY) {
    return 'Ảnh chưa đủ rõ — di chuyển tới nơi đủ sáng, giữ máy ổn định.';
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
        return 'Xoay đầu rõ hơn nữa.';
      }
      return null;
    case 'up':
      if (q.pitch < PITCH_TILT_MIN) {
        return 'Ngước cằm lên cao hơn.';
      }
      return null;
    case 'down':
      if (q.pitch > -PITCH_TILT_MIN) {
        return 'Cúi cằm xuống thấp hơn.';
      }
      return null;
    case 'blink':
      if (!q.blinkDetected) {
        return 'Chưa phát hiện chớp mắt — nhìn thẳng và chớp mắt liên tục.';
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

type Mode = 'status' | 'capture';

export default function FaceEnrollmentView() {
  const theme = useTheme();
  const router = useRouter();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user, refreshUser } = useAuthContext();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const isAdminOrManager =
    user?.role === 'Admin' ||
    user?.role === 'Manager' ||
    !!user?.roles?.some((r: string) => r === 'Admin' || r === 'Manager');

  const [mode, setMode] = useState<Mode>(user?.hasFaceEmbedding ? 'status' : 'capture');
  const [verifyOpen, setVerifyOpen] = useState(false);
  // Đồng bộ mode theo user (auth context có thể load user muộn hơn render đầu tiên) — nhưng
  // KHÔNG ghi đè nếu người dùng đã tự bấm "Đăng ký lại" (vẫn ở capture cho tới khi xong).
  const manualCaptureRef = useRef(false);
  useEffect(() => {
    if (manualCaptureRef.current) return;
    setMode(user?.hasFaceEmbedding ? 'status' : 'capture');
  }, [user?.hasFaceEmbedding]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const imagesRef = useRef<string[]>([]);

  const [stepIndex, setStepIndex] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stepPassed, setStepPassed] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [failedReason, setFailedReason] = useState<string | null>(null);

  const step = STEPS[stepIndex];

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // ── Camera lifecycle — mở 1 lần khi vào chế độ capture, giữ nguyên xuyên suốt cả 6 bước. ──
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS Safari đôi khi không tự phát dù có autoPlay khi srcObject được gán sau khi mount
        // (đặc biệt trong callback async) — video đứng ở khung hình đen (videoWidth vẫn > 0)
        // khiến mọi frame lấy mẫu đều là ảnh đen, luôn nhận lỗi "không phát hiện khuôn mặt".
        // Gọi play() chủ động, .catch() nuốt lỗi vì trình duyệt có thể tự phát trước đó rồi.
        videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch {
      setCameraError('Không thể mở camera. Vui lòng cấp quyền truy cập camera cho trình duyệt.');
    }
  }, []);

  useEffect(() => {
    if (mode !== 'capture') return undefined;
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraReady(false);
    };
  }, [mode, startCamera]);

  const captureFrameBase64 = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? null;
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

  // ── Auto-detect: lấy mẫu frame nền, tự chấp nhận/tự chuyển bước — KHÔNG cần bấm chụp. ──
  useEffect(() => {
    if (mode !== 'capture' || !cameraReady || stepPassed || submitting || done) return undefined;

    const interval = setInterval(async () => {
      if (busyRef.current) return;
      const base64 = captureFrameBase64();
      if (!base64) return;

      busyRef.current = true;
      try {
        const quality = await checkEnrollQuality(base64);
        const error = validateStep(step.key, quality);
        if (error) {
          setHint(error);
          return;
        }

        setHint(null);
        setStepPassed(true);
        const next = [...imagesRef.current, base64];
        imagesRef.current = next;
        setImages(next);

        setTimeout(() => {
          setStepPassed(false);
          if (stepIndex + 1 >= STEPS.length) {
            handleSubmit(next);
          } else {
            setStepIndex((i) => i + 1);
          }
        }, STEP_PASS_PAUSE_MS);
      } catch (err) {
        setHint(extractApiError(err));
      } finally {
        busyRef.current = false;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cameraReady, stepPassed, submitting, done, stepIndex, step.key, captureFrameBase64]);

  function handleReset() {
    setStepIndex(0);
    setImages([]);
    imagesRef.current = [];
    setFailedReason(null);
    setDone(false);
    setHint(null);
    setStepPassed(false);
    if (!streamRef.current) startCamera();
  }

  function startReenroll() {
    manualCaptureRef.current = true;
    handleReset();
    setMode('capture');
  }

  return (
    <RoleBasedGuard roles={['Admin', 'Manager', 'Staff']} hasContent>
      <Container maxWidth={settings.themeStretch ? false : 'sm'}>
        <CustomBreadcrumbs
          heading="Đăng ký khuôn mặt"
          links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Đăng ký khuôn mặt' }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {mode === 'status' ? (
          <Card sx={{ p: 5, textAlign: 'center' }}>
            <Iconify icon="mdi:check-decagram" width={64} sx={{ color: 'success.main', mb: 2 }} />
            <Typography variant="h5" sx={{ mb: 1 }}>
              Bạn đã đăng ký khuôn mặt
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Có thể dùng khuôn mặt để chấm công tại quầy.
            </Typography>
            <Stack spacing={1.5} sx={{ maxWidth: 320, mx: 'auto' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<Iconify icon="mdi:face-recognition" />}
                onClick={() => setVerifyOpen(true)}
              >
                Kiểm tra so khớp
              </Button>
              <Button
                variant="outlined"
                size="large"
                color="inherit"
                disabled={!isAdminOrManager}
                startIcon={<Iconify icon="mdi:camera-retake" />}
                onClick={startReenroll}
              >
                Đăng ký lại
              </Button>
              {!isAdminOrManager && (
                <Typography variant="caption" color="text.secondary">
                  Cần Admin hoặc Quản lý thực hiện đăng ký lại — liên hệ quản lý nếu khuôn mặt thay đổi nhiều.
                </Typography>
              )}
            </Stack>

            <SelfVerifyDialog open={verifyOpen} onClose={() => setVerifyOpen(false)} />
          </Card>
        ) : done ? (
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
                value={((stepIndex + (stepPassed ? 1 : 0)) / STEPS.length) * 100}
                sx={{ height: 6, borderRadius: 1 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, mb: 2 }}>
                Giữ khuôn mặt trong khung — tự động nhận diện, không cần bấm chụp.
              </Typography>
            </Box>

            {/* Camera */}
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                bgcolor: 'common.black',
                width: '100%',
                height: isMobile ? '55vh' : 420,
              }}
            >
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
              />

              {cameraReady && (
                <Box
                  sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <Box
                    sx={{
                      width: 'min(200px, 55vw)', height: 'min(250px, 62vw)', borderRadius: '50%',
                      border: '3px solid',
                      borderColor: stepPassed ? 'success.main' : 'rgba(255,255,255,0.8)',
                      transition: 'border-color 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {stepPassed && <Iconify icon="mdi:check-bold" width={72} sx={{ color: 'success.main' }} />}
                  </Box>
                </Box>
              )}

              {!cameraReady && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress sx={{ color: '#fff' }} />
                </Box>
              )}

              {/* Hint bar */}
              <Box
                sx={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', px: 2, py: 1.25, textAlign: 'center', minHeight: 40,
                }}
              >
                <Typography variant="caption">
                  {stepPassed ? '✓ Đạt! Chuyển bước tiếp theo…' : (hint ?? step.hint)}
                </Typography>
              </Box>
            </Box>

            {submitting && (
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 2 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Đang gửi ảnh đăng ký…
                </Typography>
              </Stack>
            )}
          </Card>
        )}
      </Container>
    </RoleBasedGuard>
  );
}
