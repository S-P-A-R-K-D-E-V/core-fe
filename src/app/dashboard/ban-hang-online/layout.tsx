import FeatureGuard from 'src/auth/guard/feature-guard';

// ----------------------------------------------------------------------
// Bán hàng online là tính năng riêng (social.selling = FEATURE.socialSelling): cửa hàng chưa bật thì báo chưa bật thay vì
// gọi API (403). Viết thẳng chuỗi: layout là server component, không đọc được hằng từ module 'use client'
// (use-feature-enabled) — Next build lỗi "Could not find the module … in the React Client Manifest".

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGuard feature="social.selling">{children}</FeatureGuard>;
}
