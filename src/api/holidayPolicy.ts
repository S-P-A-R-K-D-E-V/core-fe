import axios, { endpoints } from 'src/utils/axios';

import type {
  ICreateHolidayPolicyRequest,
  IHolidayPolicy,
  IUpdateHolidayPolicyRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

// Admin/Manager endpoints

export async function getAllHolidayPolicies(): Promise<IHolidayPolicy[]> {
  const response = await axios.get<IHolidayPolicy[]>(endpoints.holidayPolicy.list);
  return response.data;
}

export async function getHolidayPolicyById(id: string): Promise<IHolidayPolicy> {
  const response = await axios.get<IHolidayPolicy>(endpoints.holidayPolicy.details(id));
  return response.data;
}

export async function createHolidayPolicy(
  data: ICreateHolidayPolicyRequest
): Promise<IHolidayPolicy> {
  const response = await axios.post<IHolidayPolicy>(endpoints.holidayPolicy.create, data);
  return response.data;
}

export async function updateHolidayPolicy(
  id: string,
  data: IUpdateHolidayPolicyRequest
): Promise<IHolidayPolicy> {
  const response = await axios.put<IHolidayPolicy>(endpoints.holidayPolicy.update(id), data);
  return response.data;
}

export async function deleteHolidayPolicy(id: string): Promise<void> {
  await axios.delete(endpoints.holidayPolicy.delete(id));
}
