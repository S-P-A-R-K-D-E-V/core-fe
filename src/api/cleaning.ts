import axios, { endpoints } from 'src/utils/axios';

import type {
  ICleaningPenalty,
  ICleaningTaskInstance,
  ICleaningTaskTemplate,
  ICleaningWeekCell,
  ICreateCleaningTaskTemplateRequest,
  IShiftStaffForPenalty,
  IUpdateCleaningTaskTemplateRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Templates (Admin CRUD)

export async function getCleaningTaskTemplates(): Promise<ICleaningTaskTemplate[]> {
  const response = await axios.get<ICleaningTaskTemplate[]>(endpoints.cleaning.templates);
  return response.data;
}

export async function createCleaningTaskTemplate(
  data: ICreateCleaningTaskTemplateRequest
): Promise<ICleaningTaskTemplate> {
  const response = await axios.post<ICleaningTaskTemplate>(endpoints.cleaning.templates, data);
  return response.data;
}

export async function updateCleaningTaskTemplate(
  id: string,
  data: IUpdateCleaningTaskTemplateRequest
): Promise<ICleaningTaskTemplate> {
  const response = await axios.put<ICleaningTaskTemplate>(endpoints.cleaning.templateDetails(id), data);
  return response.data;
}

export async function deleteCleaningTaskTemplate(id: string): Promise<void> {
  await axios.delete(endpoints.cleaning.templateDetails(id));
}

// ----------------------------------------------------------------------
// Checklist / Review (Admin, Manager)

export async function getCleaningChecklist(
  date: string,
  block: string
): Promise<ICleaningTaskInstance[]> {
  const response = await axios.get<ICleaningTaskInstance[]>(endpoints.cleaning.checklist, {
    params: { date, block },
  });
  return response.data;
}

export async function reviewCleaningTask(
  id: string,
  data: { status: 'Passed' | 'Failed'; reviewNote?: string }
): Promise<ICleaningTaskInstance> {
  const response = await axios.post<ICleaningTaskInstance>(endpoints.cleaning.reviewTask(id), data);
  return response.data;
}

export async function getShiftStaffForPenalty(id: string): Promise<IShiftStaffForPenalty[]> {
  const response = await axios.get<IShiftStaffForPenalty[]>(endpoints.cleaning.shiftStaff(id));
  return response.data;
}

export async function createCleaningPenalty(
  id: string,
  data: { userId: string; amount: number; reason?: string }
): Promise<ICleaningPenalty> {
  const response = await axios.post<ICleaningPenalty>(endpoints.cleaning.createPenalty(id), data);
  return response.data;
}

export async function voidCleaningPenalty(id: string): Promise<void> {
  await axios.post(endpoints.cleaning.voidPenalty(id));
}

// ----------------------------------------------------------------------
// Week overview (Manager tracking calendar)

export async function getCleaningWeekOverview(fromDate: string, toDate: string): Promise<ICleaningWeekCell[]> {
  const response = await axios.get<ICleaningWeekCell[]>(endpoints.cleaning.weekOverview, {
    params: { fromDate, toDate },
  });
  return response.data;
}
