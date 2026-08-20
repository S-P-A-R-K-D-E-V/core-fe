'use client';

import { useEffect } from 'react';

import Box from '@mui/material/Box';

import type { IKioskTrack } from 'src/types/kiosk';
import type { KioskTrackCandidate } from 'src/hooks/use-kiosk-hub';

// ----------------------------------------------------------------------

type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  tracks: IKioskTrack[];
  captureWidth: number;
  captureHeight: number;
  /** Chỉ lật gương cho camera trước (selfie-style) — camera sau lật sẽ khiến hình ảnh/chữ
   *  trong khung hình bị ngược, gây khó hiểu. Mặc định true (camera trước). */
  mirror?: boolean;
  /** Danh tính + action gần nhất đã biết theo từng trackId (persist độc lập với vòng đời xác
   *  nhận check-in/out — xem useKioskHub.trackCandidates). */
  trackCandidates: Record<string, KioskTrackCandidate>;
};

// Màu khung theo đúng 2 trục: (1) tracking có thành công không (state pipeline phía
// face-tracking-service), (2) đã nhận diện ra ai chưa và người đó có ca cần chấm công không.
// Ưu tiên từ trên xuống — nhiều khuôn mặt cùng lúc đè hết mọi trạng thái khác (yêu cầu xếp hàng).
const COLOR_MULTI_FACE = '#FFAB00'; // warning — nhiều người cùng lúc, cần xếp hàng
const COLOR_TRACKING_FAILED = '#FF5630'; // error — liveness thất bại (nghi giả mạo/ảnh chụp lại)
const COLOR_HAS_ACTION = '#00A76F'; // success — đã nhận diện, CÓ ca cần chấm công
const COLOR_NO_ACTION = '#00B8D9'; // info — đã nhận diện, KHÔNG có ca cần chấm công
const COLOR_TRACKING = '#919EAB'; // neutral — đang theo dõi/phát hiện, chưa có kết quả

function trackColor(track: IKioskTrack, candidate: KioskTrackCandidate | undefined, multiFace: boolean): string {
  if (multiFace) return COLOR_MULTI_FACE;
  if (candidate) return candidate.action === 'noaction' ? COLOR_NO_ACTION : COLOR_HAS_ACTION;
  if (track.state === 'LIVENESS_FAILED') return COLOR_TRACKING_FAILED;
  return COLOR_TRACKING;
}

function statusText(track: IKioskTrack, candidate: KioskTrackCandidate | undefined): string {
  if (candidate) return candidate.action === 'noaction' ? 'Không có ca' : 'Có ca';
  if (track.state === 'LIVENESS_FAILED') return 'Không xác thực được khuôn mặt';
  return 'Đang nhận diện...';
}

export default function KioskCameraStage({
  videoRef,
  overlayCanvasRef,
  tracks,
  captureWidth,
  captureHeight,
  mirror = true,
  trackCandidates,
}: Props) {
  const multiFace = tracks.length > 1;

  // Canvas CHỈ vẽ khung bbox, màu theo từng track — không vẽ chữ ở đây (xem 2 <Box> HTML overlay
  // bên dưới, nằm ngoài lớp bị mirror nên không cần double-transform để chữ khỏi bị ngược).
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    canvas.width = captureWidth;
    canvas.height = captureHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(2, captureWidth / 160);
    tracks.forEach((track) => {
      const [x1, y1, x2, y2] = track.bbox;
      ctx.strokeStyle = trackColor(track, trackCandidates[track.trackId], multiFace);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    });
  }, [tracks, overlayCanvasRef, captureWidth, captureHeight, trackCandidates, multiFace]);

  // Tên + trạng thái chỉ hiện khi ĐÚNG 1 khuôn mặt (giữ đúng ràng buộc "mỗi lần 1 người" của toàn
  // luồng kiosk) — vị trí tính bằng % dựa trên bbox GỐC (chưa mirror) so với captureWidth/Height,
  // tự quy đổi cạnh trái đúng khi mirror=true bằng tay (captureWidth - x2) thay vì dựa vào CSS
  // transform + canvas transform chồng nhau (cách cũ dễ lệch vị trí/tràn khung khi label dài).
  const soloTrack = tracks.length === 1 ? tracks[0] : undefined;
  const soloCandidate = soloTrack ? trackCandidates[soloTrack.trackId] : undefined;
  const leftPercent = soloTrack
    ? ((mirror ? captureWidth - soloTrack.bbox[2] : soloTrack.bbox[0]) / captureWidth) * 100
    : 0;
  const topPercent = soloTrack ? (soloTrack.bbox[1] / captureHeight) * 100 : 0;
  const bottomPercent = soloTrack ? (soloTrack.bbox[3] / captureHeight) * 100 : 0;
  const color = soloTrack ? trackColor(soloTrack, soloCandidate, false) : COLOR_TRACKING;

  const badgeSx = {
    position: 'absolute' as const,
    left: `${leftPercent}%`,
    bgcolor: color,
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    lineHeight: 1.6,
    px: 1,
    borderRadius: 0.75,
    whiteSpace: 'nowrap' as const,
    boxShadow: 2,
    zIndex: 2,
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${captureWidth} / ${captureHeight}`,
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'common.black',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          // Mirror CẢ video lẫn canvas overlay CÙNG 1 transform — bbox pixel (toạ độ frame gốc
          // chưa mirror) vẽ thẳng lên canvas vẫn khớp vì 2 lớp cùng bị lật giống nhau.
          transform: mirror ? 'scaleX(-1)' : 'none',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
        />
        <canvas
          ref={overlayCanvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      </Box>

      {soloTrack && soloCandidate && (
        // Tên — chỉ hiện khi ĐÃ nhận diện được (chưa có candidate thì chưa biết tên).
        <Box sx={{ ...badgeSx, top: `${topPercent}%`, transform: 'translateY(-100%)', mt: '-4px' }}>
          {soloCandidate.name}
        </Box>
      )}
      {soloTrack && (
        // Trạng thái — LUÔN hiện khi có đúng 1 khuôn mặt, kể cả trước khi nhận diện xong (báo
        // "Đang nhận diện...") để người đứng trước cam biết hệ thống đang xử lý, không phải đứng
        // im không rõ chuyện gì đang xảy ra.
        <Box sx={{ ...badgeSx, top: `${bottomPercent}%`, mt: '4px' }}>
          {statusText(soloTrack, soloCandidate)}
        </Box>
      )}
    </Box>
  );
}
