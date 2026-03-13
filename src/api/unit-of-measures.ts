import axios, { endpoints } from 'src/utils/axios';
import {
  IUnitOfMeasure,
  ICreateUnitOfMeasureRequest,
  IUpdateUnitOfMeasureRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getAllUnitOfMeasures(): Promise<IUnitOfMeasure[]> {
  const response = await axios.get<IUnitOfMeasure[]>(endpoints.unitOfMeasures.list);
  return response.data;
}

export async function createUnitOfMeasure(data: ICreateUnitOfMeasureRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.unitOfMeasures.create, data);
  return response.data;
}

export async function updateUnitOfMeasure(id: string, data: IUpdateUnitOfMeasureRequest): Promise<void> {
  await axios.put(endpoints.unitOfMeasures.update(id), data);
}

export async function deleteUnitOfMeasure(id: string): Promise<void> {
  await axios.delete(endpoints.unitOfMeasures.delete(id));
}
