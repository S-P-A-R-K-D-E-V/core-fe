import axios, { endpoints } from 'src/utils/axios';

import type {
  IClaimShiftPoolPostDto,
  ICreateShiftPoolPostDto,
  IReviewShiftPoolPostDto,
  IShiftPoolPost,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function createShiftPoolPost(data: ICreateShiftPoolPostDto): Promise<IShiftPoolPost> {
  const response = await axios.post<IShiftPoolPost>(endpoints.shiftPool.create, data);
  return response.data;
}

export async function getOpenShiftPoolPosts(): Promise<IShiftPoolPost[]> {
  const response = await axios.get<IShiftPoolPost[]>(endpoints.shiftPool.open);
  return response.data;
}

export async function getMyShiftPoolPosts(): Promise<IShiftPoolPost[]> {
  const response = await axios.get<IShiftPoolPost[]>(endpoints.shiftPool.myPosts);
  return response.data;
}

export async function getMyShiftPoolClaims(): Promise<IShiftPoolPost[]> {
  const response = await axios.get<IShiftPoolPost[]>(endpoints.shiftPool.myClaims);
  return response.data;
}

export async function getPendingShiftPoolPosts(): Promise<IShiftPoolPost[]> {
  const response = await axios.get<IShiftPoolPost[]>(endpoints.shiftPool.pending);
  return response.data;
}

export async function claimShiftPoolPost(
  id: string,
  data: IClaimShiftPoolPostDto
): Promise<IShiftPoolPost> {
  const response = await axios.post<IShiftPoolPost>(endpoints.shiftPool.claim(id), data);
  return response.data;
}

export async function cancelShiftPoolPost(id: string): Promise<IShiftPoolPost> {
  const response = await axios.put<IShiftPoolPost>(endpoints.shiftPool.cancel(id), {});
  return response.data;
}

export async function reviewShiftPoolPost(
  id: string,
  data: IReviewShiftPoolPostDto
): Promise<IShiftPoolPost> {
  const response = await axios.put<IShiftPoolPost>(endpoints.shiftPool.review(id), data);
  return response.data;
}
