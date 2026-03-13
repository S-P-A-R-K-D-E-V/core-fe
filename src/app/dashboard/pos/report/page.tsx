import { redirect } from 'next/navigation';
import { paths } from 'src/routes/paths';

export default function ReportPage() {
  redirect(paths.dashboard.pos.report.dashboard);
}
