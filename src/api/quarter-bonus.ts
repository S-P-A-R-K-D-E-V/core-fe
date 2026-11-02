import axios, { endpoints } from 'src/utils/axios';

import type {
  IMyQuarterBonus,
  IQuarterBonusRun,
  IWeeklyBonusRate,
  IQuarterBonusStaff,
  IQuarterBonusPolicy,
  ISaveWeeklyBonusRate,
  ISaveQuarterBonusPolicy,
} from 'src/types/quarter-bonus';

// ----------------------------------------------------------------------
// Thưởng hoàn thành quý — Core-be /quarter-bonuses. Trừ /mine, mọi lời gọi cần payroll.quarter-bonus.manage (Admin). quarter = ngày
// bất kỳ trong quý (yyyy-MM-dd).
// ----------------------------------------------------------------------

export async function getQuarterBonus(quarter: string): Promise<IQuarterBonusRun | null> {
  const response = await axios.get<IQuarterBonusRun | null>(endpoints.quarterBonuses.root, { params: { quarter } });
  return response.data || null;
}

export async function getMyQuarterBonus(): Promise<IMyQuarterBonus | null> {
  const response = await axios.get<IMyQuarterBonus | null>(endpoints.quarterBonuses.mine);
  return response.data || null;
}

export async function refreshQuarterBonus(quarter: string): Promise<IQuarterBonusRun | null> {
  const response = await axios.post<IQuarterBonusRun | null>(endpoints.quarterBonuses.refresh, { quarter });
  return response.data || null;
}

export async function closeQuarterBonus(quarter: string): Promise<IQuarterBonusRun | null> {
  const response = await axios.post<IQuarterBonusRun | null>(endpoints.quarterBonuses.close, { quarter });
  return response.data || null;
}

export async function reopenQuarterBonus(quarter: string, reason: string): Promise<IQuarterBonusRun | null> {
  const response = await axios.post<IQuarterBonusRun | null>(endpoints.quarterBonuses.reopen, { quarter, reason });
  return response.data || null;
}

/** amount = null: bỏ chỉnh tay. */
export async function overrideQuarterBonus(id: string, amount: number | null, reason: string): Promise<IQuarterBonusRun | null> {
  const response = await axios.put<IQuarterBonusRun | null>(endpoints.quarterBonuses.override(id), { amount, reason });
  return response.data || null;
}

export async function getQuarterBonusPolicies(): Promise<IQuarterBonusPolicy[]> {
  const response = await axios.get<IQuarterBonusPolicy[]>(endpoints.quarterBonuses.policies);
  return response.data;
}

export async function saveQuarterBonusPolicy(id: string | null, body: ISaveQuarterBonusPolicy): Promise<IQuarterBonusPolicy> {
  const response = id
    ? await axios.put<IQuarterBonusPolicy>(endpoints.quarterBonuses.policy(id), body)
    : await axios.post<IQuarterBonusPolicy>(endpoints.quarterBonuses.policies, body);
  return response.data;
}

export async function getQuarterBonusStaff(): Promise<IQuarterBonusStaff[]> {
  const response = await axios.get<IQuarterBonusStaff[]>(endpoints.quarterBonuses.employees);
  return response.data;
}

export async function saveQuarterBonusStaff(
  userId: string,
  body: { joinedOn: string | null; isStoreManager: boolean }
): Promise<IQuarterBonusStaff> {
  const response = await axios.put<IQuarterBonusStaff>(endpoints.quarterBonuses.employee(userId), body);
  return response.data;
}

export async function getWeeklyBonusRates(): Promise<IWeeklyBonusRate[]> {
  const response = await axios.get<IWeeklyBonusRate[]>(endpoints.hr.weeklyBonusRates);
  return response.data;
}

export async function saveWeeklyBonusRate(body: ISaveWeeklyBonusRate): Promise<IWeeklyBonusRate> {
  const response = await axios.put<IWeeklyBonusRate>(endpoints.hr.weeklyBonusRates, body);
  return response.data;
}
