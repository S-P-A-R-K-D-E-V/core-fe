import { describe, expect, it } from 'vitest';

import {
  PERMISSIONS,
  hasPermission,
  permissionsKnown,
  hasAnyPermission,
  hasAllPermissions,
} from 'src/auth/permissions';

// ----------------------------------------------------------------------
// Quyền hiệu lực lấy từ GET /users/me (token không mang quyền). Admin có mọi quyền như API ("*").
// ----------------------------------------------------------------------

const A = PERMISSIONS.analytics;

describe('permissions', () => {
  it('Admin có mọi quyền, kể cả khi chưa nạp /users/me', () => {
    const owner = { role: 'Staff', roles: ['Staff', 'Admin'] };
    expect(permissionsKnown(owner)).toBe(true);
    expect(hasPermission(owner, A.export)).toBe(true);
    expect(hasAllPermissions(owner, [A.revenue, A.tax])).toBe(true);
  });

  it('người khác: chỉ quyền được cấp; chưa nạp quyền = chưa biết', () => {
    const accountant = { role: 'Staff', roles: ['Staff'], permissions: [A.revenue] };
    expect(hasPermission(accountant, A.revenue)).toBe(true);
    expect(hasPermission(accountant, A.export)).toBe(false);
    expect(hasAnyPermission(accountant, [A.tax, A.revenue])).toBe(true);
    expect(hasAllPermissions(accountant, [A.tax, A.revenue])).toBe(false);

    const loading = { role: 'Staff', roles: ['Staff'] };
    expect(permissionsKnown(loading)).toBe(false);
    expect(hasPermission(loading, A.revenue)).toBe(false);
  });

  it('không khai báo quyền = không giới hạn', () => {
    expect(hasAnyPermission({ roles: ['Staff'], permissions: [] }, undefined)).toBe(true);
    expect(hasAllPermissions({ roles: ['Staff'], permissions: [] }, [])).toBe(true);
  });

  it('mã quyền trùng Core-be (PermissionCatalog)', () => {
    expect(A.revenue).toBe('analytics.revenue.read');
    expect(A.export).toBe('analytics.export');
  });
});
