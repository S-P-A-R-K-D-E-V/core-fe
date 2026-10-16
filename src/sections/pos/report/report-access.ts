import { paths } from 'src/routes/paths';

import { PERMISSIONS, hasPermission, hasAllPermissions } from 'src/auth/permissions';

// ----------------------------------------------------------------------
// Trang báo cáo ↔ quyền: mỗi trang cần ĐỦ quyền của các API nó gọi (Core-be /reports/*, [RequirePermission]). Dùng chung
// cho menu, layout /dashboard/pos/report và trang mở mặc định.
// ----------------------------------------------------------------------

const A = PERMISSIONS.analytics;

export type ReportPage = { path: string; title: string; permissions: readonly string[] };

export const REPORT_PAGES: readonly ReportPage[] = [
  // Tổng quan tài chính gọi doanh thu + chi phí + hoà vốn.
  { path: paths.dashboard.pos.report.dashboard, title: 'Tổng quan', permissions: [A.revenue, A.expense, A.breakEven] },
  { path: paths.dashboard.pos.report.revenue, title: 'Doanh thu', permissions: [A.revenue] },
  { path: paths.dashboard.pos.report.productSales, title: 'SP bán chạy', permissions: [A.productSales] },
  { path: paths.dashboard.pos.report.customers, title: 'Khách hàng', permissions: [A.customer] },
  { path: paths.dashboard.pos.report.inventory, title: 'Tồn kho', permissions: [A.inventory] },
  { path: paths.dashboard.pos.report.tax, title: 'Báo cáo thuế', permissions: [A.tax] },
  { path: paths.dashboard.pos.report.expense, title: 'Chi phí', permissions: [A.expense] },
  { path: paths.dashboard.pos.report.debt, title: 'Công nợ', permissions: [A.debt] },
  { path: paths.dashboard.pos.report.breakEven, title: 'Điểm hòa vốn', permissions: [A.breakEven] },
];

/** Có MỘT trong các quyền này là thấy mục "Báo cáo". */
export const REPORT_VIEW_PERMISSIONS: readonly string[] = Array.from(new Set(REPORT_PAGES.flatMap((p) => p.permissions)));

export function reportPermissionsFor(path: string): readonly string[] {
  return REPORT_PAGES.find((p) => p.path === path)?.permissions ?? [];
}

/** Trang báo cáo đầu tiên người dùng xem được (mở /dashboard/pos/report). */
export function firstAllowedReport(user: Parameters<typeof hasAllPermissions>[0]): string | null {
  return REPORT_PAGES.find((p) => hasAllPermissions(user, p.permissions))?.path ?? null;
}

/** Nút "Xuất Excel": Core-be đòi thêm analytics.export ngoài quyền xem báo cáo. */
export function canExportReports(user: Parameters<typeof hasPermission>[0]): boolean {
  return hasPermission(user, A.export);
}
