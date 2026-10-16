import { describe, expect, it } from 'vitest';

import { hasAnyRole, getUserRoles, MANAGER_ROLES, normalizeRoles } from 'src/auth/roles';

// ----------------------------------------------------------------------
// Người kiêm nhiều vai trò có quyền của MỌI vai trò (API xét đủ danh sách `roles` trong token) — `role` chỉ là vai trò
// chính để hiển thị, có thể là vai trò thấp hơn (vd Staff kiêm Admin vẫn hiện "Staff").
// ----------------------------------------------------------------------

describe('getUserRoles', () => {
  it('gộp roles với role, bỏ trùng và giá trị rỗng', () => {
    expect(getUserRoles({ role: 'Staff', roles: ['Staff', 'Admin'] })).toEqual(['Staff', 'Admin']);
    expect(getUserRoles({ role: 'Manager' })).toEqual(['Manager']);
    expect(getUserRoles({ role: '', roles: ['Admin', null, undefined] })).toEqual(['Admin']);
  });

  it('chưa đăng nhập → không vai trò nào', () => {
    expect(getUserRoles(null)).toEqual([]);
    expect(getUserRoles(undefined)).toEqual([]);
    expect(getUserRoles({ roles: 'Admin' })).toEqual([]);
  });
});

describe('normalizeRoles', () => {
  it('nhận một chuỗi hoặc một danh sách', () => {
    expect(normalizeRoles('Admin')).toEqual(['Admin']);
    expect(normalizeRoles(['Admin', 'Admin', ''])).toEqual(['Admin']);
    expect(normalizeRoles(undefined)).toEqual([]);
  });
});

describe('hasAnyRole', () => {
  it('đạt khi có MỘT trong các vai trò được phép', () => {
    expect(hasAnyRole(['Staff', 'Admin'], MANAGER_ROLES)).toBe(true);
    expect(hasAnyRole(['Staff'], MANAGER_ROLES)).toBe(false);
  });

  it('không khai báo vai trò = không giới hạn', () => {
    expect(hasAnyRole([], undefined)).toBe(true);
    expect(hasAnyRole([], null)).toBe(true);
  });

  it('phân biệt hoa thường như API', () => {
    expect(hasAnyRole(['admin'], ['Admin'])).toBe(false);
  });
});
