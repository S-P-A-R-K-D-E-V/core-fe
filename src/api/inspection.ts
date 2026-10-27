import axios, { endpoints } from 'src/utils/axios';

import type {
  ICorrectiveAction,
  IInspection,
  IInspectionDashboard,
  IInspectionFault,
  IInspectionResultInput,
  IInspectionShift,
  IInspectionStats,
  IInspectionSummary,
  IInspectionTemplate,
  IInspectionTemplateItemInput,
  IPagedResult,
  CorrectiveActionStatus,
  InspectionStatus,
  InspectionType,
} from 'src/types/inspection';

// ----------------------------------------------------------------------
// Kiểm tra cửa hàng (/inspections, /corrective-actions). Ảnh: xin URL presigned rồi PUT thẳng lên kho riêng tư (không đi
// qua API), sau đó gửi object key kèm kết quả / lúc đánh dấu đã sửa.
// ----------------------------------------------------------------------

// ── Bảng kiểm ──────────────────────────────────────────────────────────

export async function getInspectionTemplates(type?: InspectionType): Promise<IInspectionTemplate[]> {
  const response = await axios.get<IInspectionTemplate[]>(endpoints.inspections.templates, { params: { type } });
  return response.data;
}

/** Bản nháp mới: fromDefault = lấy bảng kiểm mẫu; không thì chép phiên bản mới nhất. */
export async function createInspectionTemplateDraft(
  type: InspectionType,
  fromDefault: boolean,
  effectiveFrom?: string
): Promise<IInspectionTemplate> {
  const response = await axios.post<IInspectionTemplate>(endpoints.inspections.templates, { type, fromDefault, effectiveFrom });
  return response.data;
}

export async function saveInspectionTemplateDraft(
  id: string,
  name: string,
  effectiveFrom: string,
  items: IInspectionTemplateItemInput[]
): Promise<IInspectionTemplate> {
  const response = await axios.put<IInspectionTemplate>(endpoints.inspections.template(id), { name, effectiveFrom, items });
  return response.data;
}

export async function publishInspectionTemplate(id: string): Promise<IInspectionTemplate> {
  const response = await axios.post<IInspectionTemplate>(endpoints.inspections.publishTemplate(id));
  return response.data;
}

export async function deleteInspectionTemplateDraft(id: string): Promise<void> {
  await axios.delete(endpoints.inspections.template(id));
}

// ── Ca, tổng quan, thống kê ────────────────────────────────────────────

export async function getInspectionShifts(date?: string): Promise<IInspectionShift[]> {
  const response = await axios.get<IInspectionShift[]>(endpoints.inspections.shifts, { params: { date } });
  return response.data;
}

export async function getInspectionDashboard(): Promise<IInspectionDashboard> {
  const response = await axios.get<IInspectionDashboard>(endpoints.inspections.dashboard);
  return response.data;
}

export async function getInspectionStats(from?: string, to?: string): Promise<IInspectionStats> {
  const response = await axios.get<IInspectionStats>(endpoints.inspections.stats, { params: { from, to } });
  return response.data;
}

// ── Lượt kiểm ─────────────────────────────────────────────────────────

export type InspectionListParams = {
  from?: string;
  to?: string;
  type?: InspectionType;
  status?: InspectionStatus;
  page: number;
  pageSize: number;
};

export async function getInspections(params: InspectionListParams): Promise<IPagedResult<IInspectionSummary>> {
  const response = await axios.get<IPagedResult<IInspectionSummary>>(endpoints.inspections.list, { params });
  return response.data;
}

export async function getInspection(id: string): Promise<IInspection> {
  const response = await axios.get<IInspection>(endpoints.inspections.details(id));
  return response.data;
}

export async function startInspection(
  type: InspectionType,
  date: string,
  shiftScheduleId: string,
  isSpotCheck: boolean
): Promise<IInspection> {
  const response = await axios.post<IInspection>(endpoints.inspections.list, { type, date, shiftScheduleId, isSpotCheck });
  return response.data;
}

export async function saveInspectionResults(id: string, results: IInspectionResultInput[]): Promise<IInspection> {
  const response = await axios.put<IInspection>(endpoints.inspections.results(id), { results });
  return response.data;
}

export async function submitInspection(id: string, note?: string): Promise<IInspection> {
  const response = await axios.post<IInspection>(endpoints.inspections.submit(id), { note: note || null });
  return response.data;
}

/** Tải ảnh lên kho riêng tư của lượt kiểm, trả object key để gửi kèm kết quả / đánh dấu đã sửa. */
export async function uploadInspectionPhotos(inspectionId: string, files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const presign = await axios.post<{ objectKey: string; uploadUrl: string }[]>(
    endpoints.inspections.presignPhotos(inspectionId),
    { files: files.map((f) => ({ contentType: f.type })) }
  );
  await Promise.all(
    presign.data.map(async (p, i) => {
      const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': files[i].type }, body: files[i] });
      if (!put.ok) throw new Error(`Tải ảnh lên thất bại (${put.status})`);
    })
  );
  return presign.data.map((p) => p.objectKey);
}

// ── Lỗi ───────────────────────────────────────────────────────────────

export async function getOpenInspectionFaults(scope: 'mine' | 'all'): Promise<IInspectionFault[]> {
  const response = await axios.get<IInspectionFault[]>(endpoints.inspections.faults, { params: { scope } });
  return response.data;
}

/** Lỗi ghi cho chính mình trong tháng ("yyyy-MM"; bỏ trống = tháng này). */
export async function getMyInspectionFaults(month?: string): Promise<IInspectionFault[]> {
  const response = await axios.get<IInspectionFault[]>(endpoints.inspections.mine, { params: { month } });
  return response.data;
}

export async function fixInspectionResult(resultId: string, note: string | null, fixedPhotoKeys: string[]): Promise<void> {
  await axios.post(endpoints.inspections.fix(resultId), { note, fixedPhotoKeys });
}

// ── Việc sửa tận gốc ───────────────────────────────────────────────────

export async function getCorrectiveActions(status?: CorrectiveActionStatus): Promise<ICorrectiveAction[]> {
  const response = await axios.get<ICorrectiveAction[]>(endpoints.correctiveActions.list, { params: { status } });
  return response.data;
}

export type CorrectiveActionInput = {
  title: string;
  itemCode?: string | null;
  rootCause?: string | null;
  action?: string | null;
  ownerUserId?: string | null;
  dueDate?: string | null;
};

export async function createCorrectiveAction(input: CorrectiveActionInput): Promise<ICorrectiveAction> {
  const response = await axios.post<ICorrectiveAction>(endpoints.correctiveActions.list, input);
  return response.data;
}

export async function updateCorrectiveAction(
  id: string,
  input: CorrectiveActionInput & { status: CorrectiveActionStatus }
): Promise<ICorrectiveAction> {
  const response = await axios.put<ICorrectiveAction>(endpoints.correctiveActions.details(id), input);
  return response.data;
}
