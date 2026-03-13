import axios, { endpoints } from 'src/utils/axios';
import {
  IVariantAttribute,
  ICreateVariantAttributeRequest,
  IUpdateVariantAttributeRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getAllVariantAttributes(): Promise<IVariantAttribute[]> {
  const response = await axios.get<IVariantAttribute[]>(endpoints.variantAttributes.list);
  return response.data;
}

export async function createVariantAttribute(data: ICreateVariantAttributeRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.variantAttributes.create, data);
  return response.data;
}

export async function updateVariantAttribute(id: string, data: IUpdateVariantAttributeRequest): Promise<void> {
  await axios.put(endpoints.variantAttributes.update(id), data);
}

export async function deleteVariantAttribute(id: string): Promise<void> {
  await axios.delete(endpoints.variantAttributes.delete(id));
}
