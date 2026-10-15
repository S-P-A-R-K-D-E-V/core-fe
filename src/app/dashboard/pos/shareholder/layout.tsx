import FeatureGuard from 'src/auth/guard/feature-guard';

// ----------------------------------------------------------------------
// Hoạch toán cổ đông: chỉ cửa hàng bật finance.shareholders (hiện là CiCi).

type Props = {
  children: React.ReactNode;
};

export default function ShareholderLayout({ children }: Props) {
  return <FeatureGuard feature="finance.shareholders">{children}</FeatureGuard>;
}
