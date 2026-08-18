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

import { verifySelfFace } from 'src/api/faceEnrollment';
import type { IVerifySelfResponse } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

const RECORD_MS = 3000;

const REASON_LABELS: Record<string, string> = {
  NO_FACE_DETECTED: 'Không phát hiện khuôn mặt trong video.',
  MULTIPLE_FACES: 'Phát hiện nhiều hơn 1 khuôn mặt.',
  LIVENESS_FAILED: 'Không xác nhận được đây là người thật (liveness).',
  LOW_QUALITY: 'Chất lượng video chưa đủ rõ.',
  LOW_SIMILARITY: 'Khuôn mặt không đủ giống với hồ sơ đã đăng ký.',
  SERVICE_ERROR: 'Dịch vụ nhận diện khuôn mặt gặp sự cố.',
};

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

type Phase = 'opening' | 'idle' | 'recording' | 'processing' | 'result' | 'error';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SelfVerifyDialog({ open, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [phase, setPhase] = useState<Phase>('opening');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<IVerifySelfResponse | null>(null);
  const [recordProgress, setRecordProgress] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    setPhase('opening');
    setResult(null);
    setErrorMsg(null);

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
        if (videoRef.current) videoRef.current.srcObject = stream;
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
      setPhase('processing');
      try {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const base64 = await blobToBase64(blob);
        const res = await verifySelfFace(base64);
        setResult(res);
        setPhase('result');
      } catch (err) {
        setErrorMsg(extractApiError(err));
        setPhase('error');
      }
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
  }, []);

  function handleRetry() {
    setResult(null);
    setErrorMsg(null);
    setRecordProgress(0);
    setPhase(streamRef.current ? 'idle' : 'opening');
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <Box sx={{ bgcolor: 'grey.900', color: '#fff', px: 3, py: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="mdi:face-recognition" width={22} />
          <Typography variant="subtitle1" fontWeight={600}>
            Kiểm tra so khớp khuôn mặt
          </Typography>
        </Stack>
      </Box>

      <Box sx={{ position: 'relative', bgcolor: 'common.black', aspectRatio: '4/3' }}>
        {phase === 'result' || phase === 'error' ? (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              p: 3,
              textAlign: 'center',
            }}
          >
            {phase === 'error' ? (
              <>
                <Iconify icon="mdi:alert-circle-outline" width={56} sx={{ color: 'error.main' }} />
                <Typography sx={{ color: '#fff' }}>{errorMsg}</Typography>
              </>
            ) : result ? (
              <>
                <Iconify
                  icon={result.matched ? 'mdi:check-decagram' : 'mdi:close-circle-outline'}
                  width={56}
                  sx={{ color: result.matched ? 'success.main' : 'error.main' }}
                />
                <Typography variant="h6" sx={{ color: '#fff' }}>
                  {result.matched ? 'Khớp!' : 'Không khớp'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'grey.400' }}>
                  Độ tương đồng: {Math.round(result.similarity * 100)}%
                </Typography>
                {!result.matched && result.reason && (
                  <Typography variant="caption" sx={{ color: 'grey.500' }}>
                    {REASON_LABELS[result.reason] ?? result.reason}
                  </Typography>
                )}
              </>
            ) : null}
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
              <Box
                sx={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <CircularProgress sx={{ color: '#fff' }} />
              </Box>
            )}
            {phase === 'recording' && (
              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                <LinearProgress variant="determinate" value={recordProgress} color="error" sx={{ height: 4 }} />
              </Box>
            )}
            {phase === 'processing' && (
              <Box
                sx={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 1,
                  alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.5)',
                }}
              >
                <CircularProgress sx={{ color: '#fff' }} />
                <Typography variant="caption" sx={{ color: '#fff' }}>Đang kiểm tra…</Typography>
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
        {(phase === 'result' || phase === 'error') && (
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" color="inherit" fullWidth onClick={handleRetry} sx={{ color: 'grey.300', borderColor: 'grey.600' }}>
              Thử lại
            </Button>
            <Button variant="contained" fullWidth onClick={onClose}>
              Đóng
            </Button>
          </Stack>
        )}
        {(phase === 'opening' || phase === 'recording' || phase === 'processing') && (
          <Button variant="text" color="inherit" onClick={onClose} sx={{ color: 'grey.400' }}>
            Huỷ
          </Button>
        )}
      </Stack>
    </Dialog>
  );
}
