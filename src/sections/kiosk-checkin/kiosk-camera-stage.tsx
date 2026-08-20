'use client';

import { useEffect } from 'react';

import Box from '@mui/material/Box';

import type { IKioskTrack } from 'src/types/kiosk';

// ----------------------------------------------------------------------

type CandidateLabel = { trackId: string; text: string } | null;

type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  tracks: IKioskTrack[];
  captureWidth: number;
  captureHeight: number;
  /** Chỉ lật gương cho camera trước (selfie-style) — camera sau lật sẽ khiến hình ảnh/chữ
   *  trong khung hình bị ngược, gây khó hiểu. Mặc định true (camera trước). */
  mirror?: boolean;
  /** Tên nhân viên vừa nhận diện được cho 1 track cụ thể — hiện ngay trên khung nhận diện live,
   *  không cần chờ KioskCandidateStage (overlay xác nhận toàn màn). */
  candidateLabel?: CandidateLabel;
};

export default function KioskCameraStage({
  videoRef,
  overlayCanvasRef,
  tracks,
  captureWidth,
  captureHeight,
  mirror = true,
  candidateLabel = null,
}: Props) {
  // Canvas CHỈ vẽ khung bbox — không vẽ chữ ở đây nữa. bbox trả về là pixel [x1,y1,x2,y2] theo
  // đúng kích thước frame đã gửi lên (captureWidth/Height), canvas cùng kích thước đó nên vẽ
  // thẳng 1:1. Canvas nằm TRONG lớp bị CSS scaleX(-1) (mirror) nên khung tự lật đúng theo video,
  // không cần xử lý gì thêm.
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    canvas.width = captureWidth;
    canvas.height = captureHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(2, captureWidth / 160);
    ctx.strokeStyle = tracks.length > 1 ? '#FFAB00' : '#00A76F';
    tracks.forEach((track) => {
      const [x1, y1, x2, y2] = track.bbox;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    });
  }, [tracks, overlayCanvasRef, captureWidth, captureHeight]);

  // Nhãn tên vẽ bằng 1 <Box> HTML riêng, NẰM NGOÀI lớp bị mirror (không phải vẽ chữ ngược trong
  // canvas rồi tự lật lại bằng ctx.scale — dễ sai vị trí/kích thước khi label rộng hơn box, nhất
  // là gần mép khung hình). Vị trí tính bằng % dựa trên bbox gốc (KHÔNG mirror) so với
  // captureWidth/Height — tự quy đổi cạnh trái đúng khi mirror=true thay vì dựa vào CSS transform.
  const labelTrack = candidateLabel ? tracks.find((t) => t.trackId === candidateLabel.trackId) : undefined;
  const labelLeftPercent = labelTrack
    ? ((mirror ? captureWidth - labelTrack.bbox[2] : labelTrack.bbox[0]) / captureWidth) * 100
    : 0;
  const labelTopPercent = labelTrack ? (labelTrack.bbox[1] / captureHeight) * 100 : 0;

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

      {labelTrack && candidateLabel && (
        <Box
          sx={{
            position: 'absolute',
            left: `${labelLeftPercent}%`,
            top: `${labelTopPercent}%`,
            transform: 'translateY(-100%)',
            mt: '-4px',
            bgcolor: '#00A76F',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 1.6,
            px: 1,
            borderRadius: 0.75,
            whiteSpace: 'nowrap',
            boxShadow: 2,
            zIndex: 2,
          }}
        >
          {candidateLabel.text}
        </Box>
      )}
    </Box>
  );
}
