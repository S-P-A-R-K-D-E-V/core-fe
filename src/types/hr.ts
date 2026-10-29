// ----------------------------------------------------------------------
// Nhân sự theo Quy chế / Nội quy CiCi (/shift-leave, /policy-documents, /sales-targets, /work-tasks, /hr-records,
// /performance). Trạng thái / loại là chuỗi tên enum của backend.
// ----------------------------------------------------------------------

// ── Cảnh báo giờ (Nội quy Điều 5–6) ────────────────────────────────────

export type HourWarningCode =
  | 'SecondMainShift'
  | 'Overtime'
  | 'OverDailyMax'
  | 'NoWeeklyRest'
  | 'MonthOver96'
  | 'MonthOvertimeOver40'
  | 'NoBreak'
  // Vai trò (C10): người thử việc làm trưởng ca, đứng khu C một mình, 2 người thử việc cùng ca.
  | 'ProbationShiftLead'
  | 'ProbationAloneInZoneC'
  | 'TwoProbationOnShift'
  // Chợ ca: duyệt sau giờ ca, ca liền kề chồng giờ, giờ làm hộ bất thường.
  | 'RetroactiveApproval'
  | 'AdjacentOverlap'
  | 'CoverOutsideShift'
  | 'CoverTooShort'
  | 'CoverOverlapping';

export interface IHourWarning {
  code: HourWarningCode | string;
  message: string;
  hours?: number | null;
}

/** Cảnh báo của một người trong yêu cầu (người nhận / người đăng / người xin đổi / người được đổi). */
export interface IPersonHourWarnings {
  staffId: string;
  role: string;
  warnings: IHourWarning[];
}

/** Mức nghiêm trọng: quá 12 giờ / ngày, quá 96 giờ / tháng là đỏ; còn lại vàng. */
export const HOUR_WARNING_SEVERE: readonly string[] = ['OverDailyMax', 'MonthOver96'];

// ── Xin nghỉ ca ────────────────────────────────────────────────────────

export type ShiftLeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export const SHIFT_LEAVE_STATUS_LABEL: Record<ShiftLeaveStatus, string> = {
  Pending: 'Chờ duyệt',
  Approved: 'Đã duyệt',
  Rejected: 'Từ chối',
  Cancelled: 'Đã huỷ',
};

export interface IShiftLeave {
  id: string;
  staffId: string;
  staffName: string;
  shiftAssignmentId: string;
  shiftDate: string;
  shiftScheduleId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  reason: string;
  isEmergency: boolean;
  isLateNotice: boolean;
  status: ShiftLeaveStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdAt: string;
}

// ── Văn bản ký xác nhận ────────────────────────────────────────────────

export interface IPolicyDocument {
  id: string;
  code: string;
  title: string;
  version: number;
  url?: string | null;
  summary?: string | null;
  /** Tệp văn bản (PDF / ảnh) ở kho riêng tư — fileUrl là link có chữ ký. */
  fileKey?: string | null;
  fileName?: string | null;
  fileContentType?: string | null;
  fileUrl?: string | null;
  isActive: boolean;
  publishedAt: string;
  acknowledgedAt?: string | null;
}

export interface IPolicyAcknowledgementStatus {
  document: IPolicyDocument;
  acknowledged: number;
  total: number;
  rows: { userId: string; fullName: string; acknowledgedAt?: string | null }[];
}

// ── Target tuần ────────────────────────────────────────────────────────

export interface ISalesTargetSlot {
  weekday: number;
  date: string;
  shiftScheduleId: string;
  shiftName: string;
  start: string;
  end: string;
  share: number;
  target: number;
  revenue?: number | null;
}

/** Số liệu năm trước / hệ số / sàn / doanh thu chỉ có với người quản lý target. */
export interface ISalesTarget {
  weekStart: string;
  targetAmount: number;
  autoAmount?: number | null;
  lastYearRevenue?: number | null;
  trendFactor?: number | null;
  floorAmount?: number | null;
  isManual: boolean;
  note?: string | null;
  publishedAt?: string | null;
  computedAt: string;
  revenue?: number | null;
  slots: ISalesTargetSlot[];
  notes: string[];
}

export interface IWeeklyBonus {
  weekStart: string;
  target: number;
  revenue: number;
  achievementPct: number;
  fund: number;
  totalHours: number;
  shares: { userId: string; fullName: string; hours: number; amount: number }[];
}

export const WEEKDAY_LABEL: Record<number, string> = {
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
  7: 'CN',
};

// ── Việc giao riêng ─────────────────────────────────────────────────────

export type WorkTaskGroup = 'Content' | 'Inbox' | 'Packing' | 'Display' | 'Initiative' | 'Other';
export type WorkTaskStatus = 'Assigned' | 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled';

/** Nhóm của việc cũ (giao diện không còn chọn nhóm khi giao). */
export const WORK_TASK_GROUP_LABEL: Record<WorkTaskGroup, string> = {
  Content: 'Đăng nội dung',
  Inbox: 'Trả lời khách',
  Packing: 'Đóng gói đơn online',
  Display: 'Trang trí, trưng bày',
  Initiative: 'Sáng kiến',
  Other: 'Khác',
};

export const WORK_TASK_STATUS_LABEL: Record<WorkTaskStatus, string> = {
  Assigned: 'Đang làm',
  Submitted: 'Chờ duyệt',
  Approved: 'Đạt',
  Rejected: 'Trả lại',
  Cancelled: 'Đã huỷ',
};

export interface IWorkTask {
  id: string;
  group: WorkTaskGroup;
  title: string;
  description?: string | null;
  assigneeId: string;
  assigneeName: string;
  assignedBy: string;
  dueAt?: string | null;
  status: WorkTaskStatus;
  submittedAt?: string | null;
  submissionNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  implemented: boolean;
  onTime: boolean;
  createdAt: string;
  photos: { id: string; url: string; uploadedAt: string }[];
}

// ── Biên bản ───────────────────────────────────────────────────────────

export type HrRecordType = 'CashDiscrepancy' | 'StockDiscrepancy' | 'Violation' | 'Warning';
export type HrRecordStatus = 'AwaitingSignature' | 'Signed' | 'RefusedToSign' | 'Voided';

export const HR_RECORD_TYPE_LABEL: Record<HrRecordType, string> = {
  CashDiscrepancy: 'Chênh lệch tiền',
  StockDiscrepancy: 'Chênh lệch hàng',
  Violation: 'Vi phạm',
  Warning: 'Cảnh báo hoàn thành công việc',
};

export const HR_RECORD_STATUS_LABEL: Record<HrRecordStatus, string> = {
  AwaitingSignature: 'Chờ ký',
  Signed: 'Đã ký',
  RefusedToSign: 'Không ký',
  Voided: 'Đã huỷ',
};

/** Loại lập mới được — "Cảnh báo hoàn thành công việc" chỉ còn ở biên bản cũ (chủ tịch 2026-10-28). */
export const NEW_HR_RECORD_TYPES: HrRecordType[] = ['CashDiscrepancy', 'StockDiscrepancy', 'Violation'];

export interface IHrRecord {
  id: string;
  type: HrRecordType;
  staffId: string;
  staffName: string;
  occurredOn: string;
  shiftAssignmentId?: string | null;
  amount?: number | null;
  description: string;
  cause?: string | null;
  personalFault?: boolean | null;
  violationLevel?: number | null;
  evaluatedMonth?: string | null;
  improvementPlan?: string | null;
  status: HrRecordStatus;
  staffStatement?: string | null;
  signedAt?: string | null;
  refusalReason?: string | null;
  voidReason?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ICreateHrRecord {
  type: HrRecordType;
  staffId: string;
  occurredOn: string;
  shiftAssignmentId?: string | null;
  amount?: number | null;
  description: string;
  cause?: string | null;
  personalFault?: boolean | null;
  violationLevel?: number | null;
  evaluatedMonth?: string | null;
  improvementPlan?: string | null;
}

// ── Điểm hiệu suất + xếp loại ──────────────────────────────────────────

export type PerformanceRating = 'NotRated' | 'NotComplete' | 'Complete' | 'Good' | 'Excellent';

export const PERFORMANCE_RATING_LABEL: Record<PerformanceRating, string> = {
  NotRated: 'Chưa xếp loại',
  NotComplete: 'Không hoàn thành',
  Complete: 'Hoàn thành',
  Good: 'Hoàn thành tốt',
  Excellent: 'Hoàn thành xuất sắc',
};

export const PERFORMANCE_RATING_COLOR: Record<PerformanceRating, 'default' | 'error' | 'info' | 'success' | 'primary'> = {
  NotRated: 'default',
  NotComplete: 'error',
  Complete: 'info',
  Good: 'success',
  Excellent: 'primary',
};

export interface IPerformanceShiftDetail {
  date: string;
  shift?: string | null;
  hours: number;
  revenue?: number;
  target?: number | null;
  pct?: number;
  excluded?: string;
}

export interface IPerformanceDetails {
  notes?: string[];
  shifts?: IPerformanceShiftDetail[];
  quality?: {
    mine: { orders: number; avgOrderValue: number; itemsPerOrder: number; customerShare: number };
    store: { orders: number; avgOrderValue: number; itemsPerOrder: number; customerShare: number };
  };
  tasks?: { group: WorkTaskGroup; assigned: number; approvedOnTime: number }[];
  initiatives?: { approved: number; implemented: number };
}

export interface IPerformanceScore {
  id: string;
  userId: string;
  fullName: string;
  month: string;
  shiftCount: number;
  hoursWorked: number;
  targetAchievementPct?: number | null;
  lateCount: number;
  missedCheckoutCount: number;
  inspectionFaults: number;
  discrepancyFaults: number;
  salesPoints: number;
  qualityPoints: number;
  taskPoints: number;
  disciplinePoints: number;
  reconciliationPoints: number;
  initiativePoints: number;
  total: number;
  isDefaultScore: boolean;
  rating: PerformanceRating;
  ratingReason?: string | null;
  consecutiveNotComplete: boolean;
  details: IPerformanceDetails;
  computedAt: string;
  reviewRequestedAt?: string | null;
  reviewRequestNote?: string | null;
  reviewResponse?: string | null;
  reviewRespondedAt?: string | null;
  reviewDeadline?: string | null;
  /** Tổng điểm trừ theo danh mục vi phạm; null = tháng tính theo công thức cũ. */
  deductionPoints?: number | null;
}

export interface IPerformanceMonth {
  month: string;
  computedAt?: string | null;
  publishedAt?: string | null;
  scores: IPerformanceScore[];
}

export interface IExcludedShift {
  id: string;
  date: string;
  shiftScheduleId: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

// ── Hợp đồng lao động + hồ sơ nhân sự (chỉ Admin quản lý; nhân viên chỉ xem của mình) ─────

export type EmploymentContractType = 'Probation' | 'FixedTermUnder12Months' | 'FixedTerm12To36Months' | 'Indefinite' | 'Appendix';
export type EmploymentContractStatus = 'Draft' | 'AwaitingSignature' | 'Signed' | 'Terminated' | 'Voided';
export type Gender = 'Male' | 'Female' | 'Other';

export const CONTRACT_TYPE_LABEL: Record<EmploymentContractType, string> = {
  Probation: 'Thử việc (tối đa 60 ngày)',
  FixedTermUnder12Months: 'Xác định thời hạn dưới 12 tháng',
  FixedTerm12To36Months: 'Xác định thời hạn 12–36 tháng',
  Indefinite: 'Không xác định thời hạn',
  Appendix: 'Phụ lục hợp đồng',
};

export const CONTRACT_STATUS_LABEL: Record<EmploymentContractStatus, string> = {
  Draft: 'Nháp',
  AwaitingSignature: 'Chờ ký giấy',
  Signed: 'Đã ký',
  Terminated: 'Đã chấm dứt',
  Voided: 'Đã huỷ',
};

export const GENDER_LABEL: Record<Gender, string> = { Male: 'Nam', Female: 'Nữ', Other: 'Khác' };

/** Định dạng trường ngày: ngay (29) · thang (10) · nam (2026) · nam2 (26) · chu ("ngày 29 tháng 10 năm 2026"). */
export interface IContractFieldFormat {
  code: string;
  label: string;
}

export interface IContractField {
  key: string;
  label: string;
  required: boolean;
  /** Trường ngày — thẻ trong trình soạn chọn được định dạng (`{{ma:dinh_dang}}`). */
  isDate?: boolean;
  formats?: IContractFieldFormat[] | null;
}

/** Trường riêng của một mẫu (mã `rieng_…`): nhập khi soạn hợp đồng; mặc định dùng cho mọi hợp đồng soạn từ mẫu. */
export interface IContractCustomField {
  key: string;
  label: string;
  required: boolean;
  defaultValue?: string | null;
}

export interface IContractTemplate {
  id: string;
  code: string;
  name: string;
  version: number;
  contractType: EmploymentContractType;
  body: string;
  isActive: boolean;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  /** Tên tệp mẫu Word (.docx) đã gắn — khi chốt sinh bản Word giữ định dạng gốc. */
  docxFileName?: string | null;
  /** Nội dung là HTML (soạn bằng trình soạn / tải mẫu lên); false = mẫu chữ cũ. */
  isHtml?: boolean;
  /** Trường riêng của mẫu (MST, người đại diện…) — AI tải mẫu có thể tạo sẵn. */
  customFields?: IContractCustomField[] | null;
}

/** Kết quả tải mẫu (.docx / .pdf) lên: bản nháp đã thay nội dung, AI có gắn được trường không, cảnh báo nếu có. */
export interface IContractTemplateImport {
  template: IContractTemplate;
  fieldsPlacedByAi: boolean;
  warning?: string | null;
}

/** Xem trước mẫu với hồ sơ một nhân viên. */
export interface IContractPreview {
  body: string;
  isHtml: boolean;
  missingFields: string[];
}

/** Hai trường chữ ký — không trộn ở máy chủ, thay khi hiển thị (ảnh chữ ký / chỗ trống để ký). */
export const SIGNATURE_FIELD_KEYS = ['chu_ky_nguoi_lao_dong', 'chu_ky_cua_hang'] as const;

/** Lời cam kết khi nhân viên ký hợp đồng (máy chủ lưu đúng câu này). */
export const CONTRACT_SIGN_CONSENT = 'Tôi cam kết thông tin hồ sơ là đúng và đồng ý với nội dung hợp đồng.';

export interface IEmployeeProfile {
  userId: string;
  fullName: string;
  phoneNumber?: string | null;
  hasIdCardImages: boolean;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  idNumber?: string | null;
  idIssuedOn?: string | null;
  idIssuedPlace?: string | null;
  permanentAddress?: string | null;
  jobTitle?: string | null;
  joinedOn?: string | null;
  missingFields: string[];
}

export type EmployeeProfileInput = Omit<IEmployeeProfile, 'userId' | 'fullName' | 'phoneNumber' | 'hasIdCardImages' | 'missingFields'>;

export interface IContractTerms {
  contractType: EmploymentContractType;
  parentContractId?: string | null;
  startDate: string;
  endDate?: string | null;
  jobTitle?: string | null;
  workplace?: string | null;
  isPartTime: boolean;
  minHoursPerMonth?: number | null;
  maxHoursPerMonth?: number | null;
  /** Giá trị trường riêng của mẫu (mã → giá trị); null = giữ / lấy mặc định của mẫu. */
  customValues?: Record<string, string> | null;
}

export interface IEmploymentContract {
  id: string;
  staffId: string;
  staffName: string;
  templateId: string;
  templateVersion: number;
  parentContractId?: string | null;
  contractNumber?: string | null;
  contractType: EmploymentContractType;
  startDate: string;
  endDate?: string | null;
  jobTitle: string;
  workplace?: string | null;
  isPartTime: boolean;
  minHoursPerMonth?: number | null;
  maxHoursPerMonth?: number | null;
  salaryType?: string | null;
  salaryAmount?: number | null;
  probationRate?: number | null;
  renderedBody: string;
  missingFields: string[];
  status: EmploymentContractStatus;
  finalizedAt?: string | null;
  signedOn?: string | null;
  signedUploadedAt?: string | null;
  terminatedOn?: string | null;
  terminationReason?: string | null;
  voidReason?: string | null;
  createdAt: string;
  files: { id: string; url: string; contentType: string; uploadedAt: string }[];
  /** Bản Word đã trộn (mẫu có tệp .docx) — link có chữ ký. */
  docxUrl?: string | null;
  /** Nội dung đã trộn là HTML (mẫu HTML / đã sửa tay). */
  isHtml?: boolean;
  /** Admin đã sửa tay nội dung — đổi điều khoản không trộn lại. */
  bodyEdited?: boolean;
  /** Nhân viên đã ký trên app / web (chữ ký vẽ). */
  employeeSignedAt?: string | null;
  /** Chữ ký nhân viên dạng SVG (máy chủ dựng từ nét vẽ). */
  employeeSignatureSvg?: string | null;
  /** Chữ thuần từ nội dung HTML (app hiển thị). */
  bodyText?: string | null;
  /** Trường riêng của mẫu (định nghĩa) và giá trị đã nhập cho hợp đồng này. */
  customFields?: IContractCustomField[] | null;
  customValues?: Record<string, string> | null;
}

// ── Ca hỗ trợ mở trên chợ ca ─────────────────────────────────────────────

export type SupportShiftOpeningStatus = 'Open' | 'Filled' | 'Cancelled';
export type SupportShiftClaimStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn';

export const SUPPORT_OPENING_STATUS_LABEL: Record<SupportShiftOpeningStatus, string> = {
  Open: 'Đang cần người',
  Filled: 'Đã đủ người',
  Cancelled: 'Đã huỷ',
};

export const SUPPORT_CLAIM_STATUS_LABEL: Record<SupportShiftClaimStatus, string> = {
  Pending: 'Chờ duyệt',
  Approved: 'Đã duyệt',
  Rejected: 'Từ chối',
  Withdrawn: 'Đã rút',
};

export interface ISupportShiftClaim {
  id: string;
  staffId: string;
  staffName: string;
  status: SupportShiftClaimStatus;
  note?: string | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  shiftAssignmentId?: string | null;
  createdAt: string;
}

/** Người không có quyền xếp ca chỉ nhận về đơn của chính mình trong `claims`. */
export interface ISupportShiftOpening {
  id: string;
  shiftScheduleId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  date: string;
  slots: number;
  approvedCount: number;
  note?: string | null;
  status: SupportShiftOpeningStatus;
  fixedHourlyRate?: number | null;
  minimumPaidHours?: number | null;
  createdAt: string;
  claims: ISupportShiftClaim[];
}

// ── Cảnh báo cho một lô ca dự kiến ───────────────────────────────────────

/** Một ca dự kiến (chưa lưu): người, ngày yyyy-MM-dd, lịch ca, khu, trưởng ca. */
export interface IProposedAssignment {
  staffId: string;
  date: string;
  shiftScheduleId: string;
  zones?: string[];
  isShiftLead?: boolean;
}

/** Cảnh báo của ca thứ `index` trong lô (chỉ ca có cảnh báo). */
export interface IProposedAssignmentWarnings {
  index: number;
  staffId: string;
  date: string;
  shiftScheduleId: string;
  warnings: IHourWarning[];
}

// ── Bồi thường thiệt hại (Quy chế Điều 25) ───────────────────────────────

export type HrCompensationStatus = 'Active' | 'Cancelled';

/** Không phải phạt: trừ dần vào kỳ lương cuối tháng, mỗi tháng tối đa 30% lương thực trả. */
export interface ICompensation {
  id: string;
  staffId: string;
  staffName: string;
  hrRecordId: string;
  recordType: HrRecordType;
  recordDate: string;
  damageAmount?: number | null;
  amount: number;
  deducted: number;
  remaining: number;
  note?: string | null;
  status: HrCompensationStatus;
  approvedAt: string;
  cancelledAt?: string | null;
  cancelReason?: string | null;
}

// ----------------------------------------------------------------------
// Danh mục vi phạm + điểm trừ (/hr-violations). Chỉ có điểm — không có khoản tiền.

export type ViolationComponent = 'Discipline' | 'Reconciliation';
export type ViolationAutoSource =
  | 'None'
  | 'Late'
  | 'EarlyLeave'
  | 'MissingCheck'
  | 'NoShow'
  | 'LateNoticeLeave'
  | 'InspectionFault'
  | 'Discrepancy';
export type ViolationEntryStatus = 'Active' | 'Disputed' | 'Cancelled';

export const VIOLATION_COMPONENT_LABEL: Record<ViolationComponent, string> = {
  Discipline: 'Kỷ luật',
  Reconciliation: 'Đối soát',
};

export const VIOLATION_AUTO_SOURCE_LABEL: Record<ViolationAutoSource, string> = {
  None: 'Quản lý ghi tay',
  Late: 'Tự ghi: đi muộn trên … phút',
  EarlyLeave: 'Tự ghi: về sớm trên … phút',
  MissingCheck: 'Tự ghi: quên chấm công vào / ra',
  NoShow: 'Tự ghi: không đến ca, không có đơn nghỉ',
  LateNoticeLeave: 'Tự ghi: đơn nghỉ báo muộn được duyệt',
  InspectionFault: 'Tự ghi: mỗi mục bảng kiểm không đạt',
  Discrepancy: 'Tự ghi: biên bản chênh lệch có lỗi cá nhân',
};

export const VIOLATION_STATUS_LABEL: Record<ViolationEntryStatus, string> = {
  Active: 'Đang tính',
  Disputed: 'Đang khiếu nại',
  Cancelled: 'Đã huỷ',
};

export interface IViolationPolicy {
  effectiveFrom: string;
  halfBonusFromPoints?: number | null;
  halfBonusPct?: number | null;
  noBonusFromPoints?: number | null;
  notCompleteFromPoints?: number | null;
  updatedAt: string;
}

export interface IViolationRule {
  id: string;
  groupName: string;
  name: string;
  points: number;
  component: ViolationComponent;
  autoSource: ViolationAutoSource;
  thresholdMinutes?: number | null;
  losesWeeklyBonus: boolean;
  losesMonthlyBonus: boolean;
  extraAction?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface IViolationCatalog {
  policy: IViolationPolicy | null;
  rules: IViolationRule[];
}

export interface ISaveViolationRule {
  groupName: string;
  name: string;
  points: number;
  component: ViolationComponent;
  autoSource: ViolationAutoSource;
  thresholdMinutes: number | null;
  losesWeeklyBonus: boolean;
  losesMonthlyBonus: boolean;
  extraAction: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface IViolationEntry {
  id: string;
  ruleId: string;
  userId: string;
  fullName: string;
  occurredOn: string;
  shiftName?: string | null;
  quantity: number;
  points: number;
  ruleName: string;
  groupName: string;
  component: ViolationComponent;
  losesWeeklyBonus: boolean;
  losesMonthlyBonus: boolean;
  note?: string | null;
  isAuto: boolean;
  status: ViolationEntryStatus;
  complaintText?: string | null;
  complainedAt?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  complaintDeadline?: string | null;
}

export interface IViolationSummary {
  userId: string;
  fullName: string;
  points: number;
  disciplinePoints: number;
  reconciliationPoints: number;
  count: number;
  disputed: number;
  /** % thưởng doanh số tuần theo ngưỡng; null = cửa hàng không đặt ngưỡng. */
  weeklyBonusPct?: number | null;
  notComplete: boolean;
  losesMonthlyBonus: boolean;
  weeksWithoutBonus: string[];
}

export interface IViolationMonth {
  month: string;
  policy: IViolationPolicy | null;
  rows: IViolationSummary[];
}

export interface IMyViolations {
  month: string;
  policy: IViolationPolicy | null;
  summary: IViolationSummary;
  entries: IViolationEntry[];
}
