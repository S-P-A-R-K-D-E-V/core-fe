import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function CustomerPage() {
  redirect(paths.dashboard.pos.customer.list);
}
