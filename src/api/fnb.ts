import axios, { endpoints } from 'src/utils/axios';

import type {
  IFnbMenu,
  IFnbFloor,
  IOpenOrder,
  IDiningArea,
  IDiningTable,
  IFnbQuickNote,
  IFnbRecipeBook,
  IFnbRecipeLine,
  FnbStockReason,
  IFnbStockReport,
  IOrderCommandResult,
} from 'src/types/fnb';

import type { FnbCommand } from 'src/sections/fnb-pos/lib/commands';

// ----------------------------------------------------------------------
// F&B — thiết lập (khu vực, bàn, thực đơn, ghi chú nhanh). Thêm/sửa/xoá cần Admin hoặc Quản lý; đọc thì nhân viên
// cũng được. Mọi endpoint /fnb/* cần cửa hàng bật commerce.fnb.pos và chi nhánh loại hình F&B.
// ----------------------------------------------------------------------

export async function getFnbAreas(branchId: string, includeInactive = true): Promise<IDiningArea[]> {
  const res = await axios.get<IDiningArea[]>(endpoints.fnb.areas, { params: { branchId, includeInactive } });
  return res.data;
}

export async function createFnbArea(data: { branchId: string; name: string; sortOrder?: number }) {
  const res = await axios.post<IDiningArea>(endpoints.fnb.areas, data);
  return res.data;
}

export async function updateFnbArea(id: string, data: { name: string; sortOrder: number; isActive: boolean }) {
  const res = await axios.put<IDiningArea>(endpoints.fnb.area(id), data);
  return res.data;
}

export async function deleteFnbArea(id: string) {
  await axios.delete(endpoints.fnb.area(id));
}

export async function createFnbTable(data: {
  branchId: string;
  areaId: string;
  name: string;
  seats?: number | null;
  sortOrder?: number;
}) {
  const res = await axios.post<IDiningTable>(endpoints.fnb.tables, data);
  return res.data;
}

export async function updateFnbTable(
  id: string,
  data: { areaId: string; name: string; seats: number | null; sortOrder: number; isActive: boolean }
) {
  const res = await axios.put<IDiningTable>(endpoints.fnb.table(id), data);
  return res.data;
}

export async function deleteFnbTable(id: string) {
  await axios.delete(endpoints.fnb.table(id));
}

export async function getFnbMenu(branchId: string): Promise<IFnbMenu> {
  const res = await axios.get<IFnbMenu>(endpoints.fnb.menu, { params: { branchId } });
  return res.data;
}

/** Đánh dấu hết món / có lại cho một món, một size hoặc một món thêm — theo chi nhánh. */
export async function setFnbSoldOut(data: { branchId: string; productId: string; isSoldOut: boolean }) {
  const res = await axios.put<{ productId: string; isSoldOut: boolean; menuVersion: string }>(
    endpoints.fnb.soldOut,
    data
  );
  return res.data;
}

/** Thay danh sách món thêm được phép của một món (dùng chung mọi chi nhánh), theo thứ tự hiển thị. */
export async function setFnbDishToppings(dishId: string, toppingProductIds: string[], branchId?: string) {
  const res = await axios.put<{ dishId: string; toppingIds: string[]; menuVersion: string | null }>(
    endpoints.fnb.dishToppings(dishId),
    { toppingProductIds },
    { params: branchId ? { branchId } : undefined }
  );
  return res.data;
}

export async function getFnbQuickNotes(): Promise<IFnbQuickNote[]> {
  const res = await axios.get<IFnbQuickNote[]>(endpoints.fnb.quickNotes);
  return res.data;
}

export async function createFnbQuickNote(data: { text: string; categoryIds?: string[]; sortOrder?: number }) {
  const res = await axios.post<IFnbQuickNote>(endpoints.fnb.quickNotes, data);
  return res.data;
}

export async function updateFnbQuickNote(id: string, data: { text: string; categoryIds: string[]; sortOrder: number }) {
  const res = await axios.put<IFnbQuickNote>(endpoints.fnb.quickNote(id), data);
  return res.data;
}

export async function deleteFnbQuickNote(id: string) {
  await axios.delete(endpoints.fnb.quickNote(id));
}

// ---------------------------------------------------------------------- Bán hàng F&B (web)

/** GET /fnb/floor — sơ đồ bàn + đơn đang mở của chi nhánh. */
export async function getFnbFloor(branchId: string): Promise<IFnbFloor> {
  const res = await axios.get<IFnbFloor>(endpoints.fnb.floor, { params: { branchId } });
  return res.data;
}

export async function getFnbOrder(orderId: string): Promise<IOpenOrder> {
  const res = await axios.get<IOpenOrder>(endpoints.fnb.order(orderId));
  return res.data;
}

/** Gửi một lệnh ghi lên đơn (lib/commands.ts) — lỗi bị reject bằng body problem+json (đọc bằng lib/errors.ts). */
export async function runFnbCommand(command: FnbCommand): Promise<IOrderCommandResult> {
  const res = await axios.request<IOrderCommandResult>({ method: command.method, url: command.path, data: command.body });
  return res.data;
}

// ── Kho nguyên liệu ─────────────────────────────────────────────────────

export async function getFnbRecipes(branchId: string): Promise<IFnbRecipeBook> {
  const response = await axios.get<IFnbRecipeBook>(endpoints.fnb.recipes, { params: { branchId } });
  return response.data;
}

export async function setFnbRecipe(productId: string, lines: IFnbRecipeLine[]): Promise<void> {
  await axios.put(endpoints.fnb.recipe(productId), { lines });
}

export async function getFnbStock(branchId: string): Promise<IFnbStockReport> {
  const response = await axios.get<IFnbStockReport>(endpoints.fnb.stock, { params: { branchId } });
  return response.data;
}

/** Kiểm kê (Count: quantity = số đếm) hoặc xuất huỷ (quantity = lượng bỏ đi). Gửi lại cùng clientRequestId không ghi hai lần. */
export async function adjustFnbStock(data: {
  branchId: string;
  clientRequestId: string;
  reason: FnbStockReason;
  note?: string | null;
  lines: { productId: string; quantity: number }[];
}): Promise<{ replayed: boolean }> {
  const response = await axios.post<{ replayed: boolean }>(endpoints.fnb.stockAdjustments, data);
  return response.data;
}
