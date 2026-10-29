import { PERMISSIONS } from 'src/auth/permissions';
import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { PrintTemplateEditView } from 'src/sections/print-template/view/print-template-edit-view';

// ----------------------------------------------------------------------

export const metadata = {
  title: 'Dashboard: Soạn mẫu in',
};

type Props = {
  params: { id: string };
  /** Mẫu mới (id = "new"): ?kind=receipt | label. */
  searchParams?: { kind?: string };
};

export default function PrintTemplateEditPage({ params, searchParams }: Props) {
  return (
    <RoleBasedGuard hasContent permissions={[PERMISSIONS.sales.printTemplateManage]}>
      <PrintTemplateEditView id={params.id} kind={searchParams?.kind} />
    </RoleBasedGuard>
  );
}
