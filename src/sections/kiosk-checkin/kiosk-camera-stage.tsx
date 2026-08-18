'use client';

import { useEffect } from 'react';

import Box from '@mui/material/Box';

import type { IKioskTrack } from 'src/types/kiosk';

// ----------------------------------------------------------------------

type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  tracks: IKioskTrack[];
  captureWidth: number;
  captureHeight: number;
};

export default function KioskCameraStage({
  videoRef,
  overlayCanvasRef,
  tracks,
  captureWidth,
  captureHeight,
}: Props) {
  // bbox trả về là pixel [x1,y1,x2,y2] theo đúng kích thước frame đã gửi lên (captureWidth/
  // Height) — canvas overlay dùng chung kích thước đó nên vẽ thẳng 1:1, không cần quy đổi tỉ lệ.
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

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${captureWidth} / ${captureHeight}`,
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'common.black',
        // Mirror CẢ video lẫn canvas overlay CÙNG 1 transform — bbox pixel (toạ độ frame gốc
        // chưa mirror) vẽ thẳng lên canvas vẫn khớp vì 2 lớp cùng bị lật giống nhau.
        transform: 'scaleX(-1)',
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
  );
}
