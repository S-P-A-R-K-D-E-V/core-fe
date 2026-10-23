import Box from '@mui/material/Box';
import { keyframes } from '@mui/material/styles';

// ----------------------------------------------------------------------

// Tuyết rơi chỉ bằng CSS: mỗi bông chỉ đổi transform nên trình duyệt chạy trên luồng compositor — không có JavaScript
// hay vẽ lại trang mỗi khung hình (khác hiệu ứng framer-motion). Vị trí / tốc độ cố định theo thứ tự bông để HTML phía
// server và trình duyệt giống nhau. Điện thoại chỉ hiện một nửa số bông; chọn giảm chuyển động thì không hiện.

const fall = keyframes`
  from { transform: translate3d(0, -10vh, 0); }
  to { transform: translate3d(var(--snow-drift), 110vh, 0); }
`;

const FLAKES = 24;

export function Snowfall() {
  return (
    <Box
      aria-hidden
      sx={{
        inset: 0,
        zIndex: 1200,
        position: 'fixed',
        overflow: 'hidden',
        pointerEvents: 'none',
        '@media (prefers-reduced-motion: reduce)': { display: 'none' },
      }}
    >
      {Array.from({ length: FLAKES }, (_, i) => {
        // Rải đều theo chiều ngang, xáo bằng phép nhân với số nguyên tố để không thành hàng.
        const left = ((i * 37) % 100) + (i % 3) * 0.7;
        const size = 6 + ((i * 7) % 6);
        const duration = 10 + ((i * 13) % 9);
        const delay = -((i * 29) % 17);
        const drift = ((i * 11) % 9) * 6 - 24;
        // Cứ ba bông có một bông hình ❄ (chữ, không phải ảnh); còn lại là chấm tuyết có viền xám nhạt để thấy được
        // trên nền sáng.
        const crystal = i % 3 === 0;
        return (
          <Box
            key={i}
            component="span"
            style={{ '--snow-drift': `${drift}px` } as React.CSSProperties}
            sx={{
              top: 0,
              left: `${left}%`,
              position: 'absolute',
              opacity: 0.7 + (i % 3) * 0.1,
              animation: `${fall} ${duration}s linear ${delay}s infinite`,
              ...(crystal
                ? {
                    lineHeight: 1,
                    color: '#93C5FD',
                    fontSize: size * 2,
                    textShadow: '0 1px 3px rgba(30, 64, 175, 0.35)',
                  }
                : {
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle at 35% 35%, #FFFFFF 45%, #E0F2FE 100%)',
                    boxShadow:
                      '0 0 0 1px rgba(148, 163, 184, 0.35), 0 1px 4px rgba(71, 85, 105, 0.35)',
                  }),
              ...(i % 2 === 1 && { display: { xs: 'none', md: 'block' } }),
            }}
          >
            {/* U+FE0E: hiện dạng chữ, không thành emoji màu. */}
            {crystal ? '❄︎' : null}
          </Box>
        );
      })}
    </Box>
  );
}
