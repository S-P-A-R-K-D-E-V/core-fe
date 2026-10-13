'use client';

import { Fragment } from 'react';

import { useFnbBranches } from 'src/sections/fnb-pos/use-fnb-branches';

// ----------------------------------------------------------------------
// Mọi màn F&B làm việc trên MỘT chi nhánh F&B (chi nhánh đang làm việc chọn ở header). Đổi chi nhánh → dựng lại
// màn đang mở, để số liệu / phiếu đang xem của chi nhánh cũ không còn nằm lại trên màn.
// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default function FnbLayout({ children }: Props) {
  const { branchId } = useFnbBranches();

  return <Fragment key={branchId}>{children}</Fragment>;
}
