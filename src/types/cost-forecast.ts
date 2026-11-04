// Chi phí nhân sự dự kiến — Core-be /payroll/cost-forecast.

export type CostForecastPeriod = 'Month' | 'Quarter';

export interface ICostForecastItems {
  hourlyPay: number;
  nightPremium: number;
  overtimePremium: number;
  holidayPremium: number;
  coverPay: number;
  weeklyBonus: number;
  commission: number;
  quarterEligible: number;
  quarterAtRisk: number;
  quarterLost: number;
  employerInsurance: number;
  /** Thưởng chuyên cần dự kiến (chưa có phiếu cuối tháng). */
  attendanceBonus?: number;
  /** Thưởng nhập tay trên phiếu. */
  otherBonus?: number;
  /** Tiền phạt trừ lương trong kỳ — chỉ để xem, không làm giảm chi phí. */
  fines?: number;
}

export interface ICostForecastEmployee {
  userId: string;
  name: string;
  actualHours: number;
  scheduledHours: number;
  pay: number;
  weeklyBonus: number;
  quarterBonus: number;
  quarterStatus?: string | null;
  employerInsurance: number;
  total: number;
  attendanceBonus?: number;
}

export interface ICostForecast {
  period: CostForecastPeriod;
  from: string;
  to: string;
  asOf: string;
  items: ICostForecastItems;
  capCost: number;
  totalCost: number;
  revenueActual: number;
  revenueForecast: number;
  revenue: number;
  costRatioPct?: number | null;
  capPct?: number | null;
  capAmount?: number | null;
  overCap: boolean;
  insuranceConfigured: boolean;
  employees: ICostForecastEmployee[];
  previous?: { from: string; to: string; totalCost: number; revenue: number; costRatioPct?: number | null } | null;
  notes: string[];
}

export interface IPayrollCostSetting {
  employerInsurancePct?: number | null;
  insuranceMinMonthlyWage?: number | null;
  effectiveFrom?: string | null;
}
