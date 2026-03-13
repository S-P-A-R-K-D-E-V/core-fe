import axios, { endpoints } from 'src/utils/axios';
import {
  ISupplier,
  ICreateSupplierRequest,
  IUpdateSupplierRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getAllSuppliers(params?: {
  keyword?: string;
  isActive?: boolean;
}): Promise<ISupplier[]> {
  const response = await axios.get<ISupplier[]>(endpoints.suppliers.list, { params });
  return response.data;
}

export async function createSupplier(data: ICreateSupplierRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.suppliers.create, data);
  return response.data;
}

export async function updateSupplier(id: string, data: IUpdateSupplierRequest): Promise<void> {
  await axios.put(endpoints.suppliers.update(id), data);
}

export async function deleteSupplier(id: string): Promise<void> {
  await axios.delete(endpoints.suppliers.delete(id));
}
