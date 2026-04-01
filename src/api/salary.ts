import axios, { endpoints } from 'src/utils/axios';

import type {
  ICreateSalaryConfigurationRequest,
  ISalaryConfiguration,
  ISalaryConfigurationPagedResponse,
  IUpdateSalaryConfigurationRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

// Admin/Manager endpoints

export async function getAllSalaryConfigurations(params?: {
  userId?: string;
  asOfDate?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<ISalaryConfigurationPagedResponse> {
  const query = new URLSearchParams();
  if (params?.userId) query.append('userId', params.userId);
  if (params?.asOfDate) query.append('asOfDate', params.asOfDate);
  if (params?.pageNumber) query.append('pageNumber', String(params.pageNumber));
  if (params?.pageSize) query.append('pageSize', String(params.pageSize));

  const response = await axios.get<ISalaryConfigurationPagedResponse>(
    `${endpoints.salary.list}?${query.toString()}`
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
