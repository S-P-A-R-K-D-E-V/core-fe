'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';

import Iconify from 'src/components/iconify';

import { smartCheckInFace, smartCheckOutFace, checkInFace } from 'src/api/attendance';

// ----------------------------------------------------------------------
// Check-in/check-out bằng khuôn mặt (mới): quay 1 video ngắn thay vì chụp ảnh, BE tự verify
// qua face-tracking-service — verify là best-effort, KHÔNG chặn chấm công nếu fail/service lỗi
// (xem VerifyFaceCommandHandler bên Core-be), nên dialog này không cần màn "thử lại nếu không
// khớp" như self-verify-dialog — chỉ cần quay xong là submit thẳng.
// mode='checkin'|'checkout': chạy SONG SONG với luồng chụp ảnh cũ (smart-check-in/-out-face).
// mode='overtime': THAY THẾ hẳn luồng chụp ảnh cũ của action "Check-in ngoài giờ"
// (check-in-face, IsOvertime=true) — không còn đường chụp ảnh cho action này nữa.

const RECORD_MS = 3000;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function extractApiError(error: any): string {
  return (
    error?.detail ||
    error?.description ||
    error?.message ||
    (error?.title !== 'One or more validation errors occurred.' ? error?.title : null) ||
    'Thất bại. Vui lòng thử lại.'
  );
}

type Phase = 'opening' | 'idle' | 'recording' | 'submitting' | 'success' | 'error';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [phase, setPhase] = useState<Phase>('opening');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordProgress, setRecordProgress] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    setPhase('opening');
    setErrorMsg(null);
    setRecordProgress(0);

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
        setPhase('idle');
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

  const handleSubmit = useCallback(
    async (base64: string) => {
      setPhase('submitting');
      try {
        const payload = {
          videoBase64: base64,
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
        setErrorMsg(extractApiError(err));
        setPhase('error');
      }
    },
    [mode, geoLocation, geoAccuracy, onSuccess]
  );

  const handleRecord = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : undefined;
    const recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      const base64 = await blobToBase64(blob);
      handleSubmit(base64);
    };

    recorderRef.current = recorder;
    recorder.start();
    setPhase('recording');

    const start = Date.now();
    const progressTimer = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / RECORD_MS) * 100);
      setRecordProgress(pct);
      if (pct >= 100) clearInterval(progressTimer);
    }, 100);

    setTimeout(() => {
      clearInterval(progressTimer);
      setRecordProgress(100);
      if (recorder.state !== 'inactive') recorder.stop();
    }, RECORD_MS);
  }, [handleSubmit]);

  function handleClose() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onClose();
  }

  function handleRetry() {
    setErrorMsg(null);
    setRecordProgress(0);
    setPhase(streamRef.current ? 'idle' : 'opening');
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
            {phase === 'recording' && (
              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                <LinearProgress variant="determinate" value={recordProgress} color="error" sx={{ height: 4 }} />
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
                <Typography variant="caption" sx={{ color: '#fff' }}>Đang xử lý…</Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      <Stack spacing={1.5} sx={{ p: 2.5, bgcolor: 'grey.900' }}>
        {phase === 'idle' && (
          <Button
            variant="contained"
            size="large"
            startIcon={<Iconify icon="mdi:record-circle-outline" />}
            onClick={handleRecord}
          >
            Bắt đầu quay (3 giây)
          </Button>
        )}
        {phase === 'error' && (
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" color="inherit" fullWidth onClick={handleRetry} sx={{ color: 'grey.300', borderColor: 'grey.600' }}>
              Thử lại
            </Button>
            <Button variant="contained" fullWidth onClick={handleClose}>
              Đóng
            </Button>
          </Stack>
        )}
        {phase === 'success' && (
          <Button variant="contained" fullWidth onClick={handleClose}>
            Đóng
          </Button>
        )}
        {(phase === 'opening' || phase === 'recording' || phase === 'submitting') && (
          <Button variant="text" color="inherit" onClick={handleClose} sx={{ color: 'grey.400' }}>
            Huỷ
          </Button>
        )}
      </Stack>
    </Dialog>
  );
}
