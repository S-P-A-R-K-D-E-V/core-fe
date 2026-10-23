import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

// ----------------------------------------------------------------------

/**
 * Hiệu ứng trang trí chạy liên tục (repeat: Infinity — quầng sáng, chữ chuyển sắc, icon nhấp nháy) chỉ bật trên màn hình
 * lớn và khi người dùng không chọn giảm chuyển động. Trên điện thoại chúng chiếm luồng chính suốt lúc tải trang (Lighthouse
 * di động: Total Blocking Time > 1 s). Lúc render phía server luôn tắt.
 */
export function useDecorativeMotion(): boolean {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  return mdUp && !reduceMotion;
}
