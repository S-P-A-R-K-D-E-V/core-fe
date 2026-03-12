import axios, { endpoints } from 'src/utils/axios';

import type {
  ICreateShiftSwapRequestRequest,
  IReviewShiftSwapRequestRequest,
  IShiftSwapRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

// Staff endpoints

export async function createShiftSwapRequest(
  data: ICreateShiftSwapRequestRequest
): Promise<IShiftSwapRequest> {
  const response = await axios.post<IShiftSwapRequest>(endpoints.shiftSwap.create, data);
  return response.data;
}

export async function getMyShiftSwapRequests(): Promise<IShiftSwapRequest[]> {
  const response = await axios.get<IShiftSwapRequest[]>(endpoints.shiftSwap.myRequests);
  return response.data;
}

// Admin/Manager endpoints

export async function getPendingShiftSwapRequests(): Promise<IShiftSwapRequest[]> {
  const response = await axios.get<IShiftSwapRequest[]>(endpoints.shiftSwap.list);
  return response.data;
}

export async function reviewShiftSwapRequest(
  id: string,
  data: IReviewShiftSwapRequestRequest
): Promise<IShiftSwapRequest> {
  const response = await axios.put<IShiftSwapRequest>(endpoints.shiftSwap.review(id), data);
  return response.data;
}
