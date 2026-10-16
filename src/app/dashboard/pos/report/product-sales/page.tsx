import { paths } from 'src/routes/paths';

import { ReportProductSalesView } from 'src/sections/pos/report/view';
import ReportPageGuard from 'src/sections/pos/report/report-page-guard';

export const metadata = { title: 'Sản phẩm bán chạy' };

export default function ReportProductSalesPage() {
  return (
    <ReportPageGuard path={paths.dashboard.pos.report.productSales}>
      <ReportProductSalesView />
    </ReportPageGuard>
  );
}
