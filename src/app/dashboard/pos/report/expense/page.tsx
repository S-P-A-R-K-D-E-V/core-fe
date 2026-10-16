import { paths } from 'src/routes/paths';

import { ReportExpenseView } from 'src/sections/pos/report/view';
import ReportPageGuard from 'src/sections/pos/report/report-page-guard';

export const metadata = { title: 'Báo cáo chi phí' };

export default function ReportExpensePage() {
  return (
    <ReportPageGuard path={paths.dashboard.pos.report.expense}>
      <ReportExpenseView />
    </ReportPageGuard>
  );
}
