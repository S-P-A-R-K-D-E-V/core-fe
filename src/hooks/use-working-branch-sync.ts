import { useEffect } from 'react';

import { getCurrentUser } from 'src/api/users';
import { getBranchLocations } from 'src/api/attendance';

import { useWorkingBranch } from 'src/store/working-branch-store';

// ----------------------------------------------------------------------
// Nạp chi nhánh đang làm việc một lần cho cả khu dashboard: đọc lựa chọn đã nhớ, rồi đối chiếu với GET /branches
// trong phạm vi chi nhánh của tài khoản (GET /users/me → branchScope). Đổi tài khoản → nạp lại.
// Không hỏi được /users/me → coi như mọi chi nhánh (core-be vẫn chặn theo phân công).
// ----------------------------------------------------------------------

export function useWorkingBranchSync(userId?: string) {
  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;
    useWorkingBranch.getState().hydrate();

    Promise.all([getBranchLocations(), getCurrentUser().catch(() => null)])
      .then(([list, me]) => {
        if (!cancelled) useWorkingBranch.getState().reconcile(list, me?.branchScope);
      })
      .catch(() => {
        if (!cancelled) useWorkingBranch.getState().reconcileFailed();
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);
}

/** Khoá nút đổi chi nhánh trong lúc `locked` (vd đang mở đơn); tự mở khoá khi rời màn. */
export function useWorkingBranchLock(locked: boolean, reason: string) {
  useEffect(() => {
    if (!locked) return undefined;

    useWorkingBranch.getState().setLock(reason);
    return () => useWorkingBranch.getState().setLock(null);
  }, [locked, reason]);
}
