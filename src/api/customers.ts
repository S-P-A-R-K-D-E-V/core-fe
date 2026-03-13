import axios, { endpoints } from 'src/utils/axios';
import { ICustomer, ICreateCustomerRequest, IUpdateCustomerRequest } from 'src/types/corecms-api';

export async function getAllCustomers(params?: {
  keyword?: string;
  isActive?: boolean;
}): Promise<ICustomer[]> {
  const response = await axios.get<ICustomer[]>(endpoints.customers.list, { params });
  return response.data;
}

export async function createCustomer(data: ICreateCustomerRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.customers.create, data);
  return response.data;
}

export async function updateCustomer(id: string, data: IUpdateCustomerRequest): Promise<void> {
  await axios.put(endpoints.customers.update(id), data);
}

export async function deleteCustomer(id: string): Promise<void> {
  await axios.delete(endpoints.customers.delete(id));
}
