import { paths } from 'src/routes/paths';

import { ReportDebtView } from 'src/sections/pos/report/view';
import ReportPageGuard from 'src/sections/pos/report/report-page-guard';

export const metadata = { title: 'Công nợ' };

export default function ReportDebtPage() {
  return (
    <ReportPageGuard path={paths.dashboard.pos.report.debt}>
      <ReportDebtView />
    </ReportPageGuard>
  );
}
