'use client';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { ForbiddenIllustration } from 'src/assets/illustrations';

import { useAuthContext } from '../hooks';

// ----------------------------------------------------------------------

type Props = {
  /** Khoá tính năng (src/hooks/use-feature-enabled FEATURE). */
  feature: string;
  children: React.ReactNode;
};

/**
 * Trang của tính năng theo gói: cửa hàng chưa bật thì báo chưa bật thay vì gọi API (sẽ bị 403).
 * Chưa tải xong /users/me thì chưa hiện gì.
 */
export default function FeatureGuard({ feature, children }: Props) {
  const { user } = useAuthContext();
  const enabled = user?.enabledFeatures as string[] | undefined;

  if (!enabled) return null;

  if (!enabled.includes(feature)) {
    return (
      <Container sx={{ textAlign: 'center', py: 5 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Tính năng chưa được bật
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Cửa hàng của bạn chưa đăng ký tính năng này. Liên hệ Spark để bật trong gói dịch vụ.
        </Typography>
        <ForbiddenIllustration sx={{ height: 220, my: { xs: 5, sm: 8 } }} />
      </Container>
    );
  }

  return <>{children}</>;
}
