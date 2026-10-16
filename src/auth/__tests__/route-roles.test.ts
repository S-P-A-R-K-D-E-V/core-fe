import { describe, expect, it } from 'vitest';

import { paths } from 'src/routes/paths';
import { PERMISSIONS } from 'src/auth/permissions';
import { requiredRolesFor, requiredPermissionsFor } from 'src/auth/route-roles';
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
    // Thiết bị cửa hàng nằm dưới Cài đặt cửa hàng nhưng quản lý cũng vào (máy quầy / kiosk chi nhánh mình).
    [paths.dashboard.storeSettings.devices, MANAGER_ROLES],
    [paths.dashboard.notificationConfig.root, ADMIN_ROLES],
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

// Trang lương chuyển sang quyền payroll.* (Core-be): Admin, Manager có mặc định; vai trò tuỳ chỉnh được cấp thêm.
describe('requiredPermissionsFor', () => {
  const P = PERMISSIONS.payroll;

  it.each([
    [paths.dashboard.salary.configuration, [P.salaryConfigRead]],
    [paths.dashboard.salary.history, [P.salaryConfigRead]],
    [paths.dashboard.holidayPolicy.list, [P.policyManage]],
    [paths.dashboard.penaltyPolicy.list, [P.policyManage]],
    [paths.dashboard.payroll.cycles, [P.recordsRead]],
    [paths.dashboard.payroll.batch, [P.recordsRead]],
  ])('%s → cần %j, không còn giới hạn theo vai trò', (path, permissions) => {
    expect(requiredPermissionsFor(path)).toEqual(permissions);
    expect(requiredRolesFor(path)).toBeNull();
  });

  const S = PERMISSIONS.shift;
  const A = PERMISSIONS.attendance;

  it.each([
    [paths.dashboard.shift.templates.list, [S.templateManage]],
    [paths.dashboard.shift.schedules.edit('s1'), [S.scheduleManage]],
    [paths.dashboard.shift.reminderRules.new, [S.reminderManage]],
    [paths.dashboard.shift.list, [S.templateManage, S.scheduleManage]],
    [paths.dashboard.shiftAudit.root, [S.auditRead]],
    [paths.dashboard.shiftPool.pending, [S.requestReview]],
    [paths.dashboard.shiftSwap.pending, [S.requestReview]],
    [paths.dashboard.attendance.assignments, [S.assignmentRead]],
    [paths.dashboard.attendance.logs, [A.read]],
    [paths.dashboard.attendance.report, [A.read]],
    [paths.dashboard.attendance.adjust, [A.adjust]],
  ])('ca làm / chấm công: %s → cần %j', (path, permissions) => {
    expect(requiredPermissionsFor(path)).toEqual(permissions);
    expect(requiredRolesFor(path)).toBeNull();
  });

  it('việc của chính mình ở ca làm / chấm công không xét quyền', () => {
    expect(requiredPermissionsFor(paths.dashboard.attendance.checkin)).toBeNull();
    expect(requiredPermissionsFor(paths.dashboard.attendance.mySchedule)).toBeNull();
    expect(requiredPermissionsFor(paths.dashboard.attendance.shiftRegistration)).toBeNull();
    expect(requiredPermissionsFor(paths.dashboard.shiftPool.browse)).toBeNull();
    expect(requiredPermissionsFor(paths.dashboard.shiftSwap.myRequests)).toBeNull();
  });

  const PR = PERMISSIONS.products;

  it.each([
    [paths.dashboard.pos.product.new, [PR.create]],
    [paths.dashboard.pos.category.list, [PR.catalogManage]],
    [paths.dashboard.pos.category.edit('c1'), [PR.catalogManage]],
    [paths.dashboard.pos.unitOfMeasure.list, [PR.catalogManage]],
    [paths.dashboard.pos.warehouse.new, [PERMISSIONS.inventory.warehouseManage]],
  ])('hàng hoá / kho: %s → cần %j', (path, permissions) => {
    expect(requiredPermissionsFor(path)).toEqual(permissions);
    expect(requiredRolesFor(path)).toBeNull();
  });

  it.each([
    [paths.dashboard.pos.purchaseOrder.list, [PERMISSIONS.purchase.read]],
    [paths.dashboard.pos.purchaseOrder.details('o1'), [PERMISSIONS.purchase.read]],
    [paths.dashboard.pos.purchaseOrder.new, [PERMISSIONS.purchase.create]],
    [paths.dashboard.pos.supplier.list, [PERMISSIONS.supplier.read]],
    [paths.dashboard.pos.supplier.new, [PERMISSIONS.supplier.manage]],
  ])('nhập hàng / nhà cung cấp: %s → cần %j', (path, permissions) => {
    expect(requiredPermissionsFor(path)).toEqual(permissions);
    expect(requiredRolesFor(path)).toBeNull();
  });

  it('danh sách hàng hoá (chỉ xem) mở cho mọi nhân viên; trang sửa hàng tự chặn', () => {
    expect(requiredPermissionsFor(paths.dashboard.pos.product.list)).toBeNull();
    expect(requiredPermissionsFor(paths.dashboard.pos.product.edit('p1'))).toBeNull();
  });

  it('lương của chính mình và trang chưa chuyển không xét quyền', () => {
    expect(requiredPermissionsFor(paths.dashboard.payroll.myPayroll)).toBeNull();
    expect(requiredPermissionsFor(paths.dashboard.role.list)).toBeNull();
  });
});
