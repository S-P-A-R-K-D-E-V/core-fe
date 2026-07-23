import axios, { endpoints } from 'src/utils/axios';

import type {
  ICleaningPenalty,
  ICleaningTaskDefinition,
  ICleaningTaskInstance,
  ICleaningTaskTemplate,
  ICleaningTemplateWeekCell,
  ICleaningWeekCell,
  ICreateCleaningTaskDefinitionRequest,
  ICreateCleaningTaskTemplateRequest,
  IMyCleaningChecklist,
  IShiftStaffForPenalty,
  IUpdateCleaningTaskDefinitionRequest,
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

// ----------------------------------------------------------------------
// Task library (Admin CRUD)

export async function getCleaningTaskDefinitions(): Promise<ICleaningTaskDefinition[]> {
  const response = await axios.get<ICleaningTaskDefinition[]>(endpoints.cleaning.taskDefinitions);
  return response.data;
}

export async function createCleaningTaskDefinition(
  data: ICreateCleaningTaskDefinitionRequest
): Promise<ICleaningTaskDefinition> {
  const response = await axios.post<ICleaningTaskDefinition>(endpoints.cleaning.taskDefinitions, data);
  return response.data;
}

export async function updateCleaningTaskDefinition(
  id: string,
  data: IUpdateCleaningTaskDefinitionRequest
): Promise<ICleaningTaskDefinition> {
  const response = await axios.put<ICleaningTaskDefinition>(endpoints.cleaning.taskDefinitionDetails(id), data);
  return response.data;
}

export async function deleteCleaningTaskDefinition(id: string): Promise<void> {
  await axios.delete(endpoints.cleaning.taskDefinitionDetails(id));
}

// ----------------------------------------------------------------------
// Checklist week builder (kéo-thả)

export async function getCleaningTemplateWeek(weekStart: string): Promise<ICleaningTemplateWeekCell[]> {
  const response = await axios.get<ICleaningTemplateWeekCell[]>(endpoints.cleaning.templateWeek, {
    params: { weekStart },
  });
  return response.data;
}

export async function duplicateCleaningWeek(weekStart: string): Promise<{ createdCount: number }> {
  const response = await axios.post<{ createdCount: number }>(endpoints.cleaning.duplicateWeek, { weekStart });
  return response.data;
}

// ----------------------------------------------------------------------
// My checklist (Staff)

export async function getMyCleaningChecklist(date: string): Promise<IMyCleaningChecklist[]> {
  const response = await axios.get<IMyCleaningChecklist[]>(endpoints.cleaning.myChecklist, {
    params: { date },
  });
  return response.data;
}

export async function completeCleaningTask(id: string, photos: File[]): Promise<ICleaningTaskInstance> {
  const formData = new FormData();
  photos.forEach((file) => formData.append('photos', file));
  const response = await axios.post<ICleaningTaskInstance>(endpoints.cleaning.completeTask(id), formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
