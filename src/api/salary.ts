import axios, { endpoints } from 'src/utils/axios';

import type {
  ICreateSalaryConfigurationRequest,
  ISalaryConfiguration,
  IUpdateSalaryConfigurationRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

// Admin/Manager endpoints

export async function getAllSalaryConfigurations(
  userId?: string,
  asOfDate?: string
): Promise<ISalaryConfiguration[]> {
  const params = new URLSearchParams();
  if (userId) params.append('userId', userId);
  if (asOfDate) params.append('asOfDate', asOfDate);

  const response = await axios.get<ISalaryConfiguration[]>(
    `${endpoints.salary.list}?${params.toString()}`
  );
  return response.data;
}

export async function createSalaryConfiguration(
  data: ICreateSalaryConfigurationRequest
): Promise<ISalaryConfiguration> {
  const response = await axios.post<ISalaryConfiguration>(endpoints.salary.create, data);
  return response.data;
}

export async function updateSalaryConfiguration(
  id: string,
  data: IUpdateSalaryConfigurationRequest
): Promise<ISalaryConfiguration> {
  const response = await axios.put<ISalaryConfiguration>(endpoints.salary.update(id), data);
  return response.data;
}

export async function deleteSalaryConfiguration(id: string): Promise<void> {
  await axios.delete(endpoints.salary.delete(id));
}

// Staff endpoints

export async function getMySalaryConfiguration(): Promise<ISalaryConfiguration[]> {
  const response = await axios.get<ISalaryConfiguration[]>(endpoints.salary.mySalary);
  return response.data;
}
