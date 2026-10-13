'use client';

import { useMemo } from 'react';

import { useWorkingBranch } from 'src/store/working-branch-store';

// ----------------------------------------------------------------------
// Chi nhánh F&B của các màn F&B (Bán hàng, Kho nguyên liệu, Máy in phiếu, Thiết lập…) = chi nhánh đang làm việc
// chọn ở header, khi chi nhánh đó là F&B. Chi nhánh đang làm việc không phải F&B → branchId rỗng, màn hiện
// FnbBranchNotice để chuyển sang một chi nhánh F&B.
// ----------------------------------------------------------------------

export function useFnbBranches() {
  const branch = useWorkingBranch((s) => s.branch);
  const options = useWorkingBranch((s) => s.options);

  /** Các chi nhánh F&B tài khoản được làm; null = chưa hỏi xong danh sách chi nhánh. */
  const branches = useMemo(() => options?.filter((b) => b.type === 'fnb') ?? null, [options]);

  return { branches, branchId: branch?.type === 'fnb' ? branch.id : '' };
}
