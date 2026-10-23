import Box from '@mui/material/Box';

// ----------------------------------------------------------------------

// Dây đèn trang trí vắt ngang mép trên đầu trang (mùa lễ). SVG tĩnh: bóng đèn nhấp nháy bằng SVG sẽ bắt trình duyệt vẽ
// lại mỗi khung hình trên luồng chính. Màn hình hẹp cắt bớt hai bên (slice), bóng đèn giữ nguyên hình.

const WIDTH = 1200;
const SPAN = 200; // khoảng cách hai móc treo
const SAG = 34; // độ võng giữa hai móc
const TOP = 4;
const BULBS_PER_SPAN = 5;

/** Điểm trên đoạn cong bậc hai từ (x0, TOP) qua điểm điều khiển (x0 + SPAN/2, TOP + 2·SAG) tới (x0 + SPAN, TOP). */
function pointOn(x0: number, t: number) {
  const x = x0 + SPAN * t;
  const y = TOP + 2 * SAG * 2 * t * (1 - t);
  // Hướng tiếp tuyến để bóng đèn treo nghiêng theo dây.
  const slope = (2 * SAG * 2 * (1 - 2 * t)) / SPAN;
  return { x, y, angle: (Math.atan(slope) * 180) / Math.PI };
}

export function StringLights({ colors }: { colors: string[] }) {
  const spans = WIDTH / SPAN;
  const wire = Array.from({ length: spans }, (_, i) => {
    const x0 = i * SPAN;
    return `${i === 0 ? `M${x0} ${TOP}` : ''} Q${x0 + SPAN / 2} ${TOP + 2 * SAG} ${x0 + SPAN} ${TOP}`;
  }).join(' ');

  const bulbs = Array.from({ length: spans * BULBS_PER_SPAN }, (_, k) => {
    const span = Math.floor(k / BULBS_PER_SPAN);
    const t = ((k % BULBS_PER_SPAN) + 0.5) / BULBS_PER_SPAN;
    return { ...pointOn(span * SPAN, t), color: colors[k % colors.length] };
  });

  return (
    <Box
      component="svg"
      aria-hidden
      viewBox={`0 0 ${WIDTH} 64`}
      preserveAspectRatio="xMidYMin slice"
      sx={{
        top: 0,
        left: 0,
        width: 1,
        zIndex: 1,
        position: 'absolute',
        pointerEvents: 'none',
        height: { xs: 44, md: 64 },
      }}
    >
      <path d={wire} fill="none" stroke="#334155" strokeOpacity={0.55} strokeWidth={1.5} />
      {bulbs.map((b, i) => (
        <g
          key={i}
          transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${b.angle.toFixed(1)})`}
        >
          <rect x={-2.5} y={0} width={5} height={5} rx={1} fill="#475569" />
          <ellipse cx={0} cy={11} rx={4.5} ry={7} fill={b.color} />
          <ellipse cx={-1.4} cy={8.5} rx={1.2} ry={2.4} fill="#fff" fillOpacity={0.55} />
          <circle cx={0} cy={11} r={11} fill={b.color} fillOpacity={0.14} />
        </g>
      ))}
    </Box>
  );
}
