'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { useKioskHub } from 'src/hooks/use-kiosk-hub';
import { useKioskDevice } from 'src/hooks/use-kiosk-device';
import { confirmKioskCheckIn, confirmKioskCheckOut } from 'src/api/kiosk';
import { kioskDebugLog, clearKioskDebugLog } from 'src/utils/kiosk-debug-log';

import KioskPairingSetup from '../kiosk-pairing-setup';
import KioskCameraStage from '../kiosk-camera-stage';
import KioskStatusBanner from '../kiosk-status-banner';
import KioskCandidateStage from '../kiosk-candidate-stage';

// ----------------------------------------------------------------------

// Khớp KioskSettings.AutoConfirmSeconds phía Core-be (mặc định 4s) — không có endpoint config
// để đồng bộ động, hardcode và ghi chú rõ để không lệch âm thầm nếu BE đổi giá trị.
const AUTO_CONFIRM_SECONDS = 4;

// Heuristic phía client cho "không nhận diện được sau nhiều lần thử" — BE không gửi tín hiệu
// lỗi riêng cho track không khớp (best-effort, im lặng). Coi 1 track EMBEDDED quá lâu mà chưa
// từng có candidate_found là 1 lần thất bại; đủ ngưỡng thì gợi ý liên hệ quản lý.
const FAIL_THRESHOLD_MS = 8000;
const FAIL_COUNT_LIMIT = 3;

export default function KioskCheckinView() {
  const { enqueueSnackbar } = useSnackbar();
  const { deviceKey, setDeviceKey, clearDeviceKey } = useKioskDevice();

  const {
    connectionState,
    tracks,
    candidate,
    error,
    clearCandidate,
    clearError,
    sendFrame,
  } = useKioskHub(deviceKey);

  // ── Camera ────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureDims, setCaptureDims] = useState({ width: 640, height: 480 });
  // Camera trước/sau — nhớ lựa chọn qua reload (kiosk thường gắn cố định, chỉnh 1 lần khi lắp).
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(() =>
    typeof window !== 'undefined'
      ? (localStorage.getItem('kioskCameraFacing') as 'user' | 'environment') || 'user'
      : 'user'
  );

  function toggleFacingMode() {
    setFacingMode((prev) => {
      const next = prev === 'user' ? 'environment' : 'user';
      localStorage.setItem('kioskCameraFacing', next);
      return next;
    });
  }

  // ── Xem log debug ngay trên màn hình — kiosk thường chạy trên điện thoại/tablet, không mở
  // được DevTools để soi lý do reconnect/lỗi kết nối. Tự refresh khi đang mở để "theo dõi" live.
  const [logOpen, setLogOpen] = useState(false);
  const [logText, setLogText] = useState('');
  const [logCopied, setLogCopied] = useState(false);

  function formatDebugLog() {
    return kioskDebugLog.map((e) => `[${e.ts.slice(11, 23)}] ${e.msg}`).join('\n') || '(chưa có log)';
  }

  useEffect(() => {
    if (!logOpen) return undefined;
    setLogText(formatDebugLog());
    const interval = setInterval(() => setLogText(formatDebugLog()), 500);
    return () => clearInterval(interval);
  }, [logOpen]);

  async function copyDebugLog() {
    try {
      await navigator.clipboard.writeText(logText);
      setLogCopied(true);
      setTimeout(() => setLogCopied(false), 2000);
    } catch {
      // Clipboard API có thể bị chặn — người dùng vẫn bôi đen thủ công trong TextField.
    }
  }

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
      });
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
      setCameraError('Không thể mở camera. Vui lòng cấp quyền truy cập camera cho trình duyệt.');
    }
  }, [facingMode]);

  useEffect(() => {
    if (!deviceKey) return undefined;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [deviceKey, startCamera]);

  // Vòng lặp gửi frame ~6-7fps (150ms) — đủ cho preview live tracking, không cần 30fps vì đây
  // không phải video call. Dừng khi tab ẩn để tiết kiệm CPU.
  useEffect(() => {
    if (!cameraReady) return undefined;
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
  }, [cameraReady, captureDims, sendFrame]);

  // ── Multiple-faces guard + candidate validity ───────────────────────────
  const multipleFaces = tracks.length > 1;
  const showCandidate =
    !!candidate && tracks.length === 1 && tracks[0].trackId === candidate.trackId;

  // Mất track hoặc có >1 người xuất hiện giữa lúc đang xác nhận → huỷ ngay, quay lại màn chờ.
  useEffect(() => {
    if (!candidate) return;
    const stillValid = tracks.length === 1 && tracks[0].trackId === candidate.trackId;
    if (!stillValid) clearCandidate();
  }, [tracks, candidate, clearCandidate]);

  // ── Fail heuristic ───────────────────────────────────────────────────
  const embeddedSinceRef = useRef<Map<string, number>>(new Map());
  const resolvedTrackIdsRef = useRef<Set<string>>(new Set());
  const failCountRef = useRef(0);
  const [showFailHint, setShowFailHint] = useState(false);

  useEffect(() => {
    tracks.forEach((t) => {
      if (t.state === 'EMBEDDED' && !embeddedSinceRef.current.has(t.trackId)) {
        embeddedSinceRef.current.set(t.trackId, Date.now());
      }
    });
  }, [tracks]);

  useEffect(() => {
    if (candidate) resolvedTrackIdsRef.current.add(candidate.trackId);
  }, [candidate]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      embeddedSinceRef.current.forEach((since, trackId) => {
        if (now - since > FAIL_THRESHOLD_MS) {
          embeddedSinceRef.current.delete(trackId);
          if (!resolvedTrackIdsRef.current.has(trackId)) {
            failCountRef.current += 1;
            if (failCountRef.current >= FAIL_COUNT_LIMIT) setShowFailHint(true);
          }
        }
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Countdown + auto-confirm ────────────────────────────────────────────
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CONFIRM_SECONDS);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!candidate || !deviceKey) return;
    setConfirming(true);
    try {
      const fn = candidate.isCheckIn ? confirmKioskCheckIn : confirmKioskCheckOut;
      await fn(candidate.staffId, deviceKey);
      enqueueSnackbar(
        `Đã ${candidate.isCheckIn ? 'chấm công vào' : 'chấm công ra'} cho ${candidate.staffName}`,
        { variant: 'success' }
      );
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Chấm công thất bại', { variant: 'error' });
    } finally {
      setConfirming(false);
      clearCandidate();
    }
  }, [candidate, deviceKey, clearCandidate, enqueueSnackbar]);

  useEffect(() => {
    if (!showCandidate) {
      setSecondsLeft(AUTO_CONFIRM_SECONDS);
      return undefined;
    }
    setSecondsLeft(AUTO_CONFIRM_SECONDS);
    const start = Date.now();
    const timer = setInterval(() => {
      const left = AUTO_CONFIRM_SECONDS - Math.floor((Date.now() - start) / 1000);
      if (left <= 0) {
        clearInterval(timer);
        setSecondsLeft(0);
        handleConfirm();
      } else {
        setSecondsLeft(left);
      }
    }, 250);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCandidate, candidate?.trackId]);

  // ── Render ───────────────────────────────────────────────────────────
  if (!deviceKey) {
    return <KioskPairingSetup onSubmit={setDeviceKey} />;
  }

  if (cameraError) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.900',
          color: 'common.white',
          p: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="h5">{cameraError}</Typography>
        <Button variant="contained" onClick={startCamera}>
          Thử lại
        </Button>
        <Button variant="outlined" color="inherit" onClick={toggleFacingMode}>
          Đổi camera ({facingMode === 'user' ? 'trước' : 'sau'})
        </Button>
        <Button variant="text" color="inherit" onClick={clearDeviceKey}>
          Đổi thiết bị
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'grey.900',
        color: 'common.white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 2,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="center">
        <Typography variant="h4" sx={{ mr: 1 }}>Kiosk Chấm Công</Typography>
        <Button size="small" color="inherit" onClick={toggleFacingMode}>
          Đổi camera ({facingMode === 'user' ? 'trước' : 'sau'})
        </Button>
        <Button size="small" color="inherit" onClick={clearDeviceKey}>
          Đổi thiết bị
        </Button>
        <IconButton size="small" color="inherit" onClick={() => setLogOpen(true)} title="Xem log debug">
          <Iconify icon="mdi:bug-outline" />
        </IconButton>
      </Stack>

      <Box sx={{ position: 'relative', width: '100%', maxWidth: 720 }}>
        <KioskCameraStage
          videoRef={videoRef}
          overlayCanvasRef={overlayCanvasRef}
          tracks={tracks}
          captureWidth={captureDims.width}
          captureHeight={captureDims.height}
          mirror={facingMode === 'user'}
          candidateLabel={candidate ? { trackId: candidate.trackId, text: candidate.staffName } : null}
        />

        <Stack spacing={1} sx={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 5 }}>
          {connectionState === 'disconnected' && (
            <KioskStatusBanner severity="error" message="Mất kết nối máy chủ." />
          )}
          {connectionState === 'reconnecting' && (
            <KioskStatusBanner severity="warning" message="Đang kết nối lại..." />
          )}
          {error && (
            <Box onClick={clearError} sx={{ cursor: 'pointer' }}>
              <KioskStatusBanner severity="error" message={error} />
            </Box>
          )}
          {multipleFaces && !showCandidate && (
            <KioskStatusBanner severity="warning" message="Vui lòng xếp hàng, mỗi lần 1 người." />
          )}
          {showFailHint && (
            <KioskStatusBanner
              severity="warning"
              message="Không nhận diện được. Vui lòng liên hệ quản lý để chấm công thủ công."
            />
          )}
        </Stack>

        {showCandidate && candidate && (
          <KioskCandidateStage
            staffName={candidate.staffName}
            staffAvatarUrl={candidate.staffAvatarUrl}
            isCheckIn={candidate.isCheckIn}
            secondsLeft={secondsLeft}
            totalSeconds={AUTO_CONFIRM_SECONDS}
            onCancel={clearCandidate}
          />
        )}
      </Box>

      <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

      <Dialog open={logOpen} onClose={() => setLogOpen(false)} maxWidth="sm" fullWidth fullScreen>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Log debug kiosk
          <IconButton onClick={() => setLogOpen(false)} size="small">
            <Iconify icon="mdi:close" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Tự cập nhật mỗi 0.5s trong lúc mở — để nguyên màn này khi hiện tượng đang xảy ra. Bôi
            đen để copy thủ công nếu nút Copy không hoạt động.
          </Typography>
          <TextField
            value={logText}
            multiline
            fullWidth
            minRows={16}
            maxRows={40}
            InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 11 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              clearKioskDebugLog();
              setLogText(formatDebugLog());
            }}
          >
            Xoá log
          </Button>
          <Button onClick={copyDebugLog} startIcon={<Iconify icon={logCopied ? 'mdi:check' : 'mdi:content-copy'} />}>
            {logCopied ? 'Đã copy' : 'Copy'}
          </Button>
          <Button variant="contained" onClick={() => setLogOpen(false)}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
