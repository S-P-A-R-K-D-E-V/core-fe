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
  | 'MonthOvertimeOver40';

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

// ── Nhiệm vụ ───────────────────────────────────────────────────────────

export type WorkTaskGroup = 'Content' | 'Inbox' | 'Packing' | 'Display' | 'Initiative' | 'Other';
export type WorkTaskStatus = 'Assigned' | 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled';

/** Nhóm quản lý giao được (sáng kiến do nhân viên tự tạo). */
export const ASSIGNABLE_TASK_GROUPS: WorkTaskGroup[] = ['Content', 'Inbox', 'Packing', 'Display', 'Other'];

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
  Violation: 'Vi phạm nội quy',
  Warning: 'Cảnh báo hoàn thành công việc',
};

export const HR_RECORD_STATUS_LABEL: Record<HrRecordStatus, string> = {
  AwaitingSignature: 'Chờ ký',
  Signed: 'Đã ký',
  RefusedToSign: 'Không ký',
  Voided: 'Đã huỷ',
};

/** Chênh lệch tiền dưới mức này không lập biên bản (Quy chế Điều 25). */
export const CASH_RECORD_THRESHOLD = 20_000;

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
