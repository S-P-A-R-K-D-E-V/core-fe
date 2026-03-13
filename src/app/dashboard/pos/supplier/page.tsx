import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function SupplierPage() {
  redirect(paths.dashboard.pos.supplier.list);
}
