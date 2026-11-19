import FeatureGuard from 'src/auth/guard/feature-guard';

// ----------------------------------------------------------------------
// Hộp thư khách thuộc Bán hàng online (social.selling): cửa hàng chưa bật thì báo chưa bật thay vì gọi API (403).
// Viết thẳng chuỗi — layout là server component (xem app/dashboard/ban-hang-online/layout.tsx).

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGuard feature="social.selling">{children}</FeatureGuard>;
}
