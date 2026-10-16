import { paths } from 'src/routes/paths';

import { ReportCustomersView } from 'src/sections/pos/report/view';
import ReportPageGuard from 'src/sections/pos/report/report-page-guard';

export const metadata = { title: 'Báo cáo khách hàng' };

export default function ReportCustomersPage() {
  return (
    <ReportPageGuard path={paths.dashboard.pos.report.customers}>
      <ReportCustomersView />
    </ReportPageGuard>
  );
}
