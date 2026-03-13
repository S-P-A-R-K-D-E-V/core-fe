import axios, { endpoints } from 'src/utils/axios';
import {
  IWarehouse,
  ICreateWarehouseRequest,
  IUpdateWarehouseRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getAllWarehouses(): Promise<IWarehouse[]> {
  const response = await axios.get<IWarehouse[]>(endpoints.warehouses.list);
  return response.data;
}

export async function createWarehouse(data: ICreateWarehouseRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.warehouses.create, data);
  return response.data;
}

export async function updateWarehouse(id: string, data: IUpdateWarehouseRequest): Promise<void> {
  await axios.put(endpoints.warehouses.update(id), data);
}

export async function deleteWarehouse(id: string): Promise<void> {
  await axios.delete(endpoints.warehouses.delete(id));
}
