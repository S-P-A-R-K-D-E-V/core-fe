import axios, { endpoints } from 'src/utils/axios';

import type { IBranchBoard, IBranchBoardBranch } from 'src/types/attendance-live';

/** Chi nhánh người dùng được xem và có ít nhất một agent camera đang hoạt động. */
export async function getBranchBoardBranches(): Promise<IBranchBoardBranch[]> {
  const res = await axios.get<IBranchBoardBranch[]>(endpoints.attendance.branchBoardBranches);
  return Array.isArray(res.data) ? res.data : [];
}

/** Bảng chấm công hôm nay của một chi nhánh: ca được phân, người camera thấy, thiết bị/camera. */
export async function getBranchBoard(branchId: string): Promise<IBranchBoard> {
  const res = await axios.get<IBranchBoard>(endpoints.attendance.branchBoard, { params: { branchId } });
  return res.data;
}
