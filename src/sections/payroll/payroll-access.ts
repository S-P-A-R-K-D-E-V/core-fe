import { useMemo } from 'react';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasAllPermissions } from 'src/auth/permissions';

// ----------------------------------------------------------------------
// Quyền ở các màn lương — khớp Core-be (PayrollController, PayrollCycleController, SalaryConfigurationController…):
// mỗi thao tác ghi cần quyền riêng + quyền xem tương ứng. Mặc định: Admin đủ hết; Manager như trước (không chốt lương,
// không xác nhận đã chi, không tính lại hàng loạt, không công bố / xoá kỳ). Quyền thật do API quyết định.
// ----------------------------------------------------------------------

const P = PERMISSIONS.payroll;

type AccessSource = Parameters<typeof hasAllPermissions>[0];

export type PayrollAccess = ReturnType<typeof payrollAccessFor>;

export function payrollAccessFor(user: AccessSource) {
  const records = (code?: string) => hasAllPermissions(user, code ? [P.recordsRead, code] : [P.recordsRead]);
  return {
    canReadRecords: records(),
    canRecalculate: hasAllPermissions(user, [P.recordsRead, P.salaryConfigRead, P.recalculate]),
    canFinalize: records(P.finalize),
    canPreparePayment: records(P.paymentPrepare),
    canMarkPaid: records(P.markPaid),
    canManageCycles: records(P.cycleManage),
    canPublishCycle: records(P.cyclePublish),
    canDeleteCycle: records(P.cycleDelete),
    canManagePenalty: records(P.penaltyManage),
    canManageSalaryConfig: hasAllPermissions(user, [P.salaryConfigRead, P.salaryConfigManage]),
  };
}

export function usePayrollAccess(): PayrollAccess {
  const { user } = useAuthContext();
  return useMemo(() => payrollAccessFor(user), [user]);
}
