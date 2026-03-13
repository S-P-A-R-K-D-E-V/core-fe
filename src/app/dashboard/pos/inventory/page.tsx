import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function InventoryPage() {
  redirect(paths.dashboard.pos.inventory.list);
}
