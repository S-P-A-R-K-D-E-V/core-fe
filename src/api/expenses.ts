import axios, { endpoints } from 'src/utils/axios';
import {
  IExpense,
  IExpensesResponse,
  IExpenseCategory,
  IRecurringExpenseTemplate,
  ICreateExpenseRequest,
  IUpdateExpenseRequest,
  ICreateExpenseCategoryRequest,
  IUpdateExpenseCategoryRequest,
  ICreateRecurringExpenseTemplateRequest,
  IUpdateRecurringExpenseTemplateRequest,
  ExpenseType,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getExpenses(params?: {
  fromDate?: string;
  toDate?: string;
  categoryId?: string;
  type?: ExpenseType;
  pageNumber?: number;
  pageSize?: number;
}): Promise<IExpensesResponse> {
  const response = await axios.get<IExpensesResponse>(endpoints.expenses.list, { params });
  return response.data;
}

export async function getExpenseById(id: string): Promise<IExpense> {
  const response = await axios.get<IExpense>(endpoints.expenses.details(id));
  return response.data;
}

export async function createExpense(data: ICreateExpenseRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.expenses.create, data);
  return response.data;
}

export async function updateExpense(id: string, data: IUpdateExpenseRequest): Promise<void> {
  await axios.put(endpoints.expenses.update(id), data);
}

export async function deleteExpense(id: string): Promise<void> {
  await axios.delete(endpoints.expenses.delete(id));
}

export async function getExpenseCategories(isActive?: boolean): Promise<IExpenseCategory[]> {
  const response = await axios.get<IExpenseCategory[]>(endpoints.expenses.categories, {
    params: { isActive },
  });
  return response.data;
}

export async function createExpenseCategory(
  data: ICreateExpenseCategoryRequest
): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.expenses.createCategory, data);
  return response.data;
}

export async function updateExpenseCategory(
  id: string,
  data: IUpdateExpenseCategoryRequest
): Promise<void> {
  await axios.put(endpoints.expenses.updateCategory(id), data);
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  await axios.delete(endpoints.expenses.deleteCategory(id));
}

export async function getRecurringExpenseTemplates(
  isActive?: boolean
): Promise<IRecurringExpenseTemplate[]> {
  const response = await axios.get<IRecurringExpenseTemplate[]>(
    endpoints.expenses.recurringTemplates,
    { params: { isActive } }
  );
  return response.data;
}

export async function createRecurringExpenseTemplate(
  data: ICreateRecurringExpenseTemplateRequest
): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(
    endpoints.expenses.createRecurringTemplate,
    data
  );
  return response.data;
}

export async function updateRecurringExpenseTemplate(
  id: string,
  data: IUpdateRecurringExpenseTemplateRequest
): Promise<void> {
  await axios.put(endpoints.expenses.updateRecurringTemplate(id), data);
}

export async function deactivateRecurringExpenseTemplate(id: string): Promise<void> {
  await axios.post(endpoints.expenses.deactivateRecurringTemplate(id));
}
