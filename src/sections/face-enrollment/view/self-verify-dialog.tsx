'use client';

import { useEffect, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import Iconify from 'src/components/iconify';
import { useSelfVerifyHub } from 'src/hooks/use-self-verify-hub';

// ----------------------------------------------------------------------
// Live camera GIỐNG TRẢI NGHIỆM KIOSK (xem kiosk-checkin-view.tsx) thay cho luồng quay video 3s
// cũ — tự nhận diện liên tục, hiện ngay khớp/không khớp + % tương đồng, không cần bấm quay/chờ xử
// lý. KHÔNG check-in, thuần chẩn đoán (xem SelfVerifyStreamCommand phía BE).

const COLOR_MATCHED = '#00A76F';
const COLOR_NOT_MATCHED = '#FF5630';
const COLOR_DETECTING = '#919EAB';
const COLOR_MULTI_FACE = '#FFAB00';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SelfVerifyDialog({ open, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureDims, setCaptureDims] = useState({ width: 640, height: 480 });

  const { connectionState, tracks, verifyResult, error, clearError, sendFrame } = useSelfVerifyHub(open);

  // ── Camera lifecycle — mở khi dialog mở, tắt hẳn khi đóng. ──────────────
  useEffect(() => {
    if (!open) return undefined;
    setCameraError(null);
    setCameraReady(false);

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
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              setCaptureDims({
                width: videoRef.current.videoWidth || 640,
                height: videoRef.current.videoHeight || 480,
              });
            }
            setCameraReady(true);
          };
        }
      } catch {
        setCameraError('Không thể mở camera. Vui lòng cấp quyền truy cập camera.');
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  // ── Vòng lặp gửi frame ~6-7fps — giống kiosk-checkin-view.tsx. ──────────
  useEffect(() => {
    if (!cameraReady || connectionState !== 'connected') return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      canvas.width = captureDims.width;
      canvas.height = captureDims.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      if (base64) sendFrame(base64);
    }, 150);
    return () => clearInterval(interval);
  }, [cameraReady, connectionState, captureDims, sendFrame]);

  // ── Vẽ khung bbox — 1 khuôn mặt duy nhất, màu theo kết quả verify. ──────
  const multiFace = tracks.length > 1;
  const soloTrack = tracks.length === 1 ? tracks[0] : undefined;
  const soloResult = soloTrack && verifyResult?.trackId === soloTrack.trackId ? verifyResult : undefined;

  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    canvas.width = captureDims.width;
    canvas.height = captureDims.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!soloTrack) return;
    const color = multiFace
      ? COLOR_MULTI_FACE
      : soloResult
        ? soloResult.matched
          ? COLOR_MATCHED
          : COLOR_NOT_MATCHED
        : COLOR_DETECTING;
    const [x1, y1, x2, y2] = soloTrack.bbox;
    ctx.lineWidth = Math.max(2, captureDims.width / 160);
    ctx.strokeStyle = color;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }, [soloTrack, soloResult, multiFace, captureDims]);

  function statusNode() {
    if (multiFace)
      return <Alert severity="warning">Chỉ 1 người trong khung hình một lúc.</Alert>;
    if (!soloTrack)
      return (
        <Typography variant="body2" sx={{ color: 'grey.400', textAlign: 'center' }}>
          Đưa khuôn mặt vào khung hình
        </Typography>
      );
    if (!soloResult)
      return (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
          <CircularProgress size={16} sx={{ color: 'grey.400' }} />
          <Typography variant="body2" sx={{ color: 'grey.400' }}>Đang nhận diện...</Typography>
        </Stack>
      );
    return (
      <Stack alignItems="center" spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Iconify
            icon={soloResult.matched ? 'mdi:check-decagram' : 'mdi:close-circle-outline'}
            width={28}
            sx={{ color: soloResult.matched ? 'success.main' : 'error.main' }}
          />
          <Typography variant="h6" sx={{ color: '#fff' }}>
            {soloResult.matched ? 'Khớp!' : 'Không khớp'}
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: 'grey.400' }}>
          Độ tương đồng: {Math.round(soloResult.similarity * 100)}%
        </Typography>
      </Stack>
    );
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

      <Box sx={{ position: 'relative', overflow: 'hidden', bgcolor: 'common.black', width: '100%', height: 320 }}>
        {cameraError ? (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 3, textAlign: 'center' }}>
            <Iconify icon="mdi:alert-circle-outline" width={56} sx={{ color: 'error.main' }} />
            <Typography sx={{ color: '#fff' }}>{cameraError}</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ position: 'absolute', inset: 0, transform: 'scaleX(-1)' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <canvas ref={overlayCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            </Box>
            {!cameraReady && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress sx={{ color: '#fff' }} />
              </Box>
            )}
            {cameraReady && connectionState !== 'connected' && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.5)' }}>
                <CircularProgress sx={{ color: '#fff' }} />
                <Typography variant="caption" sx={{ color: '#fff' }}>
                  {connectionState === 'reconnecting' ? 'Đang kết nối lại...' : 'Đang kết nối...'}
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>

      <Stack spacing={1.5} sx={{ p: 2.5, bgcolor: 'grey.900', minHeight: 96, justifyContent: 'center' }}>
        {error && (
          <Alert severity="error" onClose={clearError}>
            {error}
          </Alert>
        )}
        {!cameraError && !error && statusNode()}
        <Button variant="outlined" color="inherit" onClick={onClose} sx={{ color: 'grey.300', borderColor: 'grey.600' }}>
          Đóng
        </Button>
      </Stack>

      <canvas ref={captureCanvasRef} style={{ display: 'none' }} />
    </Dialog>
  );
}
