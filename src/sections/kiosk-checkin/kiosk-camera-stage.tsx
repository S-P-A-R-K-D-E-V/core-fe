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

    // Nhãn tên — vẽ SAU cùng, đè lên box của đúng track vừa khớp. Cả canvas bị CSS scaleX(-1)
    // khi dùng camera trước (mirror=true) nên chữ vẽ trực tiếp sẽ bị ngược; counter-flip NGAY
    // TRONG context trước khi vẽ để 2 lần lật triệt tiêu nhau — vẫn dùng toạ độ bbox gốc, không
    // cần tự tính lại vị trí đối xứng.
    if (candidateLabel) {
      const track = tracks.find((t) => t.trackId === candidateLabel.trackId);
      if (track) {
        const [x1, y1, x2] = track.bbox;
        const fontSize = Math.max(16, Math.round(captureWidth / 26));
        ctx.font = `600 ${fontSize}px sans-serif`;
        const textWidth = ctx.measureText(candidateLabel.text).width;
        const paddingX = 10;
        const labelHeight = fontSize + 12;
        const labelWidth = Math.max(x2 - x1, textWidth + paddingX * 2);
        const labelY = Math.max(0, y1 - labelHeight - 4);

        ctx.save();
        if (mirror) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.fillStyle = '#00A76F';
        ctx.fillRect(x1, labelY, labelWidth, labelHeight);
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.fillText(candidateLabel.text, x1 + paddingX, labelY + labelHeight / 2);
        ctx.restore();
      }
    }
  }, [tracks, overlayCanvasRef, captureWidth, captureHeight, candidateLabel, mirror]);

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
  );
}
