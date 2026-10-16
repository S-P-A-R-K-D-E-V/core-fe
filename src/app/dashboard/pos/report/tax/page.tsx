import { paths } from 'src/routes/paths';

import { ReportTaxView } from 'src/sections/pos/report/view';
import ReportPageGuard from 'src/sections/pos/report/report-page-guard';

export const metadata = { title: 'Báo cáo thuế theo tháng' };

export default function ReportTaxPage() {
  return (
    <ReportPageGuard path={paths.dashboard.pos.report.tax}>
      <ReportTaxView />
    </ReportPageGuard>
  );
}
