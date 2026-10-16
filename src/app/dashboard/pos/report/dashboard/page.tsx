import { paths } from 'src/routes/paths';

import { ReportDashboardView } from 'src/sections/pos/report/view';
import ReportPageGuard from 'src/sections/pos/report/report-page-guard';

export const metadata = { title: 'Tổng quan POS' };

export default function ReportDashboardPage() {
  return (
    <ReportPageGuard path={paths.dashboard.pos.report.dashboard}>
      <ReportDashboardView />
    </ReportPageGuard>
  );
}
