// ----------------------------------------------------------------------
// Chương trình thưởng theo đơn (Quy chế Điều 4, 14a.4 — hoa hồng đơn online; Điều 29 — công bố trước 15 ngày, không hồi tố).
// ----------------------------------------------------------------------

export type BonusSalesSource = 'KiotViet' | 'Pos' | 'Web' | 'Online';
export type BonusProgramMode = 'PercentOfRevenue' | 'FixedPerOrder' | 'PercentByCategory';
export type BonusRecipient = 'Closer' | 'Shift';

export const BONUS_SOURCE_LABEL: Record<BonusSalesSource, string> = {
  KiotViet: 'Hoá đơn KiotViet',
  Pos: 'Bán tại quầy (app / web)',
  Web: 'Đơn trang bán hàng (web)',
  Online: 'Đơn online (chốt qua inbox)',
};

export const BONUS_MODE_LABEL: Record<BonusProgramMode, string> = {
  PercentOfRevenue: '% doanh thu đơn',
  FixedPerOrder: 'Tiền cố định mỗi đơn',
  PercentByCategory: '% theo nhóm hàng',
};

export const BONUS_RECIPIENT_LABEL: Record<BonusRecipient, string> = {
  Closer: 'Người chốt đơn (không có thì chia cho ca đang làm)',
  Shift: 'Chia đều cho ca đang làm',
};

export interface IBonusCategoryRate {
  categoryId: string;
  ratePercent: number;
}

export interface IBonusProgram {
  id: string;
  name: string;
  note?: string | null;
  isActive: boolean;
  sources: BonusSalesSource[];
  mode: BonusProgramMode;
  ratePercent?: number | null;
  fixedAmount?: number | null;
  minOrderTotal?: number | null;
  /** Bỏ dòng hàng giảm từ tỷ lệ này (0.3 = 30%); trống = không bỏ. */
  excludeDiscountRatio?: number | null;
  recipient: BonusRecipient;
  returnDays: number;
  startOn: string;
  endOn?: string | null;
  /** Ngày bắt đầu trả vào lương; trống = chỉ tính thử. */
  payFrom?: string | null;
  categoryRates: IBonusCategoryRate[];
  /** Đã trả vào lương — không sửa cách tính được nữa. */
  locked: boolean;
  noticeWarning?: string | null;
}

export type ISaveBonusProgram = Omit<IBonusProgram, 'id' | 'locked' | 'noticeWarning'>;

export interface IBonusShare {
  userId: string;
  name: string;
  amount: number;
}

export interface IBonusOrderResult {
  orderId: string;
  code: string;
  source: BonusSalesSource;
  atVn: string;
  eligibleOn: string;
  base: number;
  amount: number;
  toShift: boolean;
  paid: boolean;
  shares: IBonusShare[];
}

export interface IBonusPersonTotal {
  userId: string;
  name: string;
  orders: number;
  amount: number;
  paidOrders: number;
  paidAmount: number;
}

export interface IBonusProgramMonth {
  programId: string;
  name: string;
  month: string;
  total: number;
  paidTotal: number;
  people: IBonusPersonTotal[];
  orders: IBonusOrderResult[];
}

/** Hoá đơn trên màn đánh dấu đơn online / người chốt. */
export interface IBonusOrder {
  id: string;
  code: string;
  atVn: string;
  total: number;
  source: BonusSalesSource;
  markedOnline: boolean;
  closerUserId?: string | null;
  closerName?: string | null;
  closerSetByAdmin: boolean;
}

export interface IMyBonusProgram {
  programId: string;
  name: string;
  mode: BonusProgramMode;
  month: string;
  orders: number;
  amount: number;
  paidOrders: number;
  paidAmount: number;
}
