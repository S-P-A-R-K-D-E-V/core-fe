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
  /** Món là combo: các nhóm thành phần; null / thiếu = món thường. Combo không có size và không nhận món thêm. */
  combo?: IFnbMenuCombo | null;
}

/** Mỗi nhóm chọn đúng một lựa chọn (nhóm một lựa chọn = thành phần cố định); lựa chọn đầu là mặc định. */
export interface IFnbMenuCombo {
  groups: IFnbMenuComboGroup[];
}

export interface IFnbMenuComboGroup {
  id: string;
  name: string;
  sortOrder: number;
  options: IFnbMenuComboOption[];
}

export interface IFnbMenuComboOption {
  /** Dòng bán được của món thành phần (size hoặc chính món). */
  productId: string;
  dishId: string;
  name: string;
  variantName: string | null;
  /** Số lượng cho MỖI combo. */
  quantity: number;
  /** Giá bán lẻ của món thành phần. */
  price: number;
  /** Phụ thu cộng vào giá combo khi chọn. */
  surcharge: number;
  isSoldOut: boolean;
  sortOrder: number;
}

// ── Khai combo (Thiết lập F&B) ──────────────────────────────────────────

export interface IFnbComboOptionItem {
  productId: string;
  name: string;
  variantName: string | null;
  quantity: number;
  surcharge: number;
  /** Giá bán lẻ hiện tại; null khi món không còn trên thực đơn. */
  price: number | null;
  isAvailable: boolean;
}

export interface IFnbComboItem {
  productId: string;
  code: string;
  name: string;
  price: number;
  /** false = món đã tắt, hoặc có nhóm không còn lựa chọn hợp lệ. */
  isOnMenu: boolean;
  /** Tổng giá bán lẻ của các lựa chọn mặc định. */
  componentsPrice: number;
  groups: { id: string; name: string; options: IFnbComboOptionItem[] }[];
}

export interface IFnbComboBook {
  combos: IFnbComboItem[];
  /** Món chưa là combo, không có size — biến thành combo được. */
  candidates: { productId: string; code: string; name: string; price: number }[];
  /** Dòng bán được của các món thường — chọn làm thành phần được. */
  choices: { productId: string; dishId: string; name: string; variantName: string | null; price: number }[];
}

export interface IFnbComboGroupInput {
  name: string;
  options: { productId: string; quantity: number; surcharge: number }[];
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

/** Thành phần đã chọn của dòng combo; `quantity` là số lượng cho MỖI combo. */
export interface ILineComponent {
  groupId: string;
  groupName: string;
  productId: string;
  name: string;
  variantName: string | null;
  quantity: number;
  listPrice: number;
  surcharge: number;
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
  /** Dòng combo: các món thành phần đã chọn (rỗng / thiếu với món thường). Huỷ / chuyển đi cả combo. */
  components?: ILineComponent[];
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
  /** Dòng combo: các món quầy bar phải làm, số lượng cho MỖI combo. */
  components?: { name: string; variantName: string | null; quantity: number }[];
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
  /** Hạn dùng sớm nhất của các lô còn hàng (yyyy-MM-dd); null = không lô nào ghi hạn. */
  nearestExpiry: string | null;
  /** Lượng thuộc lô còn ≤ 3 ngày tới hạn / đã quá hạn (đơn vị gốc). */
  expiringQuantity: number;
  expiredQuantity: number;
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
  /** Lô bị huỷ (huỷ theo lô); null = trừ theo hạn sớm nhất trước. */
  lotId?: string | null;
  lotLabel?: string | null;
  lotExpiryDate?: string | null;
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

// ── Lô & hạn dùng, báo cáo hao hụt ───────────────────────────────────────

export type FnbLotStatus = 'expired' | 'expiring' | 'ok' | 'none';
export type FnbLotSource = 'PurchaseOrder' | 'Batch' | 'Opening' | 'Adjustment';

export interface IFnbLot {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: string | null;
  source: FnbLotSource;
  /** Số phiếu nhập (lô nhận hàng) hoặc số phiếu pha (lô pha mẻ). */
  label: string | null;
  receivedAt: string;
  /** yyyy-MM-dd; null = không rõ hạn. */
  expiryDate: string | null;
  /** Âm = đã quá hạn; null = không rõ hạn. */
  daysLeft: number | null;
  status: FnbLotStatus;
  quantity: number;
  remaining: number;
  /** null với nhân viên. */
  value: number | null;
  units: IFnbUnitOption[];
}

export interface IFnbLotsReport {
  today: string;
  expiringDays: number;
  lots: IFnbLot[];
}

export interface IFnbLossReason {
  reason: FnbDisposalReason;
  label: string;
  quantity: number;
  value: number;
}

export interface IFnbVarianceRow {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  unitCost: number | null;
  opening: number;
  purchased: number;
  /** Dùng theo định lượng (ròng), gồm cả madeVoided. */
  used: number;
  madeVoided: number;
  /** Bán thành phẩm pha ra từ phiếu pha mẻ (ròng). */
  produced: number;
  /** Lượng dùng pha mẻ bán thành phẩm (ròng). */
  batchUsed: number;
  disposed: number;
  disposedByReason: IFnbLossReason[];
  /** + thừa, − thiếu khi kiểm. */
  countVariance: number;
  other: number;
  closing: number;
  loss: number;
  lossValue: number;
  /** 0–1; null = không tiêu hao. */
  lossRate: number | null;
  units: IFnbUnitOption[];
}

export interface IFnbVarianceReport {
  from: string;
  to: string;
  lastCountAt: string | null;
  totals: {
    purchasedValue: number;
    usedValue: number;
    disposedValue: number;
    madeVoidedValue: number;
    shortageValue: number;
    surplusValue: number;
    lossValue: number;
    disposedByReason: IFnbLossReason[];
  };
  rows: IFnbVarianceRow[];
}

// ── Lãi gộp theo món ─────────────────────────────────────────────────────

/** dish = món, topping = món thêm, goods = hàng bán thẳng (trừ tồn chính nó). */
export type FnbDishMarginKind = 'dish' | 'topping' | 'goods';

/** Một mặt hàng đã bán trong kỳ (size là một dòng riêng); tiền đã làm tròn đồng. */
export interface IFnbDishMarginRow {
  id: string;
  code: string;
  name: string;
  kind: FnbDishMarginKind;
  quantity: number;
  /** Sau giảm giá dòng và giảm giá toàn đơn. */
  revenue: number;
  averagePrice: number | null;
  /** Giá vốn của các dòng có giá vốn. */
  cost: number;
  /** Giá vốn bình quân một đơn vị; null = chưa dòng nào có giá vốn. */
  unitCost: number | null;
  /** Doanh thu của các dòng có giá vốn − giá vốn. */
  profit: number;
  /** 0–1; null = không dòng nào có giá vốn. */
  marginRate: number | null;
  uncostedQuantity: number;
  /** Doanh thu của các dòng chưa có giá vốn — không nằm trong lãi gộp. */
  uncostedRevenue: number;
  /** 0–1: tỷ trọng doanh thu trong kỳ. */
  revenueShare: number | null;
}

export interface IFnbDishMarginReport {
  from: string;
  to: string;
  invoiceCount: number;
  totals: {
    revenue: number;
    cost: number;
    profit: number;
    marginRate: number | null;
    uncostedRevenue: number;
  };
  rows: IFnbDishMarginRow[];
}

// ── Bán thành phẩm pha theo mẻ ───────────────────────────────────────────

export interface IFnbBatchRecipeLine {
  ingredientId: string;
  /** Lượng cho MỘT mẻ, đơn vị gốc của nguyên liệu. */
  quantity: number;
}

export interface IFnbBatchRecipeItem {
  productId: string;
  code: string;
  name: string;
  unit: string | null;
  onHand: number;
  /** Sản lượng một mẻ (đơn vị gốc); null = chưa có công thức mẻ. */
  yieldQuantity: number | null;
  /** Hạn của lô pha = ngày pha + số ngày này; null = không ghi hạn. */
  shelfLifeDays: number | null;
  note: string | null;
  lines: IFnbBatchRecipeLine[];
  /** Giá vốn nguyên liệu một mẻ — null với nhân viên / chưa có giá vốn. */
  batchCost: number | null;
  /** Giá vốn một đơn vị gốc theo công thức. */
  recipeUnitCost: number | null;
  /** Giá vốn bình quân hiện tại. */
  unitCost: number | null;
  units: IFnbUnitOption[];
}

export interface IFnbBatchRecipeBook {
  items: IFnbBatchRecipeItem[];
  ingredients: IFnbIngredientOption[];
}

export interface IFnbBatchLine {
  ingredientId: string;
  code: string;
  name: string;
  unit: string | null;
  quantity: number;
  /** null với nhân viên. */
  unitCost: number | null;
  value: number | null;
}

export interface IFnbBatch {
  id: string;
  code: string;
  branchId: string;
  productId: string;
  productCode: string;
  productName: string;
  unit: string | null;
  batchCount: number;
  /** Sản lượng theo công thức; null = pha không theo công thức. */
  plannedYield: number | null;
  actualYield: number;
  expiryDate: string | null;
  lotId: string | null;
  status: 'Completed' | 'Cancelled';
  note: string | null;
  createdAt: string;
  createdById: string;
  createdByName: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelNote: string | null;
  /** null với nhân viên. */
  totalCost: number | null;
  unitCost: number | null;
  lines: IFnbBatchLine[];
}

// ── Dự báo nhập nguyên liệu ──────────────────────────────────────────────

/** out = hết, order = nên đặt ngay, soon = sắp tới lúc đặt, ordered = đã đặt đủ, ok, idle = không dùng. */
export type FnbForecastStatus = 'out' | 'order' | 'soon' | 'ordered' | 'ok' | 'idle';
export type FnbForecastConfidence = 'low' | 'medium' | 'high';

export interface IFnbForecastPurchase {
  /** null = đơn vị gốc. */
  unitId: string | null;
  unitName: string | null;
  factor: number;
  /** Số lượng theo đơn vị nhập. */
  quantity: number;
  unitPrice: number | null;
}

export interface IFnbForecastRow {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  kind: FnbItemKind;
  onHand: number;
  /** Tồn dùng được = tồn − phần sẽ hỏng trước khi kịp dùng. */
  usable: number;
  waste: number;
  avgDaily: number;
  /** Chỉ số 0 = Chủ nhật … 6 = Thứ Bảy. */
  weekday: number[];
  last7Daily: number;
  /** 7 ngày gần nhất / trung bình trước đó; null = chưa đủ dữ liệu. */
  trend: number | null;
  dataDays: number;
  confidence: FnbForecastConfidence;
  daysLeft: number | null;
  runOutDate: string | null;
  reorderPoint: number;
  onOrder: number;
  status: FnbForecastStatus;
  /** Lượng nên nhập (đơn vị gốc); 0 = chưa cần. */
  suggestedQuantity: number;
  purchase: IFnbForecastPurchase | null;
  /** Bán thành phẩm có công thức mẻ — pha thêm thay vì nhập. */
  makeInHouse: boolean;
  supplierId: string | null;
  supplierName: string | null;
  estimatedCost: number | null;
  units: IFnbUnitOption[];
}

export interface IFnbForecastReport {
  generatedAt: string;
  today: string;
  historyDays: number;
  dataDays: number;
  confidence: FnbForecastConfidence;
  settings: { leadDays: number; safetyDays: number; coverDays: number };
  rows: IFnbForecastRow[];
}

export interface IFnbForecastResponse {
  report: IFnbForecastReport;
  aiAvailable: boolean;
  aiUnavailableReason: string | null;
}

export interface IFnbForecastAdvice {
  text: string;
  generatedAt: string;
}
