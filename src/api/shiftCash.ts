import axios, { endpoints } from 'src/utils/axios';
import {
  IShiftCashSummary,
  IShiftCashTransaction,
  IShiftCashDenomination,
  IShiftCashLog,
  IAuditLogEntry,
  IAddShiftCashTransactionRequest,
  IUpdateShiftCashTransactionRequest,
  IUpdateDenominationRequest,
  IUpdateDenominationBatchRequest,
  IKiotVietDailySummary,
  IKiotVietInvoiceDetailResponse,
  IKiotVietBankAccount,
  IVietQRBank,
} from 'src/types/corecms-api';
import { ShiftCashGeo, shiftCashGeoHeaders } from 'src/utils/shift-cash-access';

// ======================================================================
// Vị trí GPS đã qua cổng Kiểm quầy (ShiftCashAccessGate đặt / cập nhật / xoá).
// Gửi kèm X-Geo-* trên MỌI lời gọi /shift-cash/* và KiotViet của trang kiểm quầy để BE kiểm geofence.
// Admin, hoặc cửa hàng chưa có toạ độ chi nhánh → null → không gửi header.
// ======================================================================

let currentGeo: ShiftCashGeo | null = null;

export function setShiftCashGeo(geo: ShiftCashGeo | null): void {
  currentGeo = geo;
}

const geoConfig = () => ({ headers: shiftCashGeoHeaders(currentGeo) });

// Blob.text() chưa có trên Safari < 14 (và jsdom) → dùng FileReader.
function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

// responseType 'blob' → body lỗi (vd. 403 { error, message }) cũng là Blob: đọc ra JSON để hiện đúng thông điệp.
async function blobErrorBody(err: unknown): Promise<unknown> {
  if (typeof Blob === 'undefined' || !(err instanceof Blob)) return err;
  try {
    return JSON.parse(await readBlobText(err));
  } catch {
    return err;
  }
}

// ======================================================================
// Summary
// ======================================================================

export async function getShiftCashSummary(date: string): Promise<IShiftCashSummary> {
  const res = await axios.get(endpoints.shiftCash.summary, { params: { date }, ...geoConfig() });
  return res.data;
}

// ======================================================================
// Transactions (Thu/Chi)
// ======================================================================

export async function getShiftCashTransactions(
  date: string,
  toDate?: string
): Promise<IShiftCashTransaction[]> {
  const res = await axios.get(endpoints.shiftCash.transactions, {
    params: { date, toDate },
    ...geoConfig(),
  });
  return res.data;
}

export async function addShiftCashTransaction(
  data: IAddShiftCashTransactionRequest
): Promise<{ id: string }> {
  const res = await axios.post(endpoints.shiftCash.transactions, data, geoConfig());
  return res.data;
}

export async function updateShiftCashTransaction(
  id: string,
  data: IUpdateShiftCashTransactionRequest
): Promise<void> {
  await axios.put(endpoints.shiftCash.transactionDetail(id), data, geoConfig());
}

export async function deleteShiftCashTransaction(id: string): Promise<void> {
  await axios.delete(endpoints.shiftCash.transactionDetail(id), geoConfig());
}

// ======================================================================
// Denominations (Mệnh giá)
// ======================================================================

export async function getShiftCashDenominations(date: string): Promise<IShiftCashDenomination[]> {
  const res = await axios.get(endpoints.shiftCash.denominations, {
    params: { date },
    ...geoConfig(),
  });
  return res.data;
}

export async function updateDenomination(data: IUpdateDenominationRequest): Promise<void> {
  await axios.put(endpoints.shiftCash.denominations, data, geoConfig());
}

export async function updateDenominationBatch(data: IUpdateDenominationBatchRequest): Promise<void> {
  await axios.put(endpoints.shiftCash.denominationsBatch, data, geoConfig());
}

export async function finalizeShiftCash(data: {
  date: string;
  items: { denomination: number; quantity: number }[];
}): Promise<{ id: string; closingBalance: number; isFinalized: boolean }> {
  const res = await axios.post(endpoints.shiftCash.finalize, data, geoConfig());
  return res.data;
}

export async function openCounter(date: string): Promise<void> {
  await axios.post(endpoints.shiftCash.open, { date }, geoConfig());
}

// ======================================================================
// Logs (Nhật ký chỉnh sửa)
// ======================================================================

export async function getShiftCashLogs(date: string): Promise<IShiftCashLog[]> {
  const res = await axios.get(endpoints.shiftCash.logs, { params: { date }, ...geoConfig() });
  return res.data;
}

export async function getShiftCashAuditLogs(
  date: string,
  limit = 200
): Promise<IAuditLogEntry[]> {
  const res = await axios.get(endpoints.shiftCash.auditLogs, {
    params: { date, limit },
    ...geoConfig(),
  });
  return res.data;
}

// ======================================================================
// KiotViet
// ======================================================================

export async function getKiotVietDailySummary(date: string): Promise<IKiotVietDailySummary> {
  const res = await axios.get(endpoints.kiotViet.dailySummary, {
    params: { date },
    ...geoConfig(),
  });
  return res.data;
}

export async function getKiotVietInvoiceDetail(
  id: number
): Promise<IKiotVietInvoiceDetailResponse> {
  const res = await axios.get(endpoints.kiotViet.invoiceDetail(id), geoConfig());
  return res.data;
}

export async function getKiotVietBankAccounts(): Promise<IKiotVietBankAccount[]> {
  const res = await axios.get(endpoints.kiotViet.bankAccounts, geoConfig());
  return res.data;
}

export async function exportKiotVietExcel(date: string): Promise<void> {
  let res;
  try {
    res = await axios.get(endpoints.kiotViet.exportExcel, {
      params: { date },
      responseType: 'blob',
      ...geoConfig(),
    });
  } catch (err) {
    throw await blobErrorBody(err);
  }
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `KiotViet_${date}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function getVietQRBanks(): Promise<IVietQRBank[]> {
  const res = await fetch('https://api.vietqr.io/v2/banks');
  const json = await res.json();
  if (json.code === '00') return json.data;
  return [];
}
