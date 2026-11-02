// Thưởng hoàn thành quý — Core-be /quarter-bonuses.

export type QuarterBonusTier = 'Staff' | 'StoreManager';
export type QuarterBonusProration = 'None' | 'ByHours';
export type QuarterBonusStatus = 'Eligible' | 'AtRisk' | 'Lost';
export type QuarterBonusRunStatus = 'Provisional' | 'Closed';

export interface IQuarterBonusPerson {
  id: string;
  userId: string;
  name: string;
  tier: QuarterBonusTier;
  hours: number;
  pointsByMonth: Record<string, number>;
  maxMonthlyPoints: number;
  hasDisqualifyingViolation: boolean;
  status: QuarterBonusStatus;
  reasons: string[];
  plannedAmount: number;
  cappedAmount: number;
  finalAmount: number;
  overrideAmount?: number | null;
  overrideReason?: string | null;
  joinedOn?: string | null;
  isStoreManager: boolean;
}

export interface IQuarterBonusRun {
  quarterStart: string;
  quarterEnd: string;
  windowStart: string;
  status: QuarterBonusRunStatus;
  revenue: number;
  capAmount: number;
  otherCost: number;
  totalPlanned: number;
  scaleFactor: number;
  totalFinal: number;
  computedAt: string;
  closedAt?: string | null;
  canClose: boolean;
  people: IQuarterBonusPerson[];
}

export interface IMyQuarterBonus {
  quarterStart: string;
  quarterEnd: string;
  windowStart: string;
  runStatus: QuarterBonusRunStatus;
  status: QuarterBonusStatus;
  hours: number;
  minHours: number;
  maxMonthlyPoints: number;
  monthlyPointsLimit: number;
  policyAmount: number;
  expectedAmount: number;
  reasons: string[];
}

export interface IQuarterBonusPolicy {
  id: string;
  tier: QuarterBonusTier;
  amount: number;
  minHours: number;
  monthlyPointsLimit: number;
  capRevenuePct: number;
  proration: QuarterBonusProration;
  minTenureMonths: number;
  windowStart?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  note?: string | null;
}

export type ISaveQuarterBonusPolicy = Omit<IQuarterBonusPolicy, 'id'>;

export interface IQuarterBonusStaff {
  userId: string;
  name: string;
  joinedOn?: string | null;
  isStoreManager: boolean;
}

export interface IWeeklyBonusRate {
  id: string;
  effectiveFrom: string;
  tier1FromPct: number;
  tier1RatePct: number;
  tier2FromPct?: number | null;
  tier2RatePct?: number | null;
}

export type ISaveWeeklyBonusRate = Omit<IWeeklyBonusRate, 'id'>;
