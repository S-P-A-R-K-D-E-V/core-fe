import axios, { endpoints } from 'src/utils/axios';
import {
  IProduct,
  ICreateProductRequest,
  IUpdateProductRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getAllProducts(params?: {
  keyword?: string;
  categoryId?: string;
  isActive?: boolean;
}): Promise<IProduct[]> {
  const response = await axios.get<IProduct[]>(endpoints.products.list, { params });
  return response.data;
}

export async function getProductById(id: string): Promise<IProduct> {
  const response = await axios.get<IProduct>(endpoints.products.details(id));
  return response.data;
}

export async function createProduct(data: ICreateProductRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.products.create, data);
  return response.data;
}

export async function updateProduct(id: string, data: IUpdateProductRequest): Promise<void> {
  await axios.put(endpoints.products.update(id), data);
}

export async function deleteProduct(id: string): Promise<void> {
  await axios.delete(endpoints.products.delete(id));
}
