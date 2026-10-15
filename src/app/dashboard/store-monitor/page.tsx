import FeatureGuard from 'src/auth/guard/feature-guard';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { StoreMonitorView } from 'src/sections/store-monitor/view/store-monitor-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Giám sát cửa hàng',
};

export default function StoreMonitorPage() {
  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <FeatureGuard feature="store.camera">
        <StoreMonitorView />
      </FeatureGuard>
    </RoleBasedGuard>
  );
}
