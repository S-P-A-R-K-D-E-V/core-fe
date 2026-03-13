import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function SalesOrderPage() {
  redirect(paths.dashboard.pos.salesOrder.list);
}
