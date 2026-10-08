'use client';

import type { IBranchLocation } from 'src/types/corecms-api';

import { useState, useEffect, useCallback } from 'react';

import { getCurrentUser } from 'src/api/users';
import { getBranchLocations } from 'src/api/attendance';

// ----------------------------------------------------------------------
// Chi nhánh F&B mà tài khoản được làm (branchScope của /users/me: Admin / chưa phân công = mọi chi nhánh), chi nhánh
// đang chọn nhớ trên máy — dùng chung cho Bán hàng F&B, Kho nguyên liệu, Máy in phiếu.
// ----------------------------------------------------------------------

const BRANCH_KEY = 'fnb.pos.branchId';

export function useFnbBranches() {
  const [branches, setBranches] = useState<IBranchLocation[] | null>(null);
  const [branchId, setBranchIdState] = useState('');

  useEffect(() => {
    Promise.all([getBranchLocations(), getCurrentUser().catch(() => null)])
      .then(([list, me]) => {
        const scope = me?.branchScope;
        const fnb = list.filter(
          (b) =>
            b.isActive !== false &&
            b.businessType?.toLowerCase() === 'fnb' &&
            (!scope || scope.allBranches || scope.branchIds.includes(b.id))
        );
        setBranches(fnb);
        let saved = '';
        try {
          saved = window.localStorage.getItem(BRANCH_KEY) ?? '';
        } catch {
          // bỏ qua
        }
        setBranchIdState(fnb.some((b) => b.id === saved) ? saved : fnb[0]?.id ?? '');
      })
      .catch(() => setBranches([]));
  }, []);

  const setBranchId = useCallback((id: string) => {
    setBranchIdState(id);
    try {
      window.localStorage.setItem(BRANCH_KEY, id);
    } catch {
      // bỏ qua
    }
  }, []);

  return { branches, branchId, setBranchId };
}
