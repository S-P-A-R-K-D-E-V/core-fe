import axios, { endpoints } from 'src/utils/axios';
import { IUserTourStatus } from 'src/types/corecms-api';

// ======================================================================
// User Tour API
// ======================================================================

export async function getTourStatus(tourKey: string): Promise<IUserTourStatus> {
  const res = await axios.get(endpoints.userTours.status(tourKey));
  return res.data;
}

export async function getBatchTourStatus(keys: string[]): Promise<IUserTourStatus[]> {
  const res = await axios.get(endpoints.userTours.batch, { params: { keys: keys.join(',') } });
  return res.data;
}

export async function completeTour(tourKey: string): Promise<IUserTourStatus> {
  const res = await axios.post(endpoints.userTours.complete(tourKey));
  return res.data;
}

export async function resetTour(tourKey: string): Promise<IUserTourStatus> {
  const res = await axios.post(endpoints.userTours.reset(tourKey));
  return res.data;
}
