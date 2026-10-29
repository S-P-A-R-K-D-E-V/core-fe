'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import type { SignatureStrokes } from 'src/api/hr';

// ----------------------------------------------------------------------
// Khung ký tay (canvas + pointer events: chuột, bút, ngón tay). Ghi nét vẽ dạng toạ độ [x, y] theo kích thước khung
// (width × height) — máy chủ tự dựng SVG từ nét, không gửi ảnh. Giới hạn ≤ 100 nét, ≤ 5000 điểm (bỏ điểm sát nhau).
// ----------------------------------------------------------------------

export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 200;
const MAX_STROKES = 100;
const MAX_POINTS = 5000;
const MIN_STEP = 1.5;

/** Có nét ký thật (ít nhất một nét ≥ 2 điểm). */
export const hasSignature = (strokes: SignatureStrokes) => strokes.some((s) => s.length >= 2);

const round = (v: number) => Math.round(v * 10) / 10;

export function SignaturePad({
  value,
  onChange,
  disabled,
}: {
  value: SignatureStrokes;
  onChange: (strokes: SignatureStrokes) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  // Nét hiện tại giữ trong ref: nhiều sự kiện di chuyển tới trước khi kịp vẽ lại thì không mất điểm.
  const strokes = useRef(value);
  strokes.current = value;
  const [, setTick] = useState(0);

  // Vẽ lại toàn bộ nét (mở lại khung, xoá ký lại).
  useEffect(() => {
    const ctx = canvasRef.current?.getContext?.('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b1f5c';
    value.forEach((stroke) => {
      if (stroke.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0][0], stroke[0][1]);
      stroke.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
      if (stroke.length === 1) ctx.lineTo(stroke[0][0] + 0.1, stroke[0][1]);
      ctx.stroke();
    });
  }, [value]);

  const pointOf = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width ? SIGNATURE_WIDTH / rect.width : 1;
    const sy = rect.height ? SIGNATURE_HEIGHT / rect.height : 1;
    const x = (Number(e.clientX) || 0) - rect.left;
    const y = (Number(e.clientY) || 0) - rect.top;
    return [
      round(Math.min(SIGNATURE_WIDTH, Math.max(0, x * sx))),
      round(Math.min(SIGNATURE_HEIGHT, Math.max(0, y * sy))),
    ];
  };

  const totalPoints = () => strokes.current.reduce((n, s) => n + s.length, 0);

  const update = (next: SignatureStrokes) => {
    strokes.current = next;
    onChange(next);
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || strokes.current.length >= MAX_STROKES || totalPoints() >= MAX_POINTS) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    update([...strokes.current, [pointOf(e)]]);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const current = strokes.current;
    if (!drawing.current || disabled || current.length === 0 || totalPoints() >= MAX_POINTS) return;
    const p = pointOf(e);
    const last = current[current.length - 1];
    const prev = last[last.length - 1];
    if (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) < MIN_STEP) return;
    update([...current.slice(0, -1), [...last, p]]);
  };

  const end = () => {
    drawing.current = false;
    setTick((t) => t + 1);
  };

  return (
    <Stack spacing={1}>
      <Box
        sx={{
          position: 'relative',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: '#fff',
          width: '100%',
          maxWidth: SIGNATURE_WIDTH,
          aspectRatio: `${SIGNATURE_WIDTH} / ${SIGNATURE_HEIGHT}`,
        }}
      >
        <canvas
          ref={canvasRef}
          data-testid="signature-pad"
          aria-label="Khung ký tên"
          width={SIGNATURE_WIDTH}
          height={SIGNATURE_HEIGHT}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          style={{ width: '100%', height: '100%', touchAction: 'none', cursor: disabled ? 'default' : 'crosshair' }}
        />
        {value.length === 0 && (
          <Typography
            variant="body2"
            color="text.disabled"
            sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
          >
            Ký tên vào đây
          </Typography>
        )}
      </Box>
      <Button size="small" color="inherit" disabled={disabled || value.length === 0} onClick={() => update([])} sx={{ alignSelf: 'flex-start' }}>
        Xoá ký lại
      </Button>
    </Stack>
  );
}
