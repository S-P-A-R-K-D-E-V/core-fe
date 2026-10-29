// ----------------------------------------------------------------------
// Kiểm tra cửa hàng — khớp CoreCms.Contracts/StoreInspection/StoreInspectionContracts.cs.
// ----------------------------------------------------------------------

export type InspectionType = 'ShiftQuick' | 'WeeklyFull';
/** Mandatory = mục B (bắt buộc, sửa trong 15 phút); Standard = mục T (sửa trong ca / giao ca sau). */
export type InspectionLevel = 'Mandatory' | 'Standard';
export type InspectionStatus = 'Draft' | 'Submitted';
export type InspectionOutcome = 'Pass' | 'Fail' | 'NotApplicable';
export type InspectionPhotoKind = 'Fault' | 'Fixed';
export type CorrectiveActionStatus = 'Suggested' | 'Open' | 'Done' | 'Dismissed';
export type InspectionZoneCode = 'A' | 'B' | 'C' | 'D';

export const INSPECTION_ZONES: InspectionZoneCode[] = ['A', 'B', 'C', 'D'];

/** Khung ca của ca làm (ShiftTemplate.CleaningBlock) — lịch của hạng mục. */
export type WorkBlock = 'Morning' | 'Afternoon' | 'Evening';

export const WORK_BLOCKS: WorkBlock[] = ['Morning', 'Afternoon', 'Evening'];

export const WORK_BLOCK_LABEL: Record<WorkBlock, string> = { Morning: 'Sáng', Afternoon: 'Chiều', Evening: 'Tối' };

/** Thứ trong tuần của lịch hạng mục: 1 = Thứ 2 … 7 = Chủ nhật. */
export const WEEKDAY_SHORT: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' };

export const INSPECTION_TYPE_LABEL: Record<InspectionType, string> = {
  ShiftQuick: 'Kiểm nhanh',
  WeeklyFull: 'Kiểm tuần',
};

export const INSPECTION_LEVEL_LABEL: Record<InspectionLevel, string> = {
  Mandatory: 'B',
  Standard: 'T',
};

export const INSPECTION_OUTCOME_LABEL: Record<InspectionOutcome, string> = {
  Pass: 'Đạt',
  Fail: 'Không đạt',
  NotApplicable: 'NA',
};

export const CORRECTIVE_ACTION_STATUS_LABEL: Record<CorrectiveActionStatus, string> = {
  Suggested: 'Gợi ý',
  Open: 'Đang làm',
  Done: 'Xong',
  Dismissed: 'Bỏ qua',
};

export interface IInspectionTemplateItem {
  id: string;
  code: string;
  groupName: string | null;
  title: string;
  passCriteria: string;
  level: InspectionLevel;
  zones: InspectionZoneCode[];
  perStaff: boolean;
  observationsPerStaff: number;
  requiresPhotoOnFail: boolean;
  requiresFix: boolean;
  sortOrder: number;
  /** Nhân viên trong ca tự làm và chụp ảnh (chỉ bảng kiểm nhanh mỗi ca). */
  staffDoes: boolean;
  /** 1 = Thứ 2 … 7 = Chủ nhật; null / rỗng = mọi ngày. */
  weekdays: number[] | null;
  /** null / rỗng = mọi ca. */
  blocks: WorkBlock[] | null;
}

export interface IInspectionTemplate {
  id: string;
  type: InspectionType;
  version: number;
  name: string;
  effectiveFrom: string;
  publishedAt: string | null;
  inUse: boolean;
  items: IInspectionTemplateItem[];
}

export interface IInspectionTemplateItemInput {
  code: string;
  groupName: string | null;
  title: string;
  passCriteria: string;
  level: InspectionLevel;
  zones: InspectionZoneCode[];
  perStaff: boolean;
  observationsPerStaff: number;
  requiresPhotoOnFail: boolean;
  requiresFix: boolean;
  staffDoes: boolean;
  weekdays: number[] | null;
  blocks: WorkBlock[] | null;
}

export interface IInspectionStaff {
  staffId: string;
  name: string;
}

export interface IInspectionZoneOwners {
  zones: Partial<Record<InspectionZoneCode, string>>;
  shiftLeadId: string | null;
  staff: IInspectionStaff[];
}

export interface IInspectionPhoto {
  id: string;
  kind: InspectionPhotoKind;
  url: string;
  uploadedAt: string;
}

export interface IInspectionResult {
  id: string;
  itemId: string;
  itemCode: string;
  level: InspectionLevel;
  observedStaffId: string | null;
  observationIndex: number;
  outcome: InspectionOutcome;
  note: string | null;
  responsibleStaffId: string | null;
  zoneUnassigned: boolean;
  recordedAt: string;
  fixDeadlineAt: string | null;
  fixedAt: string | null;
  fixNote: string | null;
  isOverdue: boolean;
  photos: IInspectionPhoto[];
}

export interface IInspectionSummary {
  id: string;
  type: InspectionType;
  status: InspectionStatus;
  date: string;
  shiftScheduleId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  branchId: string | null;
  isSpotCheck: boolean;
  inspectorId: string;
  inspectorName: string;
  startedAt: string;
  submittedAt: string | null;
  passCount: number;
  failCount: number;
  notApplicableCount: number;
  passRate: number | null;
}

export interface IInspection {
  summary: IInspectionSummary;
  note: string | null;
  zoneOwners: IInspectionZoneOwners;
  template: IInspectionTemplate;
  results: IInspectionResult[];
  /** Hạng mục nhân viên đã làm trong ca (ai làm, ảnh) — người kiểm xem khi chấm. */
  completions: IShiftWorkCompletionItem[];
}

export interface IInspectionResultInput {
  itemId: string;
  observedStaffId: string | null;
  observationIndex: number;
  outcome: InspectionOutcome;
  note: string | null;
  faultPhotoKeys: string[] | null;
}

export interface IInspectionFault {
  resultId: string;
  inspectionId: string;
  inspectionType: InspectionType;
  date: string;
  shiftName: string;
  itemCode: string;
  itemTitle: string;
  passCriteria: string;
  level: InspectionLevel;
  requiresPhotoOnFail: boolean;
  observedStaffId: string | null;
  note: string | null;
  responsibleStaffId: string | null;
  zoneUnassigned: boolean;
  recordedAt: string;
  fixDeadlineAt: string | null;
  fixedAt: string | null;
  fixNote: string | null;
  isOverdue: boolean;
  photos: IInspectionPhoto[];
}

export interface IInspectionShift {
  date: string;
  shiftScheduleId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  shiftType: 'Main' | 'Extra';
  branchId: string | null;
  staffCount: number;
  shiftLeadId: string | null;
  shiftLeadName: string | null;
  iAmOnShift: boolean;
  iAmShiftLead: boolean;
  quickInspectionId: string | null;
  quickStatus: InspectionStatus | null;
  spotChecks: number;
}

export interface ICorrectiveAction {
  id: string;
  itemCode: string | null;
  title: string;
  rootCause: string | null;
  action: string | null;
  ownerUserId: string | null;
  dueDate: string | null;
  status: CorrectiveActionStatus;
  suggestedForWeek: string | null;
  failCount: number | null;
  createdAt: string;
  completedAt: string | null;
  ownerName: string | null;
}

export interface IInspectionDashboard {
  today: string;
  weekStart: string;
  todayShifts: IInspectionShift[];
  openFaults: number;
  openMandatoryFaults: number;
  overdueFaults: number;
  unassignedFaults: number;
  coverage: {
    shiftsExpected: number;
    shiftsQuickChecked: number;
    spotChecks: number;
    requiredSpotChecks: number;
    weeklyFullDone: boolean;
    weeklyFullOnDifferentShift: boolean;
  };
  weekPassRate: number | null;
  topRepeatFaults: { itemCode: string; title: string; failCount: number }[];
  dueCorrectiveActions: ICorrectiveAction[];
}

export interface IInspectionStatCell {
  key: string;
  label: string;
  weekStart: string;
  pass: number;
  fail: number;
}

export interface IInspectionStats {
  weeks: string[];
  byItem: IInspectionStatCell[];
  byZone: IInspectionStatCell[];
}

export interface IPagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ── Việc trong ca (shift-work) ─────────────────────────────────────────

export interface IShiftWorkCompletion {
  id: string;
  completedByUserId: string;
  completedByName: string;
  completedAt: string;
  note: string | null;
  photos: IInspectionPhoto[];
}

export interface IShiftWorkCompletionItem {
  itemId: string;
  completion: IShiftWorkCompletion;
}

export interface IShiftWorkItem {
  itemId: string;
  code: string;
  groupName: string | null;
  title: string;
  passCriteria: string;
  zones: InspectionZoneCode[];
  requiresPhoto: boolean;
  completion: IShiftWorkCompletion | null;
  /** Kết quả kiểm của ca cho hạng mục này; null = chưa kiểm. */
  outcome: InspectionOutcome | null;
}

export interface IShiftWorkShift {
  date: string;
  shiftScheduleId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  block: WorkBlock | null;
  items: IShiftWorkItem[];
}
