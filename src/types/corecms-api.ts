// Core CMS Backend API Types
// ----------------------------------------------------------------------

export type UserStatus = 'Active' | 'Pending' | 'Banned' | 'Rejected';

export interface IUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  bankCode?: string;
  bankNo?: string;
  role: string;
  status: UserStatus;
  emailConfirmed: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
  profileImageUrl?: string;
  roles: string[];
}

export interface IAuthResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  token: string;
  refreshToken: string;
  refreshTokenExpiryTime: string;
  role: string;
  roles: string[];
  permissions: string[];
  requiresOtpVerification: boolean;
  emailConfirmed: boolean;
  sessionToken?: string;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface IVerifyOtpRequest {
  email: string;
  otpCode: string;
}

export interface IResendOtpRequest {
  email: string;
}

export interface IRestoreSessionRequest {
  sessionToken: string;
}

export interface IUpdateUserRequest {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  address?: string;
  bankCode?: string;
  bankNo?: string;
  profileImageUrl?: string;
}

export interface IUpdateProfileRequest {
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  address?: string;
  bankCode?: string;
  bankNo?: string;
  profileImageUrl?: string;
}

export interface IChangeUserStatusRequest {
  status: UserStatus;
}

export interface IResetPasswordRequest {
  newPassword: string;
}

export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface IRefreshTokenRequest {
  refreshToken: string;
}

export interface ILogoutRequest {
  userId: string;
}

// RBAC Types
export interface IRole {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  permissions: IPermission[];
}

export interface IPermission {
  id: string;
  name: string;
  description?: string;
  group: string;
}

export interface ICreateRoleRequest {
  name: string;
  description?: string;
  permissionIds: string[];
}

export interface IUpdateRoleRequest {
  name: string;
  description?: string;
  permissionIds: string[];
}

export interface IAssignRoleRequest {
  userId: string;
  roleIds: string[];
}

export interface IUserPermissions {
  roles: string[];
  permissions: string[];
}

// Error Response
export interface IErrorResponse {
  type: string;
  title: string;
  status: number;
  errors?: Record<string, string[]>;
}

// ======================================================================
// Attendance / Shift Management Types
// ======================================================================

export type ShiftType = 'Main' | 'Extra';
export type AttendanceStatus = 'OnTime' | 'Late' | 'Absent';
export type AttendanceRequestType = 'MissedCheckIn' | 'MissedCheckOut' | 'OvertimeCompensation' | 'ShiftSwap';
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';

// --- Shift Template (Master Data) ---
export interface IShiftTemplate {
  id: string;
  name: string;
  description?: string;
  shiftType: ShiftType;
  color?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ICreateShiftTemplateRequest {
  name: string;
  description?: string;
  shiftType: string;
  color?: string;
}

export interface IUpdateShiftTemplateRequest {
  name: string;
  description?: string;
  shiftType: string;
  color?: string;
  isActive: boolean;
}

// --- Shift Schedule (Versioned + Locked) ---
export interface IShiftSchedule {
  id: string;
  shiftTemplateId: string;
  templateName: string;
  templateType: ShiftType;
  color: string;       // ✅ Color from template
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  fromDate: string;    // "yyyy-MM-dd"
  toDate?: string;     // "yyyy-MM-dd"
  repeatDays: number;  // Bitmask
  repeatDaysNames: string[];
  checkInAllowedMinutesBefore: number;
  version: number;
  isPayrollLocked: boolean;
  payrollLockedAt?: string;
  payrollLockedBy?: string;
  payrollLockerName?: string;
  isActive: boolean;
  totalHours: number;
  createdAt: string;
}

export interface ICreateShiftScheduleRequest {
  shiftTemplateId: string;
  startTime: string;
  endTime: string;
  fromDate: string;
  toDate?: string;
  repeatDays: number;
  checkInAllowedMinutesBefore: number;
}

export interface IUpdateShiftScheduleRequest {
  startTime: string;
  endTime: string;
  fromDate: string;
  toDate?: string;
  repeatDays: number;
  checkInAllowedMinutesBefore: number;
}

export interface ILockShiftScheduleRequest {
  isLocked: boolean;
}

// --- Legacy Shift (Deprecated - use ShiftTemplate + ShiftSchedule) ---
export interface IShift {
  id: string;
  name: string;
  description?: string;
  startTime: string;   // "HH:mm"
  endTime: string;     // "HH:mm"
  shiftType: ShiftType;
  isRepeating: boolean;
  repeatDays?: string;  // "1,2,3,4,5"
  isActive: boolean;
  checkInAllowedMinutesBefore: number;
  totalHours: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ICreateShiftRequest {
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  isRepeating: boolean;
  repeatDays?: string;
  checkInAllowedMinutesBefore: number;
}

export interface IUpdateShiftRequest {
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  isRepeating: boolean;
  repeatDays?: string;
  checkInAllowedMinutesBefore: number;
}

// --- Shift Assignment (Updated to use ShiftSchedule) ---
export interface IShiftAssignment {
  id: string;
  assignmentId: string;          // New field for backward compatibility
  staffId: string;
  staffName: string;
  shiftScheduleId: string;
  scheduleName: string;          // From ShiftSchedule.Template.Name
  startTime: string;       // From ShiftSchedule.StartTime
  endTime: string;         // From ShiftSchedule.EndTime
  scheduleVersion: number;       // From ShiftSchedule.Version
  date: string;                  // "yyyy-MM-dd"
  note?: string;
  createdAt: string;
  // Legacy fields (for backward compatibility)
  shiftId?: string;              // Deprecated
  shiftName?: string;            // Deprecated
  shiftStartTime?: string;       // Deprecated
  shiftEndTime?: string;         // Deprecated
  shiftType?: string;
  shiftColor?: string;           // Deprecated
  attendanceLog?: IAttendanceLog;
}

export interface ICreateShiftAssignmentRequest {
  staffId: string;
  shiftScheduleId: string;       // Updated: use ShiftScheduleId
  date: string;                  // "yyyy-MM-dd"
  note?: string;
}

export interface IBulkAssignShiftScheduleRequest {
  staffIds: string[];
  shiftScheduleId: string;
  fromDate: string;
  toDate: string;
  filterDays?: number;           // Optional: WeekDays flags bitmask (Mon=1,Tue=2,Wed=4,Thu=8,Fri=16,Sat=32,Sun=64)
}

export interface IManageShiftAssignmentsRequest {
  shiftScheduleId: string;
  date: string;                  // "yyyy-MM-dd"
  staffIds: string[];
}

export interface ISwapShiftAssignmentsRequest {
  staffId1: string;
  shiftScheduleId1: string;
  date1: string;
  staffId2: string;
  shiftScheduleId2: string;
  date2: string;
}

// --- Attendance Log ---
export interface IAttendanceLog {
  id: string;
  shiftAssignmentId: string;
  staffId: string;
  staffName: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkInIpAddress?: string;
  checkOutIpAddress?: string;
  checkInWifiName?: string;
  checkOutWifiName?: string;
  checkInFaceVerified: boolean;
  checkOutFaceVerified: boolean;
  isLate: boolean;
  lateMinutes: number;
  status: string;
  isAutoClosedBySystem: boolean;
  isOvertime: boolean;
  isCorrectShift: boolean;
  workedHours?: number;
  createdAt: string;
}

export interface ICheckInRequest {
  shiftAssignmentId?: string; // Optional for overtime checkin
  isOvertime?: boolean;
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
  wifiName?: string;
  faceVerified: boolean;
}

export interface ICheckOutRequest {
  attendanceLogId: string;
  latitude?: number;
  longitude?: number;
  ipAddress?: string;
  wifiName?: string;
  faceVerified: boolean;
}

export interface IManualAttendanceAdjustmentRequest {
  shiftAssignmentId: string;
  staffId: string;
  checkInTime?: string;
  checkOutTime?: string;
  note?: string;
}

export interface IAdjustAttendanceTimeRequest {
  shiftAssignmentId: string;
  checkInTime?: string;
  checkOutTime?: string;
  note?: string;
}

// --- Attendance Request ---
export interface IAttendanceRequest {
  id: string;
  staffId: string;
  staffName: string;
  shiftAssignmentId?: string;
  requestType: string;
  status: string;
  reason: string;
  requestedCheckInTime?: string;
  requestedCheckOutTime?: string;
  compensationHours?: number;
  targetStaffId?: string;
  targetStaffName?: string;
  targetShiftAssignmentId?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvalNote?: string;
  createdAt: string;
}

export interface ICreateAttendanceRequestDto {
  shiftAssignmentId?: string;
  requestType: string;
  reason: string;
  requestedCheckInTime?: string;
  requestedCheckOutTime?: string;
  compensationHours?: number;
  targetStaffId?: string;
  targetShiftAssignmentId?: string;
}

export interface IProcessAttendanceRequestDto {
  status: string;
  approvalNote?: string;
}

// --- Attendance Report ---
export interface IAttendanceReport {
  staffId: string;
  staffName: string;
  period: string;
  totalWorkedHours: number;
  compensationHours: number;
  totalShifts: number;
  presentShifts: number;
  absentShifts: number;
  lateCount: number;
  totalLateMinutes: number;
  overtimeHours: number;
}

// --- Salary Configuration ---
export type SalaryType = 'PerShift' | 'Hourly' | 'Monthly';

export interface ISalaryConfiguration {
  id: string;
  userId: string;
  userName: string;
  salaryType: string;
  amount: number;
  probationRate?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  note?: string;
  createdAt: string;
}

export interface ICreateSalaryConfigurationRequest {
  userId: string;
  salaryType: string;
  amount: number;
  probationRate?: number;
  effectiveFrom: string; // "yyyy-MM-dd"
  effectiveTo?: string;  // "yyyy-MM-dd"
  note?: string;
}

export interface IUpdateSalaryConfigurationRequest {
  salaryType: string;
  amount: number;
  probationRate?: number;
  effectiveFrom: string; // "yyyy-MM-dd"
  effectiveTo?: string;  // "yyyy-MM-dd"
  note?: string;
}

// --- Payroll Record ---
export interface IPayrollRecord {
  id: string;
  payrollCycleId?: string;
  userId: string;
  userName: string;
  periodMonth: string;
  fromDate: string;
  toDate: string;
  totalShifts: number;
  presentShifts: number;
  totalHoursWorked: number;
  overtimeHours: number;
  wrongShifts: number;
  totalLateMinutes: number;
  absentShifts: number;
  baseSalary: number;
  overtimeSalary: number;
  bonus: number;
  penaltyAmount: number;
  deduction: number;
  totalSalary: number;
  note?: string;
  isFinalized: boolean;
  finalizedBy?: string;
  finalizedAt?: string;
  createdAt: string;
}

export interface IPayrollCalculationRequest {
  userId: string;
  fromDate: string; // "yyyy-MM-dd"
  toDate: string;   // "yyyy-MM-dd"
}

export interface IFinalizePayrollRequest {
  isFinalized: boolean;
}

export interface IBatchPayrollCalculationRequest {
  periodName: string;
  fromDate: string; // "yyyy-MM-dd"
  toDate: string;   // "yyyy-MM-dd"
}

export interface IBatchPayrollResponse {
  payrollCycleId: string;
  periodName: string;
  fromDate: string;
  toDate: string;
  totalEmployees: number;
  successCount: number;
  skippedCount: number;
  records: IPayrollRecord[];
}

export interface IPayrollCycleDetailResponse {
  cycleId: string;
  cycleName: string;
  fromDate: string;
  toDate: string;
  isLocked: boolean;
  records: IPayrollRecord[];
}

// --- Shift Swap Request ---
export type ShiftSwapStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface IShiftSwapRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  currentShiftAssignmentId: string;
  currentShiftName: string;
  currentShiftDate: string;
  targetUserId: string;
  targetUserName?: string;
  targetShiftAssignmentId?: string;
  targetShiftName?: string;
  targetShiftDate?: string;
  reason?: string;
  status: string;
  reviewedBy?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface ICreateShiftSwapRequestRequest {
  currentShiftAssignmentId: string;
  targetUserId: string;
  targetShiftAssignmentId?: string;
  reason?: string;
}

export interface IReviewShiftSwapRequestRequest {
  status: string; // "Approved" | "Rejected"
  reviewNote?: string;
}

// --- Holiday Policy ---
export type HolidayBonusType = 'Percentage' | 'Multiplier' | 'FixedAmount' | 'Combined';

export interface IHolidayPolicy {
  id: string;
  name: string;
  fromDate: string;
  toDate: string;
  bonusType: string;
  percentageValue?: number;
  multiplierValue?: number;
  fixedAmountValue?: number;
  applyOnSunday: boolean;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ICreateHolidayPolicyRequest {
  name: string;
  fromDate: string; // "yyyy-MM-dd"
  toDate: string;
  bonusType: string;
  percentageValue?: number;
  multiplierValue?: number;
  fixedAmountValue?: number;
  applyOnSunday?: boolean;
  description?: string;
}

export interface IUpdateHolidayPolicyRequest {
  name: string;
  fromDate: string;
  toDate: string;
  bonusType: string;
  percentageValue?: number;
  multiplierValue?: number;
  fixedAmountValue?: number;
  applyOnSunday?: boolean;
  description?: string;
  isActive?: boolean;
}

// --- Penalty Policy ---
export type ViolationType = 'Late' | 'EarlyLeave' | 'WrongShift' | 'Absent';
export type PenaltyType = 'FixedAmount' | 'Percentage' | 'HourlyRate';

export interface IPenaltyPolicy {
  id: string;
  violationType: string;
  name: string;
  penaltyType: string;
  penaltyValue: number;
  hourlyCoefficient?: number;
  minMinutes: number;
  isActive: boolean;
  description?: string;
  createdAt: string;
}

export interface ICreatePenaltyPolicyRequest {
  violationType: string;
  name: string;
  penaltyType: string;
  penaltyValue: number;
  hourlyCoefficient?: number;
  minMinutes?: number;
  description?: string;
}

export interface IUpdatePenaltyPolicyRequest {
  violationType: string;
  name: string;
  penaltyType: string;
  penaltyValue: number;
  hourlyCoefficient?: number;
  minMinutes?: number;
  isActive?: boolean;
  description?: string;
}

// --- Payroll Cycle ---
export type PayrollCycleType = 'Monthly' | 'Custom';

export interface IPayrollCycle {
  id: string;
  name: string;
  cycleType: string;
  fromDate: string;
  toDate: string;
  standardWorkDays: number;
  isLocked: boolean;
  lockedBy?: string;
  lockedByName?: string;
  lockedAt?: string;
  createdAt: string;
}

export interface ICreatePayrollCycleRequest {
  name: string;
  cycleType: string;
  fromDate: string; // "yyyy-MM-dd"
  toDate: string;
  standardWorkDays: number;
}

export interface IUpdatePayrollCycleRequest {
  name: string;
  cycleType: string;
  fromDate: string;
  toDate: string;
  standardWorkDays: number;
}

export interface ILockPayrollCycleRequest {
  isLocked: boolean;
}

// --- Payroll Shift Detail ---
export interface IPayrollShiftDetailResponse {
  payrollRecordId: string;
  userId: string;
  userName: string;
  periodMonth: string;
  fromDate: string;
  toDate: string;
  shifts: IPayrollShiftItem[];
}

export interface IPayrollShiftItem {
  shiftAssignmentId: string;
  date: string;
  shiftName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  checkInTime?: string;
  checkOutTime?: string;
  workedHours: number;
  paidHours: number;
  lateMinutes: number;
  status: 'Present' | 'Absent' | 'Wrong';
  isWaived: boolean;
  waiverId?: string;
  waiverReason?: string;
  isHolidayShift: boolean;
}

// --- Penalty Waiver ---
export interface IWaivePenaltyRequest {
  shiftAssignmentId: string;
  userId: string;
  violationType: string;
  payrollCycleId?: string;
  reason?: string;
}

export interface IWaivePenaltyResponse {
  id: string;
  shiftAssignmentId: string;
  userId: string;
  userName: string;
  waivedViolationType: string;
  reason?: string;
  waivedBy: string;
  waivedByName: string;
  createdAt: string;
}

// --- Salary History ---
export interface ISalaryHistory {
  id: string;
  userId: string;
  userName: string;
  salaryType: string;
  amount: number;
  probationRate?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  note?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

// --- Shift Cash (Kiểm tiền quầy) ---

export interface IShiftCashTransaction {
  id: string;
  date: string;
  type: 'Thu' | 'Chi';
  amount: number;
  note?: string;
  isDeleted: boolean;
  createdByName?: string;
  createdAt: string;
  updatedByName?: string;
  updatedAt?: string;
}

export interface IShiftCashDenomination {
  id: string;
  date: string;
  denomination: number;
  quantity: number;
  total: number;
  lastModifiedByName?: string;
  lastModifiedAt: string;
}

export interface IShiftCashLog {
  id: string;
  date: string;
  actionType: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  isAfterShiftEnd: boolean;
  userName?: string;
  timestamp: string;
}

export interface IShiftCashSummary {
  date: string;
  openingBalance: number;
  totalCashFromKiot: number;
  manualIncome: number;
  manualExpense: number;
  expectedClosing: number;
  actualCash: number;
  difference: number;
  isFinalized: boolean;
  finalizedAt?: string;
  finalizedByName?: string;
  denominations: IShiftCashDenomination[];
  transactions: IShiftCashTransaction[];
  finalizations: IShiftCashFinalization[];
}

export interface IShiftCashFinalization {
  id: string;
  closingBalance: number;
  finalizedAt?: string;
  finalizedByName?: string;
}

export interface IAddShiftCashTransactionRequest {
  date: string;
  type: 'Thu' | 'Chi';
  amount: number;
  note?: string;
}

export interface IUpdateShiftCashTransactionRequest {
  amount: number;
  note?: string;
}

export interface IUpdateDenominationRequest {
  date: string;
  denomination: number;
  quantity: number;
}

export interface IUpdateDenominationBatchRequest {
  date: string;
  items: { denomination: number; quantity: number }[];
}

// --- KiotViet Integration ---

export interface IKiotVietInvoice {
  id: number;
  code: string;
  purchaseDate: string;
  customerName?: string;
  total: number;
  totalPayment: number;
  paymentMethod: string;
  paymentAmount: number;
  cashDifference: number;
  status: number;
  statusValue?: string;
  description?: string;
  createdDate: string;
  hasReturn: boolean;
  returnAmount: number;
  returnNote?: string;
}

export interface IKiotVietReturn {
  id: number;
  code: string;
  invoiceId?: number;
  invoiceCode?: string;
  returnDate: string;
  customerName?: string;
  returnTotal: number;
  status: number;
  statusValue?: string;
  paymentMethod?: string;
  exchangeInvoiceTotal?: number;
  netReturnAmount: number;
  createdDate: string;
}

export interface IKiotVietDailySummary {
  date: string;
  totalInvoices: number;
  totalRevenue: number;
  totalCash: number;
  totalBank: number;
  totalCard: number;
  totalReturns: number;
  netCashImpact: number;
  cashInvoices: IKiotVietInvoice[];
  bankInvoices: IKiotVietInvoice[];
  cardInvoices: IKiotVietInvoice[];
  returns: IKiotVietReturn[];
}

export interface IKiotVietInvoiceDetailProduct {
  productId: number;
  productCode?: string;
  productName: string;
  quantity: number;
  price: number;
  discount?: number;
  discountRatio?: number;
  note?: string;
}

export interface IKiotVietInvoicePayment {
  id: number;
  code?: string;
  amount: number;
  method: string;
  statusValue?: string;
  transDate?: string;
  bankAccount?: string;
  accountId?: number;
}

export interface IKiotVietInvoiceSurcharge {
  id: number;
  surchargeName?: string;
  surValue?: number;
  price?: number;
}

export interface IKiotVietInvoiceDetailResponse {
  id: number;
  code: string;
  orderCode?: string;
  purchaseDate: string;
  branchName?: string;
  soldByName?: string;
  customerName?: string;
  customerCode?: string;
  total: number;
  totalPayment: number;
  status: number;
  statusValue?: string;
  description?: string;
  createdDate: string;
  products: IKiotVietInvoiceDetailProduct[];
  payments: IKiotVietInvoicePayment[];
}

// ==================== POS / INVENTORY ====================

// --- Category ---
export interface ICategory {
  id: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
  parentCategoryName?: string;
  sortOrder: number;
  isActive: boolean;
  imageUrl?: string;
  createdAt: string;
  subCategories?: ICategory[];
}

export interface ICreateCategoryRequest {
  name: string;
  description?: string;
  parentCategoryId?: string;
  sortOrder?: number;
  imageUrl?: string;
}

export interface IUpdateCategoryRequest {
  name: string;
  description?: string;
  parentCategoryId?: string;
  sortOrder?: number;
  imageUrl?: string;
  isActive?: boolean;
}

// --- Unit of Measure ---
export interface IUnitOfMeasure {
  id: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
  createdAt: string;
}

export interface ICreateUnitOfMeasureRequest {
  name: string;
  abbreviation: string;
}

export interface IUpdateUnitOfMeasureRequest {
  name: string;
  abbreviation: string;
  isActive?: boolean;
}

// --- Variant Attribute ---
export interface IVariantAttribute {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  values: IVariantAttributeValue[];
}

export interface IVariantAttributeValue {
  id: string;
  value: string;
  sortOrder: number;
}

export interface ICreateVariantAttributeRequest {
  name: string;
  sortOrder?: number;
  values?: string[];
}

export interface IUpdateVariantAttributeRequest {
  name: string;
  sortOrder?: number;
}

// --- Product ---
export interface IProduct {
  id: string;
  kiotVietId?: number;
  code: string;
  name: string;
  barCode?: string;
  fullName?: string;
  description?: string;
  categoryId: string;
  categoryName: string;
  allowsSale: boolean;
  hasVariants: boolean;
  unit?: string;
  masterProductId?: string;
  basePrice: number;
  weight?: number;
  productType: number; // 1: combo, 2: normal, 3: service
  isActive: boolean;
  isRewardPoint?: boolean;
  isLotSerialControl?: boolean;
  isBatchExpireControl?: boolean;
  taxType?: string;
  taxRate?: string;
  taxRateDirect?: number;
  minQuantity: number;
  maxQuantity: number;
  createdDate: string;
  modifiedDate?: string;
  attributes?: IProductAttribute[];
  images?: IProductImage[];
  inventories?: IProductInventory[];
  childProducts?: IProductChild[];
}

export interface IProductAttribute {
  id: string;
  attributeName: string;
  attributeValue: string;
}

export interface IProductImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

export interface IProductInventory {
  id: string;
  productId: string;
  branchId?: number;
  branchName?: string;
  onHand?: number;
  reserved: number;
  cost?: number;
}

export interface IProductChild {
  id: string;
  code: string;
  name: string;
  barCode?: string;
  basePrice: number;
  conversionValue?: number;
  isActive: boolean;
}

export interface ICreateProductAttributeRequest {
  attributeName: string;
  attributeValue: string;
}

export interface ICreateProductImageRequest {
  imageUrl: string;
}

export interface ICreateProductRequest {
  code: string;
  name: string;
  barCode?: string;
  fullName?: string;
  description?: string;
  categoryId: string;
  allowsSale?: boolean;
  hasVariants?: boolean;
  unit?: string;
  masterProductId?: string;
  basePrice: number;
  weight?: number;
  productType?: number;
  isRewardPoint?: boolean;
  isLotSerialControl?: boolean;
  isBatchExpireControl?: boolean;
  orderTemplate?: string;
  minQuantity?: number;
  maxQuantity?: number;
  taxType?: string;
  taxRate?: string;
  taxRateDirect?: number;
  attributes?: ICreateProductAttributeRequest[];
  images?: ICreateProductImageRequest[];
}

export interface IUpdateProductRequest {
  code: string;
  name: string;
  barCode?: string;
  fullName?: string;
  description?: string;
  categoryId: string;
  allowsSale?: boolean;
  hasVariants?: boolean;
  unit?: string;
  masterProductId?: string;
  basePrice: number;
  weight?: number;
  productType?: number;
  isActive?: boolean;
  isRewardPoint?: boolean;
  isLotSerialControl?: boolean;
  isBatchExpireControl?: boolean;
  orderTemplate?: string;
  minQuantity?: number;
  maxQuantity?: number;
  taxType?: string;
  taxRate?: string;
  taxRateDirect?: number;
}

// --- Warehouse ---
export interface IWarehouse {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ICreateWarehouseRequest {
  name: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
}

export interface IUpdateWarehouseRequest {
  name: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

// --- Inventory ---
export interface IInventoryItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productVariantId?: string;
  productVariantName?: string;
  warehouseId: string;
  warehouseName: string;
  categoryName: string;
  unitOfMeasureName: string;
  quantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  createdAt: string;
}

export interface IInventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  productVariantId?: string;
  productVariantName?: string;
  warehouseId: string;
  warehouseName: string;
  transactionType: string;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  createdByName: string;
  createdAt: string;
}

export interface IAdjustInventoryRequest {
  productId: string;
  productVariantId?: string;
  warehouseId: string;
  quantity: number;
  note?: string;
  surcharges: IKiotVietInvoiceSurcharge[];
}

// --- VietQR Banks ---

export interface IVietQRBank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported: number;
  lookupSupported: number;
}

// --- KiotViet Bank Account ---

export interface IKiotVietBankAccount {
  id: number;
  bankName?: string;
  accountNumber?: string;
  description?: string;
}

// ======================================================================
// Shift Registration Types

// ======================================================================
// User Tour Types
// ======================================================================

export interface IUserTourStatus {
  tourKey: string;
  isCompleted: boolean;
  completedAt?: string | null;
}

// ======================================================================
// ======================================================================

export interface IShiftRegistration {
  id: string;
  staffId: string;
  staffName: string;
  shiftScheduleId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  date: string;
  note?: string;
  createdAt: string;
}

export interface IRegisterShiftRequest {
  shiftScheduleId: string;
  date: string;
  note?: string;
}

export interface IUnregisterShiftRequest {
  shiftScheduleId: string;
  date: string;
}

export interface IBulkRegisterShiftRequest {
  staffIds: string[];
  shiftScheduleId: string;
  fromDate: string;
  toDate: string;
  filterDays?: number;
  note?: string;
}

// ── Checkin Face ──

export interface ICheckinFaceRequest {
  candidateId?: number;
  candidateName: string;
  imageBase64: string;
  lat?: number;
  lng?: number;
  deviceName?: string;
  time?: string;
}

export interface ICheckinFaceResponse {
  id: string;
  candidateId?: number;
  candidateName: string;
  latitude?: number;
  longitude?: number;
  deviceName?: string;
  checkinTime: string;
  notificationSent: boolean;
  createdAt: string;
}

// ── Notification Config ──

export type NotificationType = 'telegram' | 'zalo';

export interface INotificationConfig {
  id: string;
  type: NotificationType;
  token: string;
  chatId: string;
  name?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ICreateNotificationConfigRequest {
  type: string;
  token: string;
  chatId: string;
  name?: string;
  isActive?: boolean;
}

export interface IUpdateNotificationConfigRequest {
  token?: string;
  chatId?: string;
  name?: string;
  isActive?: boolean;
}

// ======================================================================
// Purchasing Types (Phase 2)
// ======================================================================

// --- Supplier ---
export interface ISupplier {
  id: string;
  name: string;
  code?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  bankAccount?: string;
  bankName?: string;
  note?: string;
  isActive: boolean;
  createdAt: string;
  totalOrders: number;
}

export interface ICreateSupplierRequest {
  name: string;
  code?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  bankAccount?: string;
  bankName?: string;
  note?: string;
}

export interface IUpdateSupplierRequest {
  name: string;
  code?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  bankAccount?: string;
  bankName?: string;
  note?: string;
  isActive: boolean;
}

// --- Purchase Order ---
export interface IPurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  status: string;
  subTotal: number;
  vatAmount: number;
  discountAmount: number;
  totalAmount: number;
  note?: string;
  expectedDate?: string;
  receivedDate?: string;
  createdByName: string;
  approvedByName?: string;
  createdAt: string;
  updatedAt?: string;
  items: IPurchaseOrderItem[];
}

export interface IPurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  productSKU: string;
  productVariantId?: string;
  variantName?: string;
  quantity: number;
  receivedQuantity: number;
  unitPrice: number;
  vatRate: number;
  discountAmount: number;
  totalPrice: number;
  note?: string;
}

export interface ICreatePurchaseOrderRequest {
  supplierId: string;
  warehouseId: string;
  note?: string;
  expectedDate?: string;
  discountAmount: number;
  items: ICreatePurchaseOrderItemRequest[];
}

export interface ICreatePurchaseOrderItemRequest {
  productId: string;
  productVariantId?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountAmount: number;
  note?: string;
}

export interface IUpdatePurchaseOrderRequest {
  supplierId: string;
  warehouseId: string;
  note?: string;
  expectedDate?: string;
  discountAmount: number;
  items: ICreatePurchaseOrderItemRequest[];
}

export interface IReceivePurchaseOrderRequest {
  items: IReceiveItemRequest[];
}

export interface IReceiveItemRequest {
  purchaseOrderItemId: string;
  receivedQuantity: number;
}

// ==================== Customer ====================
export interface ICustomer {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  note?: string;
  totalSpent: number;
  totalOrders: number;
  isActive: boolean;
  createdAt: string;
}

export interface ICreateCustomerRequest {
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  note?: string;
}

export interface IUpdateCustomerRequest {
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  note?: string;
  isActive: boolean;
}

// ==================== SalesOrder ====================
export interface ISalesOrder {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName?: string;
  warehouseId: string;
  warehouseName: string;
  status: string;
  paymentStatus: string;
  subTotal: number;
  vatAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  note?: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  items: ISalesOrderItem[];
  payments: IPayment[];
}

export interface ISalesOrderItem {
  id: string;
  productId: string;
  productName: string;
  productSKU: string;
  productVariantId?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountAmount: number;
  totalPrice: number;
}

export interface IPayment {
  id: string;
  method: string;
  amount: number;
  transactionRef?: string;
  note?: string;
  createdByName: string;
  createdAt: string;
}

export interface ICreateSalesOrderRequest {
  customerId?: string;
  warehouseId: string;
  note?: string;
  discountAmount: number;
  items: ICreateSalesOrderItemRequest[];
  payments?: ICreatePaymentRequest[];
}

export interface ICreateSalesOrderItemRequest {
  productId: string;
  productVariantId?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountAmount: number;
}

export interface ICreatePaymentRequest {
  method: string;
  amount: number;
  transactionRef?: string;
  note?: string;
}

export interface IAddPaymentRequest {
  method: string;
  amount: number;
  transactionRef?: string;
  note?: string;
}

// ==================== Reports ====================
export interface IDashboardSummary {
  todayRevenue: number;
  todayOrders: number;
  monthRevenue: number;
  monthOrders: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockCount: number;
  topSellingProducts: ITopSellingProduct[];
  recentOrders: IRecentOrder[];
}

export interface ITopSellingProduct {
  productId: string;
  productName: string;
  productSKU: string;
  quantitySold: number;
  revenue: number;
}

export interface IRecentOrder {
  id: string;
  orderNumber: string;
  customerName?: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
}

export interface IRevenueReport {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  totalOrders: number;
  totalItemsSold: number;
  averageOrderValue: number;
  periods: IRevenuePeriod[];
}

export interface IRevenuePeriod {
  period: string;
  revenue: number;
  cost: number;
  profit: number;
  orderCount: number;
  itemsSold: number;
}

export interface IProductSalesReport {
  productId: string;
  productName: string;
  productSKU: string;
  barcode?: string;
  categoryName: string;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
}

export interface ICustomerReport {
  customerId: string;
  customerName: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: string;
}

export interface IInventoryReport {
  productId: string;
  productName: string;
  productSKU: string;
  barcode?: string;
  categoryName: string;
  warehouseName: string;
  currentStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  stockValue: number;
}

export interface IPaymentMethodReport {
  method: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface IBarcodeLookup {
  productId: string;
  productName: string;
  productSKU: string;
  barcode?: string;
  sellingPrice: number;
  vatRate: number;
  availableStock: number;
}
