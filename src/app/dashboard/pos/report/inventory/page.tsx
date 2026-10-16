import { paths } from 'src/routes/paths';

import { ReportInventoryView } from 'src/sections/pos/report/view';
import ReportPageGuard from 'src/sections/pos/report/report-page-guard';

export const metadata = { title: 'Báo cáo tồn kho' };

export default function ReportInventoryPage() {
  return (
    <ReportPageGuard path={paths.dashboard.pos.report.inventory}>
      <ReportInventoryView />
    </ReportPageGuard>
  );
}
