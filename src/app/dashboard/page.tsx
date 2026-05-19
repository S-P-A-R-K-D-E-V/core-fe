import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------

export default function DashboardRootPage() {
  redirect(paths.dashboard.shiftCash.root);
}
