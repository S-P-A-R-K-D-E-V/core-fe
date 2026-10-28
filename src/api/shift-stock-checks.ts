import axios, { endpoints } from 'src/utils/axios';

import type {
  IStockCheckArea,
  IShiftStockCheck,
  ISaveStockCheckArea,
  ShiftStockCheckStatus,
} from 'src/types/shift-stock-check';

// ----------------------------------------------------------------------
// Kiểm hàng khu vực mỗi ca (Quy chế Điều 24.3) — Core-be /shift-stock-checks.
// ----------------------------------------------------------------------

/** Phiếu của các ca hôm nay mà mình làm (quản lý: mọi phiếu hôm nay). */
export async function getMyShiftStockChecks(): Promise<IShiftStockCheck[]> {
  const response = await axios.get<IShiftStockCheck[]>(endpoints.shiftStockChecks.mine);
  return response.data;
}

/** Quản lý (stocktake.read): phiếu theo ngày ca. */
export async function getShiftStockChecks(params: {
  from?: string;
  to?: string;
  status?: ShiftStockCheckStatus;
}): Promise<IShiftStockCheck[]> {
  const response = await axios.get<IShiftStockCheck[]>(endpoints.shiftStockChecks.list, { params });
  return response.data;
}

export async function getShiftStockCheck(id: string): Promise<IShiftStockCheck> {
  const response = await axios.get<IShiftStockCheck>(endpoints.shiftStockChecks.detail(id));
  return response.data;
}

/** quantity = null → xoá số đếm của dòng. */
export async function saveShiftStockCounts(
  id: string,
  entries: { lineId: string; quantity: number | null }[]
): Promise<IShiftStockCheck> {
  const response = await axios.put<IShiftStockCheck>(endpoints.shiftStockChecks.counts(id), { entries });
  return response.data;
}

export async function submitShiftStockCheck(id: string): Promise<IShiftStockCheck> {
  const response = await axios.post<IShiftStockCheck>(endpoints.shiftStockChecks.submit(id));
  return response.data;
}

export async function reviewShiftStockCheck(
  id: string,
  action: 'acknowledge' | 'cancel',
  note?: string | null
): Promise<IShiftStockCheck> {
  const response = await axios.post<IShiftStockCheck>(endpoints.shiftStockChecks.review(id), { action, note });
  return response.data;
}

export async function getStockCheckAreas(activeOnly = false): Promise<IStockCheckArea[]> {
  const response = await axios.get<IStockCheckArea[]>(endpoints.shiftStockChecks.areas, { params: { activeOnly } });
  return response.data;
}

/** Admin (stocktake.shift-check.manage). */
export async function saveStockCheckArea(id: string | null, body: ISaveStockCheckArea): Promise<IStockCheckArea> {
  const response = id
    ? await axios.put<IStockCheckArea>(endpoints.shiftStockChecks.area(id), body)
    : await axios.post<IStockCheckArea>(endpoints.shiftStockChecks.areas, body);
  return response.data;
}
