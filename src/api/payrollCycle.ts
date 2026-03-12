import axios, { endpoints } from 'src/utils/axios';

import type {
  ICreatePayrollCycleRequest,
  ILockPayrollCycleRequest,
  IPayrollCycle,
  IUpdatePayrollCycleRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

// Admin/Manager endpoints

export async function getAllPayrollCycles(): Promise<IPayrollCycle[]> {
  const response = await axios.get<IPayrollCycle[]>(endpoints.payrollCycle.list);
  return response.data;
}

export async function getPayrollCycleById(id: string): Promise<IPayrollCycle> {
  const response = await axios.get<IPayrollCycle>(endpoints.payrollCycle.details(id));
  return response.data;
}

export async function createPayrollCycle(
  data: ICreatePayrollCycleRequest
): Promise<IPayrollCycle> {
  const response = await axios.post<IPayrollCycle>(endpoints.payrollCycle.create, data);
  return response.data;
}

export async function updatePayrollCycle(
  id: string,
  data: IUpdatePayrollCycleRequest
): Promise<IPayrollCycle> {
  const response = await axios.put<IPayrollCycle>(endpoints.payrollCycle.update(id), data);
  return response.data;
}

export async function lockPayrollCycle(
  id: string,
  data: ILockPayrollCycleRequest
): Promise<IPayrollCycle> {
  const response = await axios.post<IPayrollCycle>(endpoints.payrollCycle.lock(id), data);
  return response.data;
}

export async function unlockPayrollCycle(
  id: string,
  data: ILockPayrollCycleRequest
): Promise<IPayrollCycle> {
  const response = await axios.post<IPayrollCycle>(endpoints.payrollCycle.unlock(id), data);
  return response.data;
}
