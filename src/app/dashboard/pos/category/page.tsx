import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function CategoryPage() {
  redirect(paths.dashboard.pos.category.list);
}
