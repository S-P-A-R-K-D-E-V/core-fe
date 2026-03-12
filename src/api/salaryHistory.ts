import axios, { endpoints } from 'src/utils/axios';

import type { ISalaryHistory } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

// Admin/Manager endpoints

export async function getAllSalaryHistory(): Promise<ISalaryHistory[]> {
  const response = await axios.get<ISalaryHistory[]>(endpoints.salaryHistory.list);
  return response.data;
}

export async function getSalaryHistoryByUser(userId: string): Promise<ISalaryHistory[]> {
  const response = await axios.get<ISalaryHistory[]>(endpoints.salaryHistory.byUser(userId));
  return response.data;
}

// Staff endpoints

export async function getMySalaryHistory(): Promise<ISalaryHistory[]> {
  const response = await axios.get<ISalaryHistory[]>(endpoints.salaryHistory.mySalaryHistory);
  return response.data;
}
