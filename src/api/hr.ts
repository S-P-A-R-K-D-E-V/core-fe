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
  IContractField,
  IContractCustomField,
  IContractTerms,
  IEmployeeProfile,
  IContractPreview,
  IContractTemplate,
  IContractTemplateImport,
  IEmploymentContract,
  EmployeeProfileInput,
  EmploymentContractType,
  EmploymentContractStatus,
  ISupportShiftOpening,
  IProposedAssignment,
  IProposedAssignmentWarnings,
  ICompensation,
  IViolationRule,
  IMyViolations,
  IViolationEntry,
  IViolationMonth,
  IViolationPolicy,
  IViolationCatalog,
  ISaveViolationRule,
  ViolationEntryStatus,
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
  /** "A,C" — khu người đó sẽ đứng; kèm trưởng ca để có cảnh báo vai trò. */
  zones?: string;
  isShiftLead?: boolean;
}): Promise<IHourWarning[]> {
  const response = await axios.get<IHourWarning[]>(endpoints.hr.hourWarnings, { params });
  return response.data;
}

/** Cảnh báo cho cả lô ca dự kiến (xét cả các ca khác trong lô) — chỉ trả ca có cảnh báo. */
export async function getBatchHourWarnings(items: IProposedAssignment[]): Promise<IProposedAssignmentWarnings[]> {
  const response = await axios.post<IProposedAssignmentWarnings[]>(endpoints.hr.hourWarningsBatch, { items });
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
  fileKey?: string | null;
  fileName?: string | null;
}): Promise<IPolicyDocument> {
  const response = await axios.post<IPolicyDocument>(endpoints.hr.policies, body);
  return response.data;
}

/** Tải tệp văn bản (PDF / ảnh) lên kho riêng tư, trả object key để gửi kèm khi đăng. */
export async function uploadPolicyFile(file: File): Promise<string> {
  const presign = await axios.post<{ objectKey: string; uploadUrl: string }>(endpoints.hr.policyFilePresign, {
    contentType: file.type,
    fileName: file.name,
  });
  const put = await fetch(presign.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!put.ok) throw new Error(`Tải tệp lên thất bại (${put.status})`);
  return presign.data.objectKey;
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

/** Thu hồi công bố các tuần trong [from, to] — nhân viên không thấy nữa cho tới khi công bố lại. */
export async function unpublishSalesTargets(from: string, to: string): Promise<number> {
  const response = await axios.post<{ unpublished: number }>(endpoints.hr.targetsUnpublish, { from, to });
  return response.data.unpublished;
}

export async function getWeeklyBonus(from: string, to: string): Promise<IWeeklyBonus[]> {
  const response = await axios.get<IWeeklyBonus[]>(endpoints.hr.weeklyBonus, { params: { from, to } });
  return response.data;
}

// ── Việc giao riêng (Việc được giao → cho một người) ──────────────────

export async function getWorkTasks(params: { month?: string; assigneeId?: string; status?: WorkTaskStatus }): Promise<IWorkTask[]> {
  const response = await axios.get<IWorkTask[]>(endpoints.hr.tasks, { params });
  return response.data;
}

export async function getMyWorkTasks(month?: string): Promise<IWorkTask[]> {
  const response = await axios.get<IWorkTask[]>(endpoints.hr.tasksMine, { params: { month } });
  return response.data;
}

export async function assignWorkTask(body: {
  title: string;
  description?: string | null;
  assigneeId: string;
  dueAt?: string | null;
}): Promise<IWorkTask> {
  const response = await axios.post<IWorkTask>(endpoints.hr.tasks, body);
  return response.data;
}

/** Tải ảnh nghiệm thu lên kho riêng tư của việc, trả object key để gửi khi nộp. */
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

export async function reviewWorkTask(id: string, approve: boolean, note: string | null): Promise<IWorkTask> {
  const response = await axios.put<IWorkTask>(endpoints.hr.taskReview(id), { approve, note });
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

// ── Hợp đồng lao động + hồ sơ nhân sự (chỉ Admin; nhân viên chỉ xem của mình) ─

export async function getContractFields(): Promise<IContractField[]> {
  const response = await axios.get<IContractField[]>(endpoints.hr.contractFields);
  return response.data;
}

export async function getContractTemplates(): Promise<IContractTemplate[]> {
  const response = await axios.get<IContractTemplate[]>(endpoints.hr.contractTemplates);
  return response.data;
}

/** Bản nháp mẫu mới: copyFromId = phiên bản mới của mẫu đó; null = mẫu trống (HTML). */
export async function createContractTemplate(copyFromId: string | null): Promise<IContractTemplate> {
  const response = await axios.post<IContractTemplate>(endpoints.hr.contractTemplates, { copyFromId });
  return response.data;
}

/** isHtml = true: body là HTML từ trình soạn (máy chủ lọc thẻ). customFields = trường riêng của mẫu. */
export async function updateContractTemplate(
  id: string,
  body: {
    code: string;
    name: string;
    contractType: EmploymentContractType;
    body: string;
    isHtml?: boolean;
    /** Trường riêng của mẫu; không gửi = giữ nguyên. */
    customFields?: IContractCustomField[];
  }
): Promise<IContractTemplate> {
  const response = await axios.put<IContractTemplate>(endpoints.hr.contractTemplate(id), body);
  return response.data;
}

export async function publishContractTemplate(id: string): Promise<IContractTemplate> {
  const response = await axios.post<IContractTemplate>(endpoints.hr.contractTemplatePublish(id));
  return response.data;
}

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Gắn mẫu Word (.docx) cho bản nháp mẫu: xin URL, PUT thẳng kho riêng tư, rồi báo máy chủ (kiểm trường trộn). */
export async function uploadContractTemplateDocx(templateId: string, file: File): Promise<IContractTemplate> {
  const presign = await axios.post<{ objectKey: string; uploadUrl: string }>(endpoints.hr.contractTemplateDocxPresign(templateId));
  const put = await fetch(presign.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': DOCX_TYPE }, body: file });
  if (!put.ok) throw new Error(`Tải tệp lên thất bại (${put.status})`);
  const response = await axios.put<IContractTemplate>(endpoints.hr.contractTemplateDocx(templateId), {
    objectKey: presign.data.objectKey,
    fileName: file.name,
  });
  return response.data;
}

export async function removeContractTemplateDocx(templateId: string): Promise<IContractTemplate> {
  const response = await axios.put<IContractTemplate>(endpoints.hr.contractTemplateDocx(templateId), { objectKey: null });
  return response.data;
}

export async function deleteContractTemplate(id: string): Promise<void> {
  await axios.delete(endpoints.hr.contractTemplate(id));
}

const PDF_TYPE = 'application/pdf';

/** Kiểu tệp mẫu tải lên theo đuôi (trình duyệt đôi khi để trống type của .docx). */
export function contractImportType(file: File): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx') || file.type === DOCX_TYPE) return DOCX_TYPE;
  if (name.endsWith('.pdf') || file.type === PDF_TYPE) return PDF_TYPE;
  return null;
}

/**
 * Tải mẫu hợp đồng (.docx / .pdf) vào bản nháp: xin URL, PUT thẳng kho riêng tư, rồi máy chủ đọc tệp + AI gắn trường
 * (có thể mất khoảng 1 phút). Nội dung bản nháp được thay bằng HTML đọc được.
 */
export async function importContractTemplateFile(templateId: string, file: File): Promise<IContractTemplateImport> {
  const upload = await uploadContractTemplateImport(templateId, file);
  const response = await axios.post<IContractTemplateImport>(endpoints.hr.contractTemplateImport(templateId), upload, {
    timeout: 180_000,
  });
  return response.data;
}

/** Bước 1 của tải mẫu: xin URL rồi PUT thẳng tệp lên kho riêng tư; trả object key để máy chủ đọc (import / import stream). */
export async function uploadContractTemplateImport(
  templateId: string,
  file: File
): Promise<{ objectKey: string; fileName: string }> {
  const contentType = contractImportType(file);
  if (!contentType) throw new Error('Chỉ nhận tệp .docx hoặc .pdf');
  const presign = await axios.post<{ objectKey: string; uploadUrl: string }>(
    endpoints.hr.contractTemplateImportPresign(templateId),
    { contentType }
  );
  const put = await fetch(presign.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!put.ok) throw new Error(`Tải tệp lên thất bại (${put.status})`);
  return { objectKey: presign.data.objectKey, fileName: file.name };
}

/** Xem trước mẫu với hồ sơ + lương hiện tại của một nhân viên. */
export async function previewContractTemplate(templateId: string, staffId: string): Promise<IContractPreview> {
  const response = await axios.post<IContractPreview>(endpoints.hr.contractTemplatePreview(templateId), { staffId });
  return response.data;
}

export async function getEmployeeProfiles(): Promise<IEmployeeProfile[]> {
  const response = await axios.get<IEmployeeProfile[]>(endpoints.hr.employeeProfiles);
  return response.data;
}

export async function saveEmployeeProfile(userId: string, body: EmployeeProfileInput): Promise<IEmployeeProfile> {
  const response = await axios.put<IEmployeeProfile>(endpoints.hr.employeeProfile(userId), body);
  return response.data;
}

export async function getContracts(params: { staffId?: string; status?: EmploymentContractStatus }): Promise<IEmploymentContract[]> {
  const response = await axios.get<IEmploymentContract[]>(endpoints.hr.contracts, { params });
  return response.data;
}

export async function getMyContracts(): Promise<IEmploymentContract[]> {
  const response = await axios.get<IEmploymentContract[]>(endpoints.hr.contractsMine);
  return response.data;
}

/** Giá trị trường riêng của mẫu đi trong terms.customValues (gửi kèm cả ở ngoài cho chắc). */
export async function createContract(staffId: string, templateId: string, terms: IContractTerms): Promise<IEmploymentContract> {
  const response = await axios.post<IEmploymentContract>(endpoints.hr.contracts, {
    staffId,
    templateId,
    terms,
    customValues: terms.customValues ?? null,
  });
  return response.data;
}

/** Sửa bản nháp — gửi lại điều khoản cũ để trộn lại theo hồ sơ / lương mới nhất. */
/** Đăng hợp đồng / phụ lục giấy đã ký từ trước (không soạn từ mẫu); sau đó tải bản ký như thường. */
export async function importPaperContract(
  staffId: string,
  terms: IContractTerms,
  contractNumber: string | null,
  note: string | null
): Promise<IEmploymentContract> {
  const response = await axios.post<IEmploymentContract>(endpoints.hr.contractImport, { staffId, terms, contractNumber, note });
  return response.data;
}

export async function updateContractDraft(id: string, terms: IContractTerms): Promise<IEmploymentContract> {
  const response = await axios.put<IEmploymentContract>(endpoints.hr.contract(id), terms);
  return response.data;
}

export async function finalizeContract(id: string): Promise<IEmploymentContract> {
  const response = await axios.post<IEmploymentContract>(endpoints.hr.contractFinalize(id));
  return response.data;
}

/** Nội dung bản nháp để sửa tay: HTML đã trộn hồ sơ, còn giữ {{so_hop_dong}} và hai trường chữ ký. */
export async function getEditableContractBody(id: string): Promise<string> {
  const response = await axios.get<{ body: string }>(endpoints.hr.contractEditable(id));
  return response.data.body;
}

/** Lưu nội dung sửa tay của bản nháp; null = bỏ sửa tay, trộn lại từ mẫu. */
export async function saveContractBody(id: string, body: string | null): Promise<IEmploymentContract> {
  const response = await axios.put<IEmploymentContract>(endpoints.hr.contractBody(id), { body });
  return response.data;
}

/** Nét vẽ chữ ký: mỗi nét là danh sách [x, y] theo toạ độ khung ký (0..width, 0..height). */
export type SignatureStrokes = number[][][];

/** Nhân viên ký hợp đồng của mình (chữ ký vẽ + đồng ý lời cam kết). */
export async function signContract(
  id: string,
  signature: { strokes: SignatureStrokes; width: number; height: number }
): Promise<IEmploymentContract> {
  const response = await axios.post<IEmploymentContract>(endpoints.hr.contractSign(id), { ...signature, agree: true });
  return response.data;
}

/** Tải bản ký (ảnh / PDF) lên kho riêng tư của hợp đồng, trả object key + kiểu để ghi nhận đã ký. */
export async function uploadContractFiles(id: string, files: File[]): Promise<{ objectKey: string; contentType: string }[]> {
  if (files.length === 0) return [];
  const presign = await axios.post<{ objectKey: string; uploadUrl: string }[]>(endpoints.hr.contractPresign(id), {
    files: files.map((f) => ({ contentType: f.type })),
  });
  await Promise.all(
    presign.data.map(async (p, i) => {
      const put = await fetch(p.uploadUrl, { method: 'PUT', headers: { 'Content-Type': files[i].type }, body: files[i] });
      if (!put.ok) throw new Error(`Tải tệp lên thất bại (${put.status})`);
    })
  );
  return presign.data.map((p, i) => ({ objectKey: p.objectKey, contentType: files[i].type }));
}

export async function markContractSigned(
  id: string,
  signedOn: string,
  files: { objectKey: string; contentType: string }[]
): Promise<IEmploymentContract> {
  const response = await axios.put<IEmploymentContract>(endpoints.hr.contractSigned(id), { signedOn, files });
  return response.data;
}

export async function terminateContract(id: string, terminatedOn: string, reason: string): Promise<IEmploymentContract> {
  const response = await axios.put<IEmploymentContract>(endpoints.hr.contractTerminate(id), { terminatedOn, reason });
  return response.data;
}

export async function voidContract(id: string, reason: string): Promise<IEmploymentContract> {
  const response = await axios.put<IEmploymentContract>(endpoints.hr.contractVoid(id), { reason });
  return response.data;
}

// ── Ca hỗ trợ mở trên chợ ca ───────────────────────────────────────────

export async function getSupportShifts(params?: {
  from?: string;
  to?: string;
  openOnly?: boolean;
}): Promise<ISupportShiftOpening[]> {
  const response = await axios.get<ISupportShiftOpening[]>(endpoints.hr.supportShifts, { params });
  return response.data;
}

export async function createSupportShift(body: {
  shiftScheduleId: string;
  date: string;
  slots: number;
  note?: string | null;
}): Promise<ISupportShiftOpening> {
  const response = await axios.post<ISupportShiftOpening>(endpoints.hr.supportShifts, body);
  return response.data;
}

export async function cancelSupportShift(id: string, note?: string): Promise<ISupportShiftOpening> {
  const response = await axios.put<ISupportShiftOpening>(endpoints.hr.supportShiftCancel(id), { note: note || null });
  return response.data;
}

export async function claimSupportShift(id: string, note?: string): Promise<ISupportShiftOpening> {
  const response = await axios.post<ISupportShiftOpening>(endpoints.hr.supportShiftClaim(id), { note: note || null });
  return response.data;
}

export async function withdrawSupportClaim(claimId: string): Promise<ISupportShiftOpening> {
  const response = await axios.put<ISupportShiftOpening>(endpoints.hr.supportClaimWithdraw(claimId));
  return response.data;
}

export async function reviewSupportClaim(
  claimId: string,
  approve: boolean,
  note?: string
): Promise<ISupportShiftOpening> {
  const response = await axios.put<ISupportShiftOpening>(endpoints.hr.supportClaimReview(claimId), {
    approve,
    note: note || null,
  });
  return response.data;
}

// ── Bồi thường thiệt hại ───────────────────────────────────────────────

export async function getCompensations(staffId?: string): Promise<ICompensation[]> {
  const response = await axios.get<ICompensation[]>(endpoints.hr.compensations, { params: { staffId } });
  return response.data;
}

export async function getMyCompensations(): Promise<ICompensation[]> {
  const response = await axios.get<ICompensation[]>(endpoints.hr.compensationsMine);
  return response.data;
}

export async function createCompensation(body: { hrRecordId: string; amount: number; note?: string | null }): Promise<ICompensation> {
  const response = await axios.post<ICompensation>(endpoints.hr.compensations, body);
  return response.data;
}

export async function cancelCompensation(id: string, reason: string): Promise<ICompensation> {
  const response = await axios.put<ICompensation>(endpoints.hr.compensationCancel(id), { reason });
  return response.data;
}

// ── Danh mục vi phạm + điểm trừ ─────────────────────────────────────

export async function getViolationCatalog(): Promise<IViolationCatalog> {
  const response = await axios.get<IViolationCatalog>(endpoints.hr.violationCatalog);
  return response.data;
}

export async function saveViolationPolicy(body: {
  effectiveFrom: string;
  halfBonusFromPoints: number | null;
  halfBonusPct: number | null;
  noBonusFromPoints: number | null;
  notCompleteFromPoints: number | null;
  appliesToBonus: boolean;
}): Promise<IViolationPolicy> {
  const response = await axios.put<IViolationPolicy>(endpoints.hr.violationPolicy, body);
  return response.data;
}

export async function saveViolationRule(id: string | null, body: ISaveViolationRule): Promise<IViolationRule> {
  const response = id
    ? await axios.put<IViolationRule>(endpoints.hr.violationRule(id), body)
    : await axios.post<IViolationRule>(endpoints.hr.violationRules, body);
  return response.data;
}

export async function archiveViolationRule(id: string): Promise<void> {
  await axios.delete(endpoints.hr.violationRule(id));
}

export async function getViolations(params: {
  month: string;
  userId?: string;
  status?: ViolationEntryStatus;
}): Promise<IViolationEntry[]> {
  const response = await axios.get<IViolationEntry[]>(endpoints.hr.violations, { params });
  return response.data;
}

export async function getViolationSummary(month: string): Promise<IViolationMonth> {
  const response = await axios.get<IViolationMonth>(endpoints.hr.violationSummary, { params: { month } });
  return response.data;
}

export async function getMyViolations(month: string): Promise<IMyViolations> {
  const response = await axios.get<IMyViolations>(endpoints.hr.violationsMine, { params: { month } });
  return response.data;
}

export async function createViolations(body: {
  ruleId: string;
  userIds: string[];
  occurredOn: string;
  quantity: number;
  note: string;
}): Promise<IViolationEntry[]> {
  const response = await axios.post<IViolationEntry[]>(endpoints.hr.violations, body);
  return response.data;
}

export async function cancelViolation(id: string, note: string): Promise<IViolationEntry> {
  const response = await axios.put<IViolationEntry>(endpoints.hr.violationCancel(id), { note });
  return response.data;
}

export async function resolveViolation(id: string, keep: boolean, note: string): Promise<IViolationEntry> {
  const response = await axios.put<IViolationEntry>(endpoints.hr.violationResolve(id), { keep, note });
  return response.data;
}

export async function complainViolation(id: string, text: string): Promise<IViolationEntry> {
  const response = await axios.post<IViolationEntry>(endpoints.hr.violationComplaint(id), { text });
  return response.data;
}

export async function syncViolations(): Promise<{ created: number; updated: number; cancelled: number }> {
  const response = await axios.post<{ created: number; updated: number; cancelled: number }>(endpoints.hr.violationsSync);
  return response.data;
}
