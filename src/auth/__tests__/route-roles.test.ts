import { describe, expect, it } from 'vitest';

import { paths } from 'src/routes/paths';
import { requiredRolesFor } from 'src/auth/route-roles';
import { ADMIN_ROLES, MANAGER_ROLES } from 'src/auth/roles';

// ----------------------------------------------------------------------
// Trang quản trị trước đây chỉ ẩn khỏi menu — gõ URL vẫn vào rồi API 403 khắp nơi. Vai trò ở cấp route phải khớp menu
// và không rộng hơn API (Core-be).
// ----------------------------------------------------------------------

describe('requiredRolesFor', () => {
  it.each([
    [paths.dashboard.role.list, ADMIN_ROLES],
    [paths.dashboard.role.edit('r1'), ADMIN_ROLES],
    [paths.dashboard.storeSettings.root, ADMIN_ROLES],
    [paths.dashboard.notificationConfig.root, ADMIN_ROLES],
    [paths.dashboard.shift.templates.list, MANAGER_ROLES],
    [paths.dashboard.shift.schedules.edit('s1'), MANAGER_ROLES],
    [paths.dashboard.shift.reminderRules.new, ADMIN_ROLES],
    [paths.dashboard.shiftAudit.root, MANAGER_ROLES],
    [paths.dashboard.salary.configuration, MANAGER_ROLES],
    [paths.dashboard.holidayPolicy.list, MANAGER_ROLES],
    [paths.dashboard.penaltyPolicy.list, MANAGER_ROLES],
    [paths.dashboard.payroll.cycles, MANAGER_ROLES],
    [paths.dashboard.payroll.batch, MANAGER_ROLES],
    [paths.dashboard.user.list, MANAGER_ROLES],
    [paths.dashboard.user.edit('u1'), MANAGER_ROLES],
  ])('%s → chỉ %j', (path, roles) => {
    expect(requiredRolesFor(path)).toEqual(roles);
  });

  it('trang của chính mình vẫn mở cho mọi nhân viên', () => {
    expect(requiredRolesFor(paths.dashboard.user.account)).toBeNull();
    expect(requiredRolesFor(paths.dashboard.payroll.myPayroll)).toBeNull();
    expect(requiredRolesFor(paths.dashboard.attendance.mySchedule)).toBeNull();
  });

  it('chỉ khớp trọn từng đoạn đường dẫn: /shift không chặn /shift-pool, /shift-swap, /shift-cash', () => {
    expect(requiredRolesFor(paths.dashboard.shiftPool.browse)).toBeNull();
    expect(requiredRolesFor(paths.dashboard.shiftSwap.myRequests)).toBeNull();
    expect(requiredRolesFor(paths.dashboard.shiftCash.root)).toBeNull();
    expect(requiredRolesFor(`${paths.dashboard.role.root}s`)).toBeNull();
  });

  it('bỏ qua dấu / cuối, đường dẫn rỗng', () => {
    expect(requiredRolesFor(`${paths.dashboard.role.list}/`)).toEqual(ADMIN_ROLES);
    expect(requiredRolesFor(null)).toBeNull();
    expect(requiredRolesFor(paths.dashboard.root)).toBeNull();
  });
});
