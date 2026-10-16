import { paths } from 'src/routes/paths';

import { ReportBreakEvenView } from 'src/sections/pos/report/view';
import ReportPageGuard from 'src/sections/pos/report/report-page-guard';

export const metadata = { title: 'Điểm hòa vốn' };

export default function ReportBreakEvenPage() {
  return (
    <ReportPageGuard path={paths.dashboard.pos.report.breakEven}>
      <ReportBreakEvenView />
    </ReportPageGuard>
  );
}
