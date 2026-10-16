'use client';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { ForbiddenIllustration } from 'src/assets/illustrations';

import { useAuthContext } from '../hooks';
import { isPlatformFeatureBlocked } from '../platform-features';

// ----------------------------------------------------------------------

type Props = {
  /** Khoá tính năng theo nền tảng (src/auth/platform-features.ts PLATFORM_FEATURES). */
  feature: string;
  /** Tên tính năng trong thông báo, vd "Chấm công". */
  label: string;
  children: React.ReactNode;
};

/**
 * Trang của tính năng chủ cửa hàng có thể tắt trên web theo vai trò (vd tự chấm công): bị tắt với người này thì báo dùng
 * app thay vì để gọi API rồi nhận 403. Chưa tải xong /users/me thì chưa hiện gì.
 */
export default function PlatformFeatureGuard({ feature, label, children }: Props) {
  const { user } = useAuthContext();

  if (!user?.enabledFeatures) return null;

  if (isPlatformFeatureBlocked(user, feature)) {
    return (
      <Container sx={{ textAlign: 'center', py: 5 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          {label} trên web đã tắt
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Cửa hàng yêu cầu bạn dùng app trên điện thoại cho tính năng này. Mở app và đăng nhập bằng tài khoản của bạn.
        </Typography>
        <ForbiddenIllustration sx={{ height: 220, my: { xs: 5, sm: 8 } }} />
      </Container>
    );
  }

  return <>{children}</>;
}
