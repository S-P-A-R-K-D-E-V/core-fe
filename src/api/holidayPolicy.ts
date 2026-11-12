import axios, { endpoints } from 'src/utils/axios';

import type {
  ICreateHolidayPolicyRequest,
  IHolidayPolicy,
  IStatutoryPaySettings,
  IWeeklyBonusPaySettings,
  IPayRegimeSettings,
  IUpdateHolidayPolicyRequest,
} from 'src/types/corecms-api';

/** Chế độ trả lương (kỳ 1 / kỳ 2, mức sàn lương thử việc, chuyên cần). Cần quyền payroll.policy.manage. */
export async function getPayRegimeSettings(): Promise<IPayRegimeSettings> {
  const response = await axios.get<IPayRegimeSettings>(endpoints.holidayPolicy.payRegime);
  return response.data;
}

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

/** `overtimePremiumEnabled` bỏ trống = giữ nguyên cờ phụ cấp làm thêm giờ. */
export async function updateStatutoryPaySettings(
  statutoryPayFrom: string | null,
  normalHoursPerDay: number | null,
  overtimePremiumEnabled?: boolean
): Promise<IStatutoryPaySettings> {
  const response = await axios.put<IStatutoryPaySettings>(endpoints.holidayPolicy.statutoryPay, {
    statutoryPayFrom,
    normalHoursPerDay,
    ...(overtimePremiumEnabled === undefined ? {} : { overtimePremiumEnabled }),
  });
  return response.data;
}

/** Trả thưởng doanh số tuần vào lương kỳ cuối tháng: tuần bắt đầu (null = chỉ tính thử). */
export async function getWeeklyBonusPaySettings(): Promise<IWeeklyBonusPaySettings> {
  const response = await axios.get<IWeeklyBonusPaySettings>(endpoints.holidayPolicy.weeklyBonusPay);
  return response.data;
}

export async function updateWeeklyBonusPaySettings(weeklyBonusPayFrom: string | null): Promise<IWeeklyBonusPaySettings> {
  const response = await axios.put<IWeeklyBonusPaySettings>(endpoints.holidayPolicy.weeklyBonusPay, { weeklyBonusPayFrom });
  return response.data;
}
