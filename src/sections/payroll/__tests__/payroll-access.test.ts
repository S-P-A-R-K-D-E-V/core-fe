import { describe, expect, it } from 'vitest';

import { payrollAccessFor } from 'src/sections/payroll/payroll-access';

// ----------------------------------------------------------------------
// Khớp Core-be: Manager mặc định không chốt lương / không xác nhận đã chi / không tính lại hàng loạt / không công bố,
// xoá kỳ; vai trò tuỳ chỉnh được đúng quyền được cấp (thao tác ghi cần kèm quyền xem).
// ----------------------------------------------------------------------

const MANAGER_DEFAULTS = [
  'payroll.records.read',
  'payroll.calculate',
  'payroll.payment.prepare',
  'payroll.cycle.manage',
  'payroll.penalty.manage',
  'payroll.policy.manage',
  'payroll.salary-config.read',
  'payroll.salary-config.manage',
];

describe('payrollAccessFor', () => {
  it('Admin làm được mọi thứ', () => {
    expect(Object.values(payrollAccessFor({ role: 'Admin', roles: ['Admin'] })).every(Boolean)).toBe(true);
  });

  it('Manager (quyền mặc định) như trước: không chốt, không xác nhận đã chi, không tính lại hàng loạt, không công bố / xoá kỳ', () => {
    const access = payrollAccessFor({ role: 'Manager', roles: ['Manager'], permissions: MANAGER_DEFAULTS });
    expect(access).toMatchObject({
      canReadRecords: true,
      canPreparePayment: true,
      canManageCycles: true,
      canManagePenalty: true,
      canManageSalaryConfig: true,
      canFinalize: false,
      canMarkPaid: false,
      canRecalculate: false,
      canPublishCycle: false,
      canDeleteCycle: false,
    });
  });

  it('thiếu quyền xem thì không ghi được', () => {
    const access = payrollAccessFor({ role: 'Staff', permissions: ['payroll.finalize', 'payroll.salary-config.manage'] });
    expect(access.canFinalize).toBe(false);
    expect(access.canManageSalaryConfig).toBe(false);
  });

  it('vai trò tuỳ chỉnh được cấp chốt lương', () => {
    const access = payrollAccessFor({ role: 'Staff', permissions: ['payroll.records.read', 'payroll.finalize'] });
    expect(access.canFinalize).toBe(true);
    expect(access.canMarkPaid).toBe(false);
  });
});
