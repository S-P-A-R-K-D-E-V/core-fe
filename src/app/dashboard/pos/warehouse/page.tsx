import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function WarehousePage() {
  redirect(paths.dashboard.pos.warehouse.list);
}
