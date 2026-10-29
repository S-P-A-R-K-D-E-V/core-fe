import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// Nhiệm vụ đã gộp vào Việc được giao — link cũ (thông báo, dấu trang) chuyển sang trang mới.

type Props = { searchParams?: { tab?: string } };

export default function HrTasksPage({ searchParams }: Props) {
  redirect(searchParams?.tab === 'mine' ? paths.dashboard.cleaning.myChecklist : paths.dashboard.cleaning.assigned);
}
