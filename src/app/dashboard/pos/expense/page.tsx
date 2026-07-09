import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function ExpensePage() {
  redirect(paths.dashboard.pos.expense.list);
}
