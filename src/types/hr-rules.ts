// ----------------------------------------------------------------------
// Luật nhân sự riêng của cửa hàng (Core-be /hr-rule-settings). Số trống / false = luật đó tắt. Cửa hàng chưa cấu hình:
// CiCi dùng bộ số đang chạy, cửa hàng khác tắt hết.
// ----------------------------------------------------------------------

export interface IHrRules {
  weeklyBonusEnabled: boolean;
  /** Bậc 1 bắt đầu khi doanh thu đạt % target này. */
  weeklyBonusTier1FromPct: number | null;
  weeklyBonusTier1RatePct: number | null;
  /** Trống = chỉ một bậc. */
  weeklyBonusTier2FromPct: number | null;
  weeklyBonusTier2RatePct: number | null;
  /** Bỏ dòng hàng giảm từ % này khỏi doanh thu tính thưởng; trống = không bỏ. */
  weeklyBonusExcludeDiscountPct: number | null;
  weeklyBonusExcludeOnline: boolean;
  /** Target tự tính = cùng tuần năm trước × xu hướng × (1 + %); trống = không tự tính. */
  targetGrowthPct: number | null;
  complaintWorkingDays: number | null;
  supportShiftMonthlyCap: number | null;
  /** "HH:mm:ss" */
  supportShiftLatestEnd: string | null;
  leaveMinNoticeHours: number | null;
  recordCashThreshold: number | null;
  performanceEnabled: boolean;
  warnSecondMainShift: boolean;
  monthlyHourCap: number | null;
  probationRoleWarnings: boolean;
}

export interface IHrRuleSettings {
  rules: IHrRules;
  /** false = cửa hàng chưa lưu cấu hình, đang dùng mặc định. */
  customized: boolean;
  updatedAt: string | null;
}
