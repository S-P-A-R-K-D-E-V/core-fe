import axios, { endpoints } from 'src/utils/axios';
import {
  IInventoryItem,
  IInventoryTransaction,
  IAdjustInventoryRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getInventoryItems(params?: {
  warehouseId?: string;
  lowStockOnly?: boolean;
}): Promise<IInventoryItem[]> {
  const response = await axios.get<IInventoryItem[]>(endpoints.inventory.list, { params });
  return response.data;
}

export async function getLowStockItems(warehouseId?: string): Promise<IInventoryItem[]> {
  const response = await axios.get<IInventoryItem[]>(endpoints.inventory.lowStock, {
    params: { warehouseId },
  });
  return response.data;
}

export async function getInventoryTransactions(params?: {
  productId?: string;
  warehouseId?: string;
  from?: string;
  to?: string;
}): Promise<IInventoryTransaction[]> {
  const response = await axios.get<IInventoryTransaction[]>(endpoints.inventory.transactions, { params });
  return response.data;
}

export async function adjustInventory(data: IAdjustInventoryRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.inventory.adjust, data);
  return response.data;
}
