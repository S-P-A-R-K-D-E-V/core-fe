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
  IFnbStockReport,
  IKitchenTicket,
  FnbPrintStatus,
  IFnbDisposal,
  FnbDocStatus,
  FnbCountScope,
  IFnbStockCount,
  FnbDisposalReason,
  IOrderCommandResult,
} from 'src/types/fnb';

import { newId, isoNow, currentDeviceId } from 'src/sections/fnb-pos/lib/ids';

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

// ── Phiếu bar (hợp đồng 6.2–6.4) ───────────────────────────────────────

/** Phiếu bar của chi nhánh, mới nhất trước. `printStatus` dạng "Pending,Failed,Skipped". */
export async function getKitchenTickets(
  branchId: string,
  params: { printStatus?: FnbPrintStatus[]; from?: string; minAgeSeconds?: number; limit?: number } = {}
): Promise<IKitchenTicket[]> {
  const res = await axios.get<IKitchenTicket[]>(endpoints.fnb.kitchenTickets, {
    params: {
      branchId,
      printStatus: params.printStatus?.join(','),
      from: params.from,
      minAgeSeconds: params.minAgeSeconds,
      limit: params.limit,
    },
  });
  return res.data;
}

/** `deviceId`: mã máy gửi lệnh — Máy in phiếu dùng mã riêng để không trùng với tab bán hàng cùng trình duyệt. */
const ticketEnvelope = (deviceId?: string) => ({
  clientRequestId: newId(),
  deviceId: deviceId ?? currentDeviceId(),
  clientTime: isoNow(),
});

/** Giữ quyền in 30 giây (reprint = false) hoặc ghi nhật ký in lại (reprint = true). */
export async function claimTicketPrint(
  ticketId: string,
  deviceName: string,
  reprint: boolean,
  deviceId?: string
): Promise<IKitchenTicket> {
  const res = await axios.post<{ ticket: IKitchenTicket }>(endpoints.fnb.ticketPrint(ticketId), {
    ...ticketEnvelope(deviceId),
    deviceName,
    reprint,
  });
  return res.data.ticket;
}

export async function reportTicketPrint(
  ticketId: string,
  deviceName: string,
  result: 'Printed' | 'Failed' | 'Skipped',
  error: string | null,
  reprint: boolean,
  deviceId?: string
): Promise<IKitchenTicket> {
  const res = await axios.post<{ ticket: IKitchenTicket }>(endpoints.fnb.ticketPrintResult(ticketId), {
    ...ticketEnvelope(deviceId),
    deviceName,
    result,
    error,
    reprint,
  });
  return res.data.ticket;
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

// ── Phiếu xuất huỷ ──────────────────────────────────────────────────────

export async function getFnbDisposals(branchId: string, status?: FnbDocStatus): Promise<IFnbDisposal[]> {
  const res = await axios.get<IFnbDisposal[]>(endpoints.fnb.disposals, { params: { branchId, status } });
  return res.data;
}

export async function getFnbDisposal(id: string): Promise<IFnbDisposal> {
  const res = await axios.get<IFnbDisposal>(endpoints.fnb.disposal(id));
  return res.data;
}

/** Tải ảnh hàng huỷ thẳng lên R2: xin URL có chữ ký rồi PUT từng file; trả khoá ảnh để gửi kèm phiếu. */
export async function uploadFnbDisposalPhotos(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const res = await axios.post<{ objectKey: string; uploadUrl: string }[]>(endpoints.fnb.disposalPhotos, {
    files: files.map((f) => ({ fileName: f.name, contentType: f.type || 'image/jpeg' })),
  });
  await Promise.all(
    res.data.map(async (slot, index) => {
      const file = files[index];
      const put = await fetch(slot.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      });
      if (!put.ok) throw new Error(`Không tải được ảnh ${file.name}`);
    })
  );
  return res.data.map((slot) => slot.objectKey);
}

export async function createFnbDisposal(data: {
  branchId: string;
  clientRequestId: string;
  note?: string | null;
  photoKeys: string[];
  lines: { productId: string; quantity: number; unitId: string | null; reason: FnbDisposalReason; note?: string | null }[];
}): Promise<IFnbDisposal> {
  const res = await axios.post<IFnbDisposal>(endpoints.fnb.disposals, data);
  return res.data;
}

/** action: approve | reject | cancel. */
export async function reviewFnbDisposal(id: string, action: 'approve' | 'reject' | 'cancel', note?: string | null) {
  const res = await axios.post<IFnbDisposal>(endpoints.fnb.disposalReview(id), { action, note });
  return res.data;
}

// ── Phiếu kiểm kho ──────────────────────────────────────────────────────

export async function getFnbStockCounts(branchId: string, status?: FnbDocStatus): Promise<IFnbStockCount[]> {
  const res = await axios.get<IFnbStockCount[]>(endpoints.fnb.stockCounts, { params: { branchId, status } });
  return res.data;
}

export async function getFnbStockCount(id: string): Promise<IFnbStockCount> {
  const res = await axios.get<IFnbStockCount>(endpoints.fnb.stockCount(id));
  return res.data;
}

export async function createFnbStockCount(data: {
  branchId: string;
  scope: FnbCountScope;
  productIds?: string[];
  note?: string | null;
}): Promise<IFnbStockCount> {
  const res = await axios.post<IFnbStockCount>(endpoints.fnb.stockCounts, data);
  return res.data;
}

/** Lưu số đếm: mỗi dòng gồm các phần theo đơn vị (unitId null = đơn vị gốc); parts rỗng = xoá số đếm. */
export async function saveFnbStockCount(
  id: string,
  entries: { lineId: string; parts: { unitId: string | null; quantity: number }[] }[]
): Promise<IFnbStockCount> {
  const res = await axios.put<IFnbStockCount>(endpoints.fnb.stockCountEntries(id), { entries });
  return res.data;
}

/** action: submit | approve | return | cancel; approve kèm lý do cho dòng chênh lớn. */
export async function reviewFnbStockCount(
  id: string,
  action: 'submit' | 'approve' | 'return' | 'cancel',
  note?: string | null,
  reasons?: { lineId: string; reason: string }[]
): Promise<IFnbStockCount> {
  const res = await axios.post<IFnbStockCount>(endpoints.fnb.stockCountReview(id), { action, note, reasons });
  return res.data;
}
