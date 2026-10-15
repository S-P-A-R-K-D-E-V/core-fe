import FeatureGuard from 'src/auth/guard/feature-guard';
import { StoreMonitorView } from 'src/sections/store-monitor/view/store-monitor-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Giám sát cửa hàng',
};

export default function StoreMonitorPage() {
  return (
    <FeatureGuard feature="store.camera">
      <StoreMonitorView />
    </FeatureGuard>
  );
}
