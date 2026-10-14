import axios, { endpoints } from 'src/utils/axios';

import type { ITodayBoard, IStoreMonitor } from 'src/types/store-monitor';

/** date: yyyy-MM-dd theo giờ Việt Nam (bỏ trống = hôm nay). branchId bỏ trống = mọi chi nhánh được xem. */
export async function getStoreMonitor(params: { date?: string; branchId?: string }): Promise<IStoreMonitor> {
  const res = await axios.get<IStoreMonitor>(endpoints.reports.storeMonitor, {
    params: {
      date: params.date || undefined,
      branchId: params.branchId || undefined,
    },
  });
  return res.data;
}

/** Nhân sự hôm nay (chủ/quản lý). */
export async function getTodayBoard(): Promise<ITodayBoard> {
  const res = await axios.get<ITodayBoard>(endpoints.attendance.todayBoard);
  return res.data;
}
