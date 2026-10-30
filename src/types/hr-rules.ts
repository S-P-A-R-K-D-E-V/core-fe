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
  /** Target tự tính = trung bình cùng tuần `targetYears` năm × hệ số quy đổi 8 tuần × (1 + %); trống = không tự tính. */
  targetGrowthPct: number | null;
  /** Số năm lấy cùng kỳ (1–5); trống = 1 năm. */
  targetYears: number | null;
  /** Sàn = trung vị 8 tuần không có ngày lễ × (1 + %); trống = dùng % của target. */
  targetFloorPct: number | null;
  /** Trần % đạt target của một ca khi tính tỷ lệ đạt tháng; trống = không có trần. */
  targetShiftCapPct: number | null;
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
