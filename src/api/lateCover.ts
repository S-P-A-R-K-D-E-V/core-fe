import axios, { endpoints } from 'src/utils/axios';

import type {
  ICreateLateCoverRequestDto,
  ILateCoverRequest,
  IReviewLateCoverRequestDto,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function createLateCoverRequest(
  data: ICreateLateCoverRequestDto
): Promise<ILateCoverRequest> {
  const response = await axios.post<ILateCoverRequest>(endpoints.lateCover.create, data);
  return response.data;
}

export async function getMyLateCoverRequests(): Promise<ILateCoverRequest[]> {
  const response = await axios.get<ILateCoverRequest[]>(endpoints.lateCover.myRequests);
  return response.data;
}

export async function getPendingLateCoverRequests(): Promise<ILateCoverRequest[]> {
  const response = await axios.get<ILateCoverRequest[]>(endpoints.lateCover.pending);
  return response.data;
}

export async function reviewLateCoverRequest(
  id: string,
  data: IReviewLateCoverRequestDto
): Promise<void> {
  await axios.put(endpoints.lateCover.review(id), data);
}
