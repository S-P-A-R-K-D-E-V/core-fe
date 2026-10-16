import { describe, expect, it } from 'vitest';

import { paths } from 'src/routes/paths';
import { PERMISSIONS } from 'src/auth/permissions';

import {
  REPORT_PAGES,
  canExportReports,
  firstAllowedReport,
  reportPermissionsFor,
  REPORT_VIEW_PERMISSIONS,
} from 'src/sections/pos/report/report-access';

// ----------------------------------------------------------------------
// Trang báo cáo ↔ quyền analytics.* của các API nó gọi (Core-be /reports/*).
// ----------------------------------------------------------------------

const A = PERMISSIONS.analytics;

describe('report-access', () => {
  it('Tổng quan cần đủ doanh thu + chi phí + hoà vốn (3 API nó gọi)', () => {
    expect(reportPermissionsFor(paths.dashboard.pos.report.dashboard)).toEqual([A.revenue, A.expense, A.breakEven]);
  });

  it('mọi trang trong menu đều có quyền; quyền xuất không phải quyền xem', () => {
    REPORT_PAGES.forEach((p) => expect(p.permissions.length).toBeGreaterThan(0));
    expect(REPORT_VIEW_PERMISSIONS).not.toContain(A.export);
  });

  it('mở trang đầu tiên được xem: chủ cửa hàng → Tổng quan, "Kế toán" chỉ có doanh thu → Doanh thu', () => {
    expect(firstAllowedReport({ roles: ['Admin'] })).toBe(paths.dashboard.pos.report.dashboard);
    expect(firstAllowedReport({ roles: ['Staff'], permissions: [A.revenue] })).toBe(paths.dashboard.pos.report.revenue);
    expect(firstAllowedReport({ roles: ['Staff'], permissions: [] })).toBeNull();
  });

  it('xuất Excel cần analytics.export', () => {
    expect(canExportReports({ roles: ['Staff'], permissions: [A.revenue] })).toBe(false);
    expect(canExportReports({ roles: ['Staff'], permissions: [A.revenue, A.export] })).toBe(true);
    expect(canExportReports({ roles: ['Admin'] })).toBe(true);
  });
});
