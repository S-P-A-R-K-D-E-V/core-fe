import axios, { endpoints } from 'src/utils/axios';
import {
  IShiftCashSummary,
  IShiftCashTransaction,
  IShiftCashDenomination,
  IShiftCashLog,
  IAddShiftCashTransactionRequest,
  IUpdateShiftCashTransactionRequest,
  IUpdateDenominationRequest,
  IUpdateDenominationBatchRequest,
  IKiotVietDailySummary,
  IKiotVietInvoiceDetailResponse,
  IKiotVietBankAccount,
  IVietQRBank,
} from 'src/types/corecms-api';

// ======================================================================
// Summary
// ======================================================================

export async function getShiftCashSummary(date: string): Promise<IShiftCashSummary> {
  const res = await axios.get(endpoints.shiftCash.summary, { params: { date } });
  return res.data;
}

// ======================================================================
// Transactions (Thu/Chi)
// ======================================================================

export async function getShiftCashTransactions(date: string): Promise<IShiftCashTransaction[]> {
  const res = await axios.get(endpoints.shiftCash.transactions, { params: { date } });
  return res.data;
}

export async function addShiftCashTransaction(
  data: IAddShiftCashTransactionRequest
): Promise<{ id: string }> {
  const res = await axios.post(endpoints.shiftCash.transactions, data);
  return res.data;
}

export async function updateShiftCashTransaction(
  id: string,
  data: IUpdateShiftCashTransactionRequest
): Promise<void> {
  await axios.put(endpoints.shiftCash.transactionDetail(id), data);
}

export async function deleteShiftCashTransaction(id: string): Promise<void> {
  await axios.delete(endpoints.shiftCash.transactionDetail(id));
}

// ======================================================================
// Denominations (Mệnh giá)
// ======================================================================

export async function getShiftCashDenominations(date: string): Promise<IShiftCashDenomination[]> {
  const res = await axios.get(endpoints.shiftCash.denominations, { params: { date } });
  return res.data;
}

export async function updateDenomination(data: IUpdateDenominationRequest): Promise<void> {
  await axios.put(endpoints.shiftCash.denominations, data);
}

export async function updateDenominationBatch(data: IUpdateDenominationBatchRequest): Promise<void> {
  await axios.put(endpoints.shiftCash.denominationsBatch, data);
}

export async function finalizeShiftCash(data: {
  date: string;
  items: { denomination: number; quantity: number }[];
}): Promise<{ id: string; closingBalance: number; isFinalized: boolean }> {
  const res = await axios.post(endpoints.shiftCash.finalize, data);
  return res.data;
}

export async function openCounter(date: string): Promise<void> {
  await axios.post(endpoints.shiftCash.open, { date });
}

// ======================================================================
// Logs (Nhật ký chỉnh sửa)
// ======================================================================

export async function getShiftCashLogs(date: string): Promise<IShiftCashLog[]> {
  const res = await axios.get(endpoints.shiftCash.logs, { params: { date } });
  return res.data;
}

// ======================================================================
// KiotViet
// ======================================================================

export async function getKiotVietDailySummary(date: string): Promise<IKiotVietDailySummary> {
  const res = await axios.get(endpoints.kiotViet.dailySummary, { params: { date } });
  return res.data;
}

export async function getKiotVietInvoiceDetail(
  id: number
): Promise<IKiotVietInvoiceDetailResponse> {
  const res = await axios.get(endpoints.kiotViet.invoiceDetail(id));
  return res.data;
}

export async function getKiotVietBankAccounts(): Promise<IKiotVietBankAccount[]> {
  const res = await axios.get(endpoints.kiotViet.bankAccounts);
  return res.data;
}

export async function getVietQRBanks(): Promise<IVietQRBank[]> {
  const res = await fetch('https://api.vietqr.io/v2/banks');
  const json = await res.json();
  if (json.code === '00') return json.data;
  return [];
}
