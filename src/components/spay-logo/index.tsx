import { useId } from 'react';

import Box from '@mui/material/Box';

// ----------------------------------------------------------------------
// Logo S Payment (tia sét chuyển đỏ → hồng) — cùng hình với trang spay.devbyspark.com.
// ----------------------------------------------------------------------

type Props = {
  /** Chiều cao (px); chiều rộng theo tỉ lệ hình. */
  size?: number;
};

export function SPayLogo({ size = 20 }: Props) {
  const gradientId = `spay-bolt-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <Box
      component="svg"
      viewBox="0 0 400 520"
      aria-label="S Payment"
      role="img"
      sx={{ width: Math.round(size * 0.77), height: size, flexShrink: 0, display: 'block' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3150" />
          <stop offset="1" stopColor="#e8146c" />
        </linearGradient>
      </defs>
      <polygon
        points="282,24 30,262 46,306 186,306 110,474 134,496 366,258 348,224 234,224 304,62"
        fill={`url(#${gradientId})`}
        stroke={`url(#${gradientId})`}
        strokeLinejoin="round"
        strokeWidth={26}
      />
    </Box>
  );
}
