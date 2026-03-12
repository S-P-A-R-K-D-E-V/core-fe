import axios, { endpoints } from 'src/utils/axios';

import type {
  ICreatePenaltyPolicyRequest,
  IPenaltyPolicy,
  IUpdatePenaltyPolicyRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

// Admin/Manager endpoints

export async function getAllPenaltyPolicies(): Promise<IPenaltyPolicy[]> {
  const response = await axios.get<IPenaltyPolicy[]>(endpoints.penaltyPolicy.list);
  return response.data;
}

export async function getPenaltyPolicyById(id: string): Promise<IPenaltyPolicy> {
  const response = await axios.get<IPenaltyPolicy>(endpoints.penaltyPolicy.details(id));
  return response.data;
}

export async function createPenaltyPolicy(
  data: ICreatePenaltyPolicyRequest
): Promise<IPenaltyPolicy> {
  const response = await axios.post<IPenaltyPolicy>(endpoints.penaltyPolicy.create, data);
  return response.data;
}

export async function updatePenaltyPolicy(
  id: string,
  data: IUpdatePenaltyPolicyRequest
): Promise<IPenaltyPolicy> {
  const response = await axios.put<IPenaltyPolicy>(endpoints.penaltyPolicy.update(id), data);
  return response.data;
}

export async function deletePenaltyPolicy(id: string): Promise<void> {
  await axios.delete(endpoints.penaltyPolicy.delete(id));
}
