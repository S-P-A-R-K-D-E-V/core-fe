import axios, { endpoints } from 'src/utils/axios';

import type {
  IHourWarning,
  IHrRecord,
  IShiftLeave,
  IWorkTask,
  ISalesTarget,
  IWeeklyBonus,
  IExcludedShift,
  ICreateHrRecord,
  IPolicyDocument,
  WorkTaskGroup,
  WorkTaskStatus,
  HrRecordType,
  ShiftLeaveStatus,
  IPerformanceMonth,
  IPerformanceScore,
  IPolicyAcknowledgementStatus,
} from 'src/types/hr';

// ----------------------------------------------------------------------
// Nhân sự theo Quy chế / Nội quy CiCi. Ảnh nghiệm thu nhiệm vụ: xin URL presigned rồi PUT thẳng lên kho riêng tư, sau đó
// gửi object key khi nộp.
// ----------------------------------------------------------------------

// ── Cảnh báo giờ ───────────────────────────────────────────────────────

/** Cảnh báo khi xếp một người vào ca (chỉ cảnh báo, không chặn). */
export async function getHourWarnings(params: {
  staffId: string;
  date: string;
  shiftScheduleId: string;
  excludeAssignmentId?: string;
}): Promise<IHourWarning[]> {
  const response = await axios.get<IHourWarning[]>(endpoints.hr.hourWarnings, { params });
  return response.data;
}

// ── Xin nghỉ ca ────────────────────────────────────────────────────────

export async function createShiftLeave(body: {
  shiftAssignmentId: string;
  reason: string;
  isEmergency: boolean;
}): Promise<IShiftLeave> {
  const response = await axios.post<IShiftLeave>(endpoints.hr.leave, body);
  return response.data;
}

export async function cancelShiftLeave(id: string): Promise<IShiftLeave> {
  const response = await axios.put<IShiftLeave>(endpoints.hr.leaveCancel(id));
  return response.data;
}

export async function reviewShiftLeave(id: string, approve: boolean, note?: string): Promise<IShiftLeave> {
  const response = await axios.put<IShiftLeave>(endpoints.hr.leaveReview(id), { approve, note: note || null });
  return response.data;
}

export async function getMyShiftLeaves(): Promise<IShiftLeave[]> {
  const response = await axios.get<IShiftLeave[]>(endpoints.hr.leaveMine);
  return response.data;
}

export async function getPendingShiftLeaves(): Promise<IShiftLeave[]> {
  const response = await axios.get<IShiftLeave[]>(endpoints.hr.leavePending);
  return response.data;
}

export async function getShiftLeaves(params: { from?: string; to?: string; status?: ShiftLeaveStatus }): Promise<IShiftLeave[]> {
  const response = await axios.get<IShiftLeave[]>(endpoints.hr.leave, { params });
  return response.data;
}

// ── Văn bản ký xác nhận ────────────────────────────────────────────────

export async function getPolicyDocuments(scope: 'all' | 'active' | 'pending'): Promise<IPolicyDocument[]> {
  const url =
    scope === 'all' ? endpoints.hr.policies : scope === 'active' ? endpoints.hr.policiesActive : endpoints.hr.policiesPending;
  const response = await axios.get<IPolicyDocument[]>(url);
  return response.data;
}

export async function publishPolicyDocument(body: {
  code: string;
  title: string;
  url?: string | null;
  summary?: string | null;
}): Promise<IPolicyDocument> {
  const response = await axios.post<IPolicyDocument>(endpoints.hr.policies, body);
  return response.data;
}

export async function deactivatePolicyDocument(id: string): Promise<IPolicyDocument> {
  const response = await axios.put<IPolicyDocument>(endpoints.hr.policyDeactivate(id));
  return response.data;
}

export async function acknowledgePolicyDocument(id: string): Promise<IPolicyDocument> {
  const response = await axios.post<IPolicyDocument>(endpoints.hr.policyAcknowledge(id));
  return response.data;
}

export async function getPolicyAcknowledgements(id: string): Promise<IPolicyAcknowledgementStatus> {
  const response = await axios.get<IPolicyAcknowledgementStatus>(endpoints.hr.policyAcknowledgements(id));
  return response.data;
}

// ── Target tuần ────────────────────────────────────────────────────────

export async function getSalesTargets(from: string, to: string): Promise<ISalesTarget[]> {
  const response = await axios.get<ISalesTarget[]>(endpoints.hr.targets, { params: { from, to } });
  return response.data;
}

export async function generateSalesTargets(from: string, to: string): Promise<ISalesTarget[]> {
  const response = await axios.post<ISalesTarget[]>(endpoints.hr.targetsGenerate, { from, to });
  return response.data;
}

/** targetAmount null = bỏ số sửa tay, dùng lại target tự tính. */
export async function updateSalesTarget(weekStart: string, targetAmount: number | null, note?: string): Promise<ISalesTarget> {
  const response = await axios.put<ISalesTarget>(endpoints.hr.target(weekStart), { targetAmount, note: note || null });
  return response.data;
}

export async function publishSalesTargets(from: string, to: string): Promise<number> {
  const response = await axios.post<{ published: number }>(endpoints.hr.targetsPublish, { from, to });
  return response.data.published;
}

export async function getWeeklyBonus(from: string, to: string): Promise<IWeeklyBonus[]> {
  const response = await axios.get<IWeeklyBonus[]>(endpoints.hr.weeklyBonus, { params: { from, to } });
  return response.data;
}

// ── Nhiệm vụ ───────────────────────────────────────────────────────────

export async function getWorkTasks(params: { month?: string; assigneeId?: string; status?: WorkTaskStatus }): Promise<IWorkTask[]> {
  const response = await axios.get<IWorkTask[]>(endpoints.hr.tasks, { params });
  return response.data;
}

export async function getMyWorkTasks(month?: string): Promise<IWorkTask[]> {
  const response = await axios.get<IWorkTask[]>(endpoints.hr.tasksMine, { params: { month } });
  return response.data;
}

export async function assignWorkTask(body: {
  group: WorkTaskGroup;
  title: string;
  description?: string | null;
  assigneeId: string;
  dueAt?: string | null;
}): Promise<IWorkTask> {
  const response = await axios.post<IWorkTask>(endpoints.hr.tasks, body);
  return response.data;
}

export async function createInitiative(title: string, description: string): Promise<IWorkTask> {
  const response = await axios.post<IWorkTask>(endpoints.hr.taskInitiative, { title, description });
  return response.data;
}

/** Tải ảnh nghiệm thu lên kho riêng tư của nhiệm vụ, trả object key để gửi khi nộp. */
export async function uploadWorkTaskPhotos(taskId: string, files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const presign = await axios.post<{ objectKey: string; uploadUrl: string }[]>(endpoints.hr.taskPresign(taskId), {
    files: files.map((f) => ({ contentType: f.type })),
  });
  await Promise.all(
    presign.data.map(async (p, i) => {
      const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': files[i].type }, body: files[i] });
      if (!put.ok) throw new Error(`Tải ảnh lên thất bại (${put.status})`);
    })
  );
  return presign.data.map((p) => p.objectKey);
}

export async function submitWorkTask(id: string, note: string | null, photoKeys: string[]): Promise<IWorkTask> {
  const response = await axios.put<IWorkTask>(endpoints.hr.taskSubmit(id), { note, photoKeys });
  return response.data;
}

export async function reviewWorkTask(id: string, approve: boolean, note: string | null, implemented = false): Promise<IWorkTask> {
  const response = await axios.put<IWorkTask>(endpoints.hr.taskReview(id), { approve, note, implemented });
  return response.data;
}

export async function cancelWorkTask(id: string): Promise<IWorkTask> {
  const response = await axios.put<IWorkTask>(endpoints.hr.taskCancel(id));
  return response.data;
}

// ── Biên bản ───────────────────────────────────────────────────────────

export async function getHrRecords(params: { month?: string; staffId?: string; type?: HrRecordType }): Promise<IHrRecord[]> {
  const response = await axios.get<IHrRecord[]>(endpoints.hr.records, { params });
  return response.data;
}

export async function getMyHrRecords(): Promise<IHrRecord[]> {
  const response = await axios.get<IHrRecord[]>(endpoints.hr.recordsMine);
  return response.data;
}

export async function createHrRecord(body: ICreateHrRecord): Promise<IHrRecord> {
  const response = await axios.post<IHrRecord>(endpoints.hr.records, body);
  return response.data;
}

export async function voidHrRecord(id: string, reason: string): Promise<IHrRecord> {
  const response = await axios.put<IHrRecord>(endpoints.hr.recordVoid(id), { reason });
  return response.data;
}

/** Người lập ghi nhận nhân viên không ký. */
export async function markHrRecordRefused(id: string, reason: string): Promise<IHrRecord> {
  const response = await axios.put<IHrRecord>(endpoints.hr.recordRefused(id), { reason });
  return response.data;
}

export async function signHrRecord(id: string, statement?: string): Promise<IHrRecord> {
  const response = await axios.put<IHrRecord>(endpoints.hr.recordSign(id), { statement: statement || null });
  return response.data;
}

export async function refuseHrRecord(id: string, reason: string): Promise<IHrRecord> {
  const response = await axios.put<IHrRecord>(endpoints.hr.recordRefuse(id), { reason });
  return response.data;
}

// ── Điểm hiệu suất + xếp loại ──────────────────────────────────────────

export async function getPerformanceMonth(month: string): Promise<IPerformanceMonth> {
  const response = await axios.get<IPerformanceMonth>(endpoints.hr.performance, { params: { month } });
  return response.data;
}

export async function computePerformance(month: string): Promise<IPerformanceMonth> {
  const response = await axios.post<IPerformanceMonth>(endpoints.hr.performanceCompute, { month });
  return response.data;
}

export async function publishPerformance(month: string): Promise<IPerformanceMonth> {
  const response = await axios.post<IPerformanceMonth>(endpoints.hr.performancePublish, { month });
  return response.data;
}

export async function getMyPerformance(): Promise<IPerformanceScore[]> {
  const response = await axios.get<IPerformanceScore[]>(endpoints.hr.performanceMine);
  return response.data;
}

export async function getExcludedShifts(month: string): Promise<IExcludedShift[]> {
  const response = await axios.get<IExcludedShift[]>(endpoints.hr.excludedShifts, { params: { month } });
  return response.data;
}

export async function addExcludedShift(date: string, shiftScheduleId: string, reason: string): Promise<IExcludedShift> {
  const response = await axios.post<IExcludedShift>(endpoints.hr.excludedShifts, { date, shiftScheduleId, reason });
  return response.data;
}

export async function removeExcludedShift(id: string): Promise<void> {
  await axios.delete(endpoints.hr.excludedShift(id));
}

export async function requestPerformanceReview(id: string, note: string): Promise<IPerformanceScore> {
  const response = await axios.post<IPerformanceScore>(endpoints.hr.reviewRequest(id), { note });
  return response.data;
}

export async function respondPerformanceReview(id: string, response: string): Promise<IPerformanceScore> {
  const res = await axios.put<IPerformanceScore>(endpoints.hr.reviewResponse(id), { response });
  return res.data;
}
