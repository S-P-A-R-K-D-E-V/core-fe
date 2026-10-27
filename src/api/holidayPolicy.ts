import axios, { endpoints } from 'src/utils/axios';

import type {
  ICreateHolidayPolicyRequest,
  IHolidayPolicy,
  IStatutoryPaySettings,
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

/** Trả lương theo Bộ luật Lao động: ngày bắt đầu (null = chưa áp dụng) và giờ làm bình thường mỗi ngày. */
export async function getStatutoryPaySettings(): Promise<IStatutoryPaySettings> {
  const response = await axios.get<IStatutoryPaySettings>(endpoints.holidayPolicy.statutoryPay);
  return response.data;
}

export async function updateStatutoryPaySettings(
  statutoryPayFrom: string | null,
  normalHoursPerDay: number | null
): Promise<IStatutoryPaySettings> {
  const response = await axios.put<IStatutoryPaySettings>(endpoints.holidayPolicy.statutoryPay, {
    statutoryPayFrom,
    normalHoursPerDay,
  });
  return response.data;
}
