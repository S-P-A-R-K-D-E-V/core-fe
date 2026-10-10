// ----------------------------------------------------------------------
// F&B — kiểu dữ liệu theo hợp đồng API v1 (core-be Docs/fnb/api-contract.md, mục 3 và 4). Chỉ phần thiết lập trên
// web: khu vực, bàn, thực đơn (hết món, món thêm), ghi chú nhanh. Gọi món / thanh toán làm trên app.
// ----------------------------------------------------------------------

export interface IDiningTable {
  id: string;
  branchId: string;
  areaId: string;
  name: string;
  seats: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface IDiningArea {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  tables: IDiningTable[];
}

export interface IFnbMenuVariant {
  productId: string;
  name: string | null;
  price: number;
  isSoldOut: boolean;
  sortOrder: number;
}

export interface IFnbMenuDish {
  id: string;
  categoryId: string | null;
  code: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
  isSoldOut: boolean;
  priceFrom: number;
  variants: IFnbMenuVariant[];
  toppingIds: string[];
}

export interface IFnbMenuTopping {
  productId: string;
  name: string;
  price: number;
  isSoldOut: boolean;
  sortOrder: number;
}

export interface IFnbMenuCategory {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export interface IFnbQuickNote {
  id: string;
  text: string;
  categoryIds: string[];
  sortOrder: number;
}

export interface IFnbMenu {
  branchId: string;
  menuVersion: string;
  generatedAt: string;
  categories: IFnbMenuCategory[];
  dishes: IFnbMenuDish[];
  toppings: IFnbMenuTopping[];
  quickNotes: IFnbQuickNote[];
}

// ----------------------------------------------------------------------
// Bán hàng F&B trên web (hợp đồng API v1, mục 2, 4.3, 5, 6, 7) — cùng kiểu với app (corecms-mobile src/types/fnb.ts).
// Tiền là số nguyên đồng, thời điểm ISO-8601 UTC, mọi id là uuid chữ thường; enum lạ từ máy chủ được nhận như chuỗi.
// ----------------------------------------------------------------------

/** Giá trị enum của máy chủ — giữ gợi ý các giá trị đã biết nhưng vẫn nhận chuỗi lạ. */
type Open<T extends string> = T | (string & {});

export type FnbOrderStatus = Open<'Open' | 'Paid' | 'Cancelled' | 'Moved'>;
export type FnbLineStatus = Open<'Pending' | 'Sent' | 'Voided' | 'Removed'>;
export type FnbLineType = Open<'Item' | 'OpenItem'>;
export type FnbServiceType = Open<'DineIn' | 'Takeaway'>;
export type FnbPaymentMethod = 'Cash' | 'Transfer' | 'Card';
export type FnbPrintStatus = Open<'Pending' | 'Printed' | 'Failed' | 'Skipped'>;

export interface ILineTopping {
  productId: string;
  name: string;
  /** Số phần cho MỘT đơn vị món (1..20). */
  quantity: number;
  unitPrice: number;
}

export interface IOrderLine {
  id: string;
  /** Thứ tự hiển thị trong đơn do máy chủ cấp. */
  seq: number;
  status: FnbLineStatus;
  /** OpenItem = món ngoài thực đơn (tên + giá tự nhập). */
  lineType: FnbLineType;
  productId: string;
  dishId: string | null;
  name: string;
  variantName: string | null;
  /** Số lượng còn tính tiền. */
  quantity: number;
  orderedQuantity: number;
  voidedQuantity: number;
  listPrice: number;
  /** Giá một đơn vị, chưa gồm món thêm. */
  unitPrice: number;
  priceOverride: { reason: string; byName: string; at: string } | null;
  toppings: ILineTopping[];
  quickNotes: string[];
  note: string | null;
  /** quantity × (unitPrice + Σ topping.quantity × topping.unitPrice) — máy chủ tính. */
  amount: number;
  /** Phiếu bar đã gửi dòng này. */
  ticketId: string | null;
  sentAt: string | null;
  movedFromOrderId: string | null;
  movedFromLineId: string | null;
  createdAt: string;
  createdByName: string;
  flags: string[];
}

export interface IOrderDiscount {
  type: Open<'Percent' | 'Amount'>;
  value: number;
  reason: string;
  byName: string;
  at: string;
}

export interface IOrderPaymentPart {
  method: FnbPaymentMethod;
  amount: number;
  bankAccountId: string | null;
  transactionRef: string | null;
}

export interface IOrderPayment {
  salesOrderId: string;
  salesOrderCode: string;
  paidAt: string;
  paidByName: string;
  payments: IOrderPaymentPart[];
  cashTendered: number | null;
  changeDue: number;
}

export interface IOrderTotals {
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  total: number;
}

export interface IOrderBill {
  firstPrintedAt: string;
  lastPrintedAt: string;
  printCount: number;
  lastTotal: number;
  lastByName: string;
}

/** Đơn mở (một bàn hoặc mang về). `version` tăng 1 sau mỗi lệnh đã áp dụng. */
export interface IOpenOrder {
  id: string;
  version: number;
  status: FnbOrderStatus;
  branchId: string;
  /** null = mang về. */
  tableId: string | null;
  tableName: string | null;
  areaName: string | null;
  serviceType: FnbServiceType;
  orderNo: number;
  /** Số in trên phiếu bar và tạm tính. */
  displayNo: string;
  guestCount: number | null;
  customerId: string | null;
  customerName: string | null;
  note: string | null;
  /** Mọi dòng kể cả Voided / Removed, xếp theo seq. */
  lines: IOrderLine[];
  discount: IOrderDiscount | null;
  totals: IOrderTotals;
  bill: IOrderBill | null;
  /** true khi đã in tạm tính (hoặc theo chính sách cửa hàng): huỷ món đã gửi cần quản lý. */
  voidRequiresManager: boolean;
  payment: IOrderPayment | null;
  movedToOrderId: string | null;
  cancelReason: string | null;
  reviewFlags: string[];
  openedAt: string;
  openedByName: string;
  updatedAt: string;
  closedAt: string | null;
  closedByName: string | null;
}

export interface IOrderSummary {
  id: string;
  version: number;
  status: FnbOrderStatus;
  branchId: string;
  tableId: string | null;
  displayNo: string;
  guestCount: number | null;
  itemCount: number;
  pendingLineCount: number;
  total: number;
  billPrinted: boolean;
  openedAt: string;
  updatedAt: string;
  openedByName: string;
}

export interface IKitchenTicketLine {
  lineId: string;
  name: string;
  variantName: string | null;
  quantity: number;
  toppings: { name: string; quantity: number }[];
  quickNotes: string[];
  note: string | null;
}

/** Phiếu bar: nội dung chụp lúc tạo (không đổi) + trạng thái in (đổi được). */
export interface IKitchenTicket {
  id: string;
  kind: Open<'Order' | 'Void'>;
  branchId: string;
  orderId: string;
  station: string;
  /** 1,2,3… theo đơn với phiếu Order; null với phiếu Void. */
  roundNo: number | null;
  displayNo: string;
  tableName: string | null;
  areaName: string | null;
  serviceType: FnbServiceType;
  createdAt: string;
  createdByName: string;
  voidReason: string | null;
  lines: IKitchenTicketLine[];
  printStatus: FnbPrintStatus;
  printAttempts: number;
  printedAt: string | null;
  printedByDeviceId: string | null;
  printedByDeviceName: string | null;
  lastPrintError: string | null;
  reprintCount: number;
  claimedByDeviceId: string | null;
  claimExpiresAt: string | null;
  updatedAt: string;
}

/** Kết quả của mọi lệnh trên đơn. */
export interface IOrderCommandResult {
  order: IOpenOrder;
  replayed: boolean;
  /** Phiếu bar do lệnh này tạo, không có thì null. */
  ticket: IKitchenTicket | null;
  /** Lệnh chuyển món: đơn đích. */
  otherOrder: IOpenOrder | null;
}

export interface ITicketCommandResult {
  ticket: IKitchenTicket;
  replayed: boolean;
}

// ── Sơ đồ bàn ───────────────────────────────────────────────────────────

export interface IFloorTable {
  id: string;
  name: string;
  seats: number | null;
  sortOrder: number;
  isActive: boolean;
  /** Các đơn đang mở tại bàn (bàn có thể có nhiều đơn sau khi tách). */
  orders: IOrderSummary[];
}

export interface IFloorArea {
  id: string;
  name: string;
  sortOrder: number;
  tables: IFloorTable[];
}

export interface IUnprintedTicket {
  id: string;
  orderId: string;
  kind: string;
  printStatus: FnbPrintStatus;
  createdAt: string;
  claimExpiresAt: string | null;
}

/** GET /fnb/floor — ảnh chụp sơ đồ bàn của một chi nhánh. */
export interface IFnbFloor {
  branchId: string;
  serverTime: string;
  /** Mốc để hỏi tiếp GET /fnb/sync. */
  cursor: string;
  menuVersion: string;
  tablesVersion: string;
  areas: IFloorArea[];
  takeawayOrders: IOrderSummary[];
  unprintedTickets: IUnprintedTicket[];
}

/** GET /fnb/sync — các đơn và phiếu đổi từ `cursor` (giao ít nhất một lần, có thể lặp). */
export interface IFnbSync {
  cursor: string;
  serverTime: string;
  menuVersion: string;
  tablesVersion: string;
  capabilities?: { offlineReplay?: boolean } | null;
  orders: IOpenOrder[];
  tickets: IKitchenTicket[];
  hasMore: boolean;
}

// ── Kho nguyên liệu (định lượng, tồn, số phần món còn pha được) ─────────

export type FnbServiceScope = 'All' | 'DineIn' | 'Takeaway';
export type FnbItemKind = 'Goods' | 'Ingredient' | 'SemiFinished' | 'Dish';

export interface IFnbRecipeLine {
  ingredientId: string;
  /** Lượng theo đơn vị gốc của nguyên liệu cho một phần. */
  quantity: number;
  serviceScope: FnbServiceScope;
}

export interface IFnbRecipeItem {
  productId: string;
  dishId: string | null;
  name: string;
  variantName: string | null;
  isTopping: boolean;
  price: number;
  lines: IFnbRecipeLine[];
  /** Giá vốn một phần theo giá vốn nguyên liệu hiện tại (null = chưa có định lượng / giá vốn). */
  costDineIn: number | null;
  costTakeaway: number | null;
}

export interface IFnbIngredientOption {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  kind: FnbItemKind;
  unitCost: number | null;
  onHand: number;
}

export interface IFnbRecipeBook {
  items: IFnbRecipeItem[];
  ingredients: IFnbIngredientOption[];
}

export type FnbStockStatus = 'out' | 'low' | 'ok' | 'idle';

export interface IFnbStockIngredient {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  kind: FnbItemKind;
  onHand: number;
  unitCost: number | null;
  value: number;
  /** Lượng dùng pha chế (ròng) trong usageDays ngày. */
  used: number;
  daysLeft: number | null;
  usedInDishes: number;
  status: FnbStockStatus;
  /** Đơn vị mua quy đổi (vd hộp = 380 ml) — nhập xuất huỷ / kiểm kho theo đơn vị này. */
  units: IFnbUnitOption[];
}

export interface IFnbUnitOption {
  unitId: string;
  name: string;
  /** 1 đơn vị = factor đơn vị gốc. */
  factor: number;
}

export interface IFnbDishAvailability {
  productId: string;
  name: string;
  variantName: string | null;
  isTopping: boolean;
  /** Nếu chỉ pha riêng món này. */
  maxPortions: number;
  /** Chia nguyên liệu dùng chung theo tỷ lệ bán gần đây. */
  estimatedPortions: number;
  soldUnits: number;
  limitingIngredientId: string | null;
  limitingIngredientName: string | null;
}

export interface IFnbStockReport {
  generatedAt: string;
  usageDays: number;
  salesDays: number;
  ingredients: IFnbStockIngredient[];
  dishes: IFnbDishAvailability[];
}


// ── Phiếu xuất huỷ / phiếu kiểm kho ───────────────────────────────────────

export type FnbDocStatus = 'Draft' | 'Pending' | 'Completed' | 'Cancelled';
export type FnbDisposalReason = 'Expired' | 'Damaged' | 'Spilled' | 'BadMake' | 'Other';

export interface IFnbDisposalLine {
  productId: string;
  productCode: string;
  productName: string;
  unit: string | null;
  /** Theo đơn vị gốc. */
  quantity: number;
  enteredUnitName: string | null;
  enteredQuantity: number | null;
  reason: FnbDisposalReason;
  reasonLabel: string;
  note: string | null;
  /** null với nhân viên. */
  costPrice: number | null;
  value: number | null;
}

export interface IFnbDisposal {
  id: string;
  code: string;
  branchId: string | null;
  status: FnbDocStatus;
  createdAt: string;
  createdById: string;
  createdByName: string | null;
  note: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  totalValue: number | null;
  /** Danh sách: url rỗng; chi tiết: url xem ảnh (hạn 1 giờ). */
  photos: { key: string; url: string }[];
  lines: IFnbDisposalLine[];
}

export interface IFnbStockCountLine {
  lineId: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: string | null;
  units: IFnbUnitOption[];
  isCounted: boolean;
  countedQuantity: number | null;
  countEntry: string | null;
  countedAt: string | null;
  countedByName: string | null;
  /** null khi đếm mù (nhân viên). */
  systemQuantity: number | null;
  variance: number | null;
  varianceValue: number | null;
  varianceReason: string | null;
  needsReason: boolean;
}

export interface IFnbStockCount {
  id: string;
  code: string;
  branchId: string | null;
  status: FnbDocStatus;
  scope: string | null;
  note: string | null;
  createdAt: string;
  createdById: string;
  createdByName: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  /** Người xem đang đếm mù. */
  blind: boolean;
  totalLines: number;
  countedLines: number;
  totalVarianceValue: number | null;
  lines: IFnbStockCountLine[] | null;
}

export type FnbCountScope = 'All' | 'Recipe' | 'Products';
