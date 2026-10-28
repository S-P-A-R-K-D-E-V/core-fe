// ----------------------------------------------------------------------
// Kiểm hàng khu vực mỗi ca (Quy chế Điều 24.3, Nội quy Điều 8 / 11): Admin chọn khu nhỏ; mỗi ca có phiếu đếm mù cho trưởng ca;
// chênh lệch chỉ báo lại cho quản lý — không chỉnh tồn kho.
// ----------------------------------------------------------------------

export type ShiftStockCheckStatus = 'Draft' | 'Pending' | 'Completed' | 'Cancelled';

export const SHIFT_STOCK_CHECK_STATUS_LABEL: Record<ShiftStockCheckStatus, string> = {
  Draft: 'Chưa nộp',
  Pending: 'Đã nộp',
  Completed: 'Đã xem',
  Cancelled: 'Đã huỷ',
};

export interface IShiftStockCheckLine {
  lineId: string;
  productId: string;
  productCode: string;
  productName: string;
  unit?: string | null;
  countedQuantity?: number | null;
  countedAt?: string | null;
  countedByName?: string | null;
  /** Tồn hệ thống lúc đếm — null khi đếm mù (nhân viên). */
  systemQuantity?: number | null;
  /** Đếm − hệ thống (âm = thiếu) — chỉ quản lý thấy. */
  variance?: number | null;
}

export interface IShiftStockCheck {
  id: string;
  code: string;
  areaId?: string | null;
  areaName: string;
  branchId?: string | null;
  shiftScheduleId?: string | null;
  shiftDate?: string | null;
  /** "Ca Sáng · Tủ trang sức". */
  title?: string | null;
  status: ShiftStockCheckStatus;
  dueAt?: string | null;
  isOverdue: boolean;
  createdAt: string;
  submittedAt?: string | null;
  submittedByName?: string | null;
  reviewedAt?: string | null;
  reviewedByName?: string | null;
  reviewNote?: string | null;
  /** Người xem không phải quản lý — không có số tồn / chênh lệch. */
  blind: boolean;
  totalLines: number;
  countedLines: number;
  varianceLines?: number | null;
  varianceValue?: number | null;
  lines?: IShiftStockCheckLine[] | null;
}

export interface IStockCheckArea {
  id: string;
  branchId: string;
  name: string;
  note?: string | null;
  /** true = ca nào cũng kiểm; false = luân phiên. */
  everyShift: boolean;
  sortOrder: number;
  isActive: boolean;
  productIds: string[];
  categoryIds: string[];
  productCount: number;
  /** Sản phẩm chọn riêng (để hiện lại tên khi sửa). */
  products: { id: string; code: string; name: string; unit?: string | null }[];
}

export interface ISaveStockCheckArea {
  branchId: string;
  name: string;
  note?: string | null;
  everyShift: boolean;
  sortOrder: number;
  isActive: boolean;
  productIds: string[];
  categoryIds: string[];
}
