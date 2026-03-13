import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function ProductPage() {
  redirect(paths.dashboard.pos.product.list);
}
