import FeatureGuard from 'src/auth/guard/feature-guard';

import { FEATURE } from 'src/hooks/use-feature-enabled';

// ----------------------------------------------------------------------
// Bán hàng online là tính năng riêng (social.selling): cửa hàng chưa bật thì báo chưa bật thay vì gọi API (403).

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGuard feature={FEATURE.socialSelling}>{children}</FeatureGuard>;
}
