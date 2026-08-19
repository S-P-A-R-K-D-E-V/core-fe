'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import Iconify from 'src/components/iconify';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { checkEnrollQuality } from 'src/api/faceEnrollment';
import { smartCheckInFace, smartCheckOutFace, checkInFace } from 'src/api/attendance';
import type { IEnrollQualityResponse } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Check-in/check-out bằng khuôn mặt — camera mở tự động, KHÔNG có nút bấm quay: liên tục lấy
// mẫu frame nền và validate qua face-tracking-service (đúng pattern tự-động-nhận-diện của
// face-enrollment, bước "Nhìn thẳng") tới khi có 1 tấm đạt (đủ sáng/rõ, nhìn thẳng), tự chụp
// tấm đó rồi gửi thẳng sang BE verify BẮT BUỘC (không phải video quay tay + verify best-effort
// như trước) — không khớp/không đủ tin cậy thì BE tự chặn hẳn check-in/out (xem
// AttendanceController.RequireFaceMatchAsync), dialog chỉ hiển thị kết quả.
//
// mode='checkin'|'checkout': chạy SONG SONG với luồng chụp ảnh cũ (smart-check-in/-out-face).
// mode='overtime': THAY THẾ hẳn luồng chụp ảnh cũ của action "Check-in ngoài giờ" (check-in-face).

const POLL_INTERVAL_MS = 600;
const YAW_STRAIGHT_MAX = 0.08;
const PITCH_STRAIGHT_MAX = 0.08;
const MIN_QUALITY = 0.55; // khớp Settings.QUALITY_THRESHOLD face-tracking-service — xem face-enrollment-view.tsx

function validateStraight(q: IEnrollQualityResponse): string | null {
  if (q.qualityScore < MIN_QUALITY) {
    return 'Ảnh chưa đủ rõ — di chuyển tới nơi đủ sáng, giữ máy ổn định.';
  }
  if (Math.abs(q.yaw) > YAW_STRAIGHT_MAX || Math.abs(q.pitch) > PITCH_STRAIGHT_MAX) {
    return 'Vui lòng nhìn thẳng vào camera.';
  }
  return null;
}

function extractApiError(error: any): { message: string; notEnrolled: boolean } {
  const errorCode = error?.errors && typeof error.errors === 'object' ? Object.keys(error.errors)[0] : null;
  const notEnrolled = errorCode === 'FaceTracking.NoFaceEmbedding';
  const message =
    error?.detail ||
    error?.description ||
    error?.message ||
    (error?.title !== 'One or more validation errors occurred.' ? error?.title : null) ||
    'Thất bại. Vui lòng thử lại.';
  return { message, notEnrolled };
}

type Phase = 'opening' | 'scanning' | 'submitting' | 'success' | 'error';

type Props = {
  open: boolean;
  mode: 'checkin' | 'checkout' | 'overtime';
  geoLocation?: { lat: number; lng: number } | null;
  geoAccuracy?: number | null;
  onClose: () => void;
  /** Gọi khi check-in/out thành công — cha tự fetchData() lại. */
  onSuccess: () => void;
};

export function FaceCheckinDialog({ open, mode, geoLocation, geoAccuracy, onClose, onSuccess }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('opening');
  const [hint, setHint] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notEnrolled, setNotEnrolled] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setPhase('opening');
    setHint(null);
    setErrorMsg(null);
    setNotEnrolled(false);

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setPhase('scanning');
      } catch {
        setErrorMsg('Không thể mở camera. Vui lòng cấp quyền truy cập camera.');
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

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

  const handleSubmit = useCallback(
    async (imageBase64: string) => {
      setPhase('submitting');
      try {
        const payload = {
          imageBase64,
          latitude: geoLocation?.lat,
          longitude: geoLocation?.lng,
          accuracy: geoAccuracy ?? undefined,
        };
        if (mode === 'checkin') {
          await smartCheckInFace(payload);
        } else if (mode === 'checkout') {
          await smartCheckOutFace(payload);
        } else {
          await checkInFace({ ...payload, isOvertime: true });
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setPhase('success');
        onSuccess();
      } catch (err) {
        const { message, notEnrolled: ne } = extractApiError(err);
        setErrorMsg(message);
        setNotEnrolled(ne);
        setPhase('error');
      }
    },
    [mode, geoLocation, geoAccuracy, onSuccess]
  );

  // ── Auto-detect: lấy mẫu frame nền, tự chụp khi đạt "nhìn thẳng" — KHÔNG cần bấm nút. ──
  useEffect(() => {
    if (phase !== 'scanning') return undefined;

    const interval = setInterval(async () => {
      if (busyRef.current) return;
      const base64 = captureFrameBase64();
      if (!base64) return;

      busyRef.current = true;
      try {
        const quality = await checkEnrollQuality(base64);
        const error = validateStraight(quality);
        if (error) {
          setHint(error);
          return;
        }
        setHint(null);
        handleSubmit(base64);
      } catch (err) {
        const { message } = extractApiError(err);
        setHint(message);
      } finally {
        busyRef.current = false;
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [phase, captureFrameBase64, handleSubmit]);

  function handleClose() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onClose();
  }

  function handleRetry() {
    setErrorMsg(null);
    setNotEnrolled(false);
    setPhase(streamRef.current ? 'scanning' : 'opening');
  }

  const title =
    mode === 'checkout' ? 'Check-out bằng khuôn mặt' : mode === 'overtime' ? 'Check-in ngoài giờ bằng khuôn mặt' : 'Check-in bằng khuôn mặt';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <Box sx={{ bgcolor: 'grey.900', color: '#fff', px: 3, py: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="mdi:face-recognition" width={22} />
          <Typography variant="subtitle1" fontWeight={600}>
            {title}
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ position: 'relative', overflow: 'hidden', bgcolor: 'common.black', width: '100%', height: 320 }}>
        {phase === 'success' || phase === 'error' ? (
          <Box
            sx={{
              width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 3, textAlign: 'center',
            }}
          >
            {phase === 'error' ? (
              <>
                <Iconify icon="mdi:alert-circle-outline" width={56} sx={{ color: 'error.main' }} />
                <Typography sx={{ color: '#fff' }}>{errorMsg}</Typography>
              </>
            ) : (
              <>
                <Iconify icon="mdi:check-decagram" width={56} sx={{ color: 'success.main' }} />
                <Typography variant="h6" sx={{ color: '#fff' }}>
                  {mode === 'checkout' ? 'Check-out thành công!' : 'Check-in thành công!'}
                </Typography>
              </>
            )}
          </Box>
        ) : (
          <>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
            {phase === 'opening' && (
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress sx={{ color: '#fff' }} />
              </Box>
            )}
            {phase === 'scanning' && (
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <Box
                  sx={{
                    width: 'min(200px, 55vw)', height: 'min(250px, 62vw)', borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.8)',
                  }}
                />
              </Box>
            )}
            {phase === 'submitting' && (
              <Box
                sx={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', gap: 1,
                  alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.5)',
                }}
              >
                <CircularProgress sx={{ color: '#fff' }} />
                <Typography variant="caption" sx={{ color: '#fff' }}>Đang xác thực…</Typography>
              </Box>
            )}
            {phase === 'scanning' && (
              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', px: 2, py: 1.25, textAlign: 'center', minHeight: 40 }}>
                <Typography variant="caption">{hint ?? 'Giữ khuôn mặt trong khung, nhìn thẳng vào camera…'}</Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      <Stack spacing={1.5} sx={{ p: 2.5, bgcolor: 'grey.900' }}>
        {phase === 'error' && (
          <Stack spacing={1.5}>
            {notEnrolled ? (
              <Button
                variant="contained"
                fullWidth
                startIcon={<Iconify icon="mdi:face-recognition" />}
                onClick={() => router.push(paths.dashboard.attendance.faceEnrollment)}
              >
                Đăng ký khuôn mặt ngay
              </Button>
            ) : (
              <Button variant="contained" fullWidth onClick={handleRetry} startIcon={<Iconify icon="mdi:camera-retake" />}>
                Thử lại
              </Button>
            )}
            <Button variant="outlined" color="inherit" fullWidth onClick={handleClose} sx={{ color: 'grey.300', borderColor: 'grey.600' }}>
              Đóng
            </Button>
          </Stack>
        )}
        {phase === 'success' && (
          <Button variant="contained" fullWidth onClick={handleClose}>
            Đóng
          </Button>
        )}
        {(phase === 'opening' || phase === 'scanning' || phase === 'submitting') && (
          <Button variant="text" color="inherit" onClick={handleClose} sx={{ color: 'grey.400' }}>
            Huỷ
          </Button>
        )}
      </Stack>
    </Dialog>
  );
}
