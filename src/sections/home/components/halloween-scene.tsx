'use client';

import { m, useScroll, useTransform } from 'framer-motion';

import Box from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';

import { useDecorativeMotion } from 'src/hooks/use-decorative-motion';

// ----------------------------------------------------------------------

// Cảnh Halloween sau tiêu đề đầu trang: trăng, đàn dơi bay ngang, dải đồi có bí ngô và cây khô. Toàn SVG + CSS — dơi bay
// bằng transform (compositor, không JS mỗi khung hình); trăng và đồi trôi lệch nhau theo cuộn trang (parallax) chỉ trên
// màn hình lớn. Chọn giảm chuyển động thì dơi đứng yên.

const fly = keyframes`
  from { transform: translate3d(-12vw, 0, 0); }
  50% { transform: translate3d(50vw, -24px, 0); }
  to { transform: translate3d(112vw, 8px, 0); }
`;

const flap = keyframes`
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.45); }
`;

const BAT =
  'M32 11 C30 7 27 7 26 10 C22 5 14 4 6 9 C10 10 12 13 12 16 C15 14 19 15 21 18 C23 16 26 16 28 19 L32 23 L36 19 C38 16 41 16 43 18 C45 15 49 14 52 16 C52 13 54 10 58 9 C50 4 42 5 38 10 C37 7 34 7 32 11 Z M29 9 L30 5 L31.5 8.5 Z M35 9 L34 5 L32.5 8.5 Z';

const BATS = [
  { top: '14%', size: 54, duration: 18, delay: -2 },
  { top: '22%', size: 34, duration: 24, delay: -11 },
  { top: '9%', size: 26, duration: 29, delay: -19 },
  { top: '30%', size: 40, duration: 21, delay: -6 },
  { top: '18%', size: 22, duration: 33, delay: -25 },
];

function Pumpkin({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x={-3} y={-34} width={6} height={12} rx={2} fill="#3F6212" />
      <ellipse cx={-14} cy={0} rx={18} ry={22} fill="#EA580C" />
      <ellipse cx={14} cy={0} rx={18} ry={22} fill="#EA580C" />
      <ellipse cx={0} cy={0} rx={18} ry={24} fill="#F97316" />
      {/* Mặt cười */}
      <path d="M-15 -6 L-8 -14 L-3 -6 Z M15 -6 L8 -14 L3 -6 Z" fill="#431407" />
      <path d="M-17 4 Q0 20 17 4 Q10 9 6 6 L3 11 L0 7 L-3 11 L-6 6 Q-10 9 -17 4 Z" fill="#431407" />
    </g>
  );
}

export function HalloweenScene() {
  const motion = useDecorativeMotion();
  const { scrollY } = useScroll();
  const moonY = useTransform(scrollY, [0, 600], [0, 140]);
  const hillsY = useTransform(scrollY, [0, 600], [0, -60]);

  return (
    <Box
      aria-hidden
      sx={{
        inset: 0,
        zIndex: 1,
        overflow: 'hidden',
        position: 'absolute',
        pointerEvents: 'none',
        '@media (prefers-reduced-motion: reduce)': { '& .bat, & .bat-wing': { animation: 'none' } },
      }}
    >
      {/* Trăng */}
      <Box
        component={m.div}
        style={{ y: motion ? moonY : 0 }}
        sx={{
          top: { xs: 150, md: '14%' },
          left: { xs: '82%', md: '8%' },
          width: { xs: 56, md: 132 },
          height: { xs: 56, md: 132 },
          borderRadius: '50%',
          position: 'absolute',
          background: 'radial-gradient(circle at 38% 36%, #FFFBEB 0%, #FEF3C7 45%, #FDE68A 100%)',
          boxShadow: '0 0 60px 24px rgba(253, 230, 138, 0.45)',
        }}
      />

      {/* Đàn dơi bay ngang */}
      {BATS.map((b, i) => (
        <Box
          key={i}
          className="bat"
          sx={{
            top: b.top,
            left: 0,
            position: 'absolute',
            animation: `${fly} ${b.duration}s linear ${b.delay}s infinite`,
            ...(i >= 3 && { display: { xs: 'none', md: 'block' } }),
          }}
        >
          <Box
            component="svg"
            className="bat-wing"
            viewBox="0 0 64 28"
            sx={{
              display: 'block',
              width: b.size,
              height: b.size * 0.45,
              animation: `${flap} ${0.32 + i * 0.05}s ease-in-out infinite`,
            }}
          >
            <path d={BAT} fill="#2E1065" fillOpacity={0.78} />
          </Box>
        </Box>
      ))}

      {/* Đồi, cây khô và bí ngô */}
      <Box
        component={m.div}
        style={{ y: motion ? hillsY : 0 }}
        sx={{ left: 0, right: 0, bottom: -2, position: 'absolute' }}
      >
        <Box
          component="svg"
          viewBox="0 0 1440 220"
          preserveAspectRatio="xMidYMax slice"
          sx={{ display: 'block', width: 1, height: { xs: 56, md: 200 } }}
        >
          <path
            d="M0 150 C180 90 320 120 480 140 C640 160 760 80 960 110 C1140 136 1280 90 1440 120 L1440 220 L0 220 Z"
            fill="#7E22CE"
            fillOpacity={0.16}
          />
          <path
            d="M0 180 C200 140 360 170 560 176 C760 182 880 130 1080 150 C1240 166 1340 150 1440 160 L1440 220 L0 220 Z"
            fill="#581C87"
            fillOpacity={0.24}
          />
          {/* Cây khô */}
          <path
            d="M1250 176 L1256 96 L1236 70 M1256 96 L1276 64 M1254 120 L1290 104 M1255 130 L1226 112"
            stroke="#3B0764"
            strokeOpacity={0.45}
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
          />
          <Pumpkin x={210} y={160} scale={1.1} />
          <Pumpkin x={268} y={170} scale={0.7} />
          <Pumpkin x={1120} y={158} scale={0.9} />
        </Box>
      </Box>
    </Box>
  );
}
