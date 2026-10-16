import { paths } from 'src/routes/paths';

import { ReportRevenueView } from 'src/sections/pos/report/view';
import ReportPageGuard from 'src/sections/pos/report/report-page-guard';

export const metadata = { title: 'Báo cáo doanh thu' };

export default function ReportRevenuePage() {
  return (
    <ReportPageGuard path={paths.dashboard.pos.report.revenue}>
      <ReportRevenueView />
    </ReportPageGuard>
  );
}
