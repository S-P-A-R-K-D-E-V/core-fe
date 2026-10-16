'use client';

import { useEffect } from 'react';

import { useRouter } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';
import { permissionsKnown } from 'src/auth/permissions';

import { firstAllowedReport } from 'src/sections/pos/report/report-access';

// ----------------------------------------------------------------------
// Mở trang báo cáo đầu tiên người dùng được xem (chủ cửa hàng: Tổng quan; "Kế toán" chỉ có doanh thu: Doanh thu).
// Không có báo cáo nào thì layout đã hiện màn chặn.

export default function ReportPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  useEffect(() => {
    if (!permissionsKnown(user)) return;
    const target = firstAllowedReport(user);
    if (target) router.replace(target);
  }, [router, user]);

  return null;
}
