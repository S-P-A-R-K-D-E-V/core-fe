import { IPurchaseOrder, IPurchaseOrderItem } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Trạng thái phiếu nhập hiển thị theo cách gọi của KiotViet (cửa hàng quen): Phiếu tạm / Đã nhập hàng / Đã huỷ.
//
// "Returned" trong DB là phiếu đồng bộ từ KiotViet có status = 3 — KiotViet gọi là "Đã nhập hàng" (đã sai ghi thành
// "Đã trả"). Giá trị trong DB chưa đổi (sổ cổ đông "ai chi hộ" đang dựa vào nó) — chỉ đổi cách hiện.
// ----------------------------------------------------------------------

type LabelColor = 'default' | 'info' | 'warning' | 'success' | 'error';

const STATUS_META: Record<string, { label: string; color: LabelColor }> = {
  Draft: { label: 'Phiếu tạm', color: 'warning' },
  Confirmed: { label: 'Đã duyệt', color: 'info' },
  PartiallyReceived: { label: 'Nhận một phần', color: 'info' },
  Completed: { label: 'Đã nhập hàng', color: 'success' },
  Returned: { label: 'Đã nhập hàng', color: 'success' },
  Cancelled: { label: 'Đã huỷ', color: 'error' },
};

export function purchaseStatusMeta(status: string): { label: string; color: LabelColor } {
  return STATUS_META[status] ?? { label: status, color: 'default' };
}

/** Nhóm lọc trên màn danh sách — mỗi nhóm gồm các trạng thái trong DB. */
export const STATUS_GROUPS = [
  { key: 'temp', label: 'Phiếu tạm', statuses: ['Draft', 'Confirmed', 'PartiallyReceived'] },
  { key: 'done', label: 'Đã nhập hàng', statuses: ['Completed', 'Returned'] },
  { key: 'cancelled', label: 'Đã huỷ', statuses: ['Cancelled'] },
] as const;

export type StatusGroupKey = (typeof STATUS_GROUPS)[number]['key'];

/** Hàng đã vào kho (phiếu hoàn thành ở core hoặc phiếu "Đã nhập hàng" kéo từ KiotViet). */
export function isStocked(status: string): boolean {
  return status === 'Completed' || status === 'Returned';
}

/**
 * Tổng tiền hàng của phiếu: phiếu kéo từ KiotViet không có tạm tính (subTotal = 0) — cộng từ các dòng.
 */
export function purchaseSubTotal(order: Pick<IPurchaseOrder, 'subTotal' | 'items'>): number {
  if (order.subTotal) return order.subTotal;
  return (order.items || []).reduce((sum, item) => sum + (item.totalPrice || 0), 0);
}

/**
 * Số đã nhận của dòng: phiếu "Đã nhập hàng" kéo từ KiotViet không ghi số nhận (= 0) — KiotViet đã nhập đủ.
 */
export function receivedQuantityOf(status: string, item: Pick<IPurchaseOrderItem, 'quantity' | 'receivedQuantity'>): number {
  if (isStocked(status) && !item.receivedQuantity) return item.quantity;
  return item.receivedQuantity;
}
