'use client';

import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import { reportPermissionsFor } from './report-access';

// ----------------------------------------------------------------------

/** Chặn một trang báo cáo theo đủ quyền của các API nó gọi (REPORT_PAGES). */
export default function ReportPageGuard({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <RoleBasedGuard hasContent allPermissions={reportPermissionsFor(path)}>
      {children}
    </RoleBasedGuard>
  );
}
