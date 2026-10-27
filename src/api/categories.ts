import axios, { endpoints } from 'src/utils/axios';
import {
  ICategory,
  ICreateCategoryRequest,
  IUpdateCategoryRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getAllCategories(hierarchical = false): Promise<ICategory[]> {
  const response = await axios.get<ICategory[]>(endpoints.categories.list, {
    params: { hierarchical },
  });
  return response.data;
}

export async function createCategory(data: ICreateCategoryRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.categories.create, data);
  return response.data;
}

export async function updateCategory(id: string, data: IUpdateCategoryRequest): Promise<void> {
  await axios.put(endpoints.categories.update(id), data);
}

/** Tầng bày hàng của nhóm (1, 2...; null = theo danh mục cha). Lưu riêng, không qua updateCategory. */
export async function setCategoryFloor(id: string, floor: number | null): Promise<void> {
  await axios.put(endpoints.categories.floor(id), { floor });
}

export async function deleteCategory(id: string): Promise<void> {
  await axios.delete(endpoints.categories.delete(id));
}
