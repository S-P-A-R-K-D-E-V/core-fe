import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function PurchaseOrderPage() {
  redirect(paths.dashboard.pos.purchaseOrder.list);
}
