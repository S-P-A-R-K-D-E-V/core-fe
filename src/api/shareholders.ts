import axios, { endpoints } from 'src/utils/axios';
import {
  IShareholder,
  IShareholderDetail,
  IRevenueChannel,
  ICapitalTransaction,
  IPagedCapitalTransactions,
  IShareholderStatement,
  CapitalTransactionType,
  ISettlementPreview,
  ISettlementListItem,
  ISettlementDetail,
} from 'src/types/corecms-api';

// ========== Shareholder ==========

export async function getShareholders(isActive?: boolean): Promise<IShareholder[]> {
  const response = await axios.get<IShareholder[]>(endpoints.shareholders.list, {
    params: isActive !== undefined ? { isActive } : undefined,
  });
  return response.data;
}

export async function getShareholderById(id: string): Promise<IShareholderDetail> {
  const response = await axios.get<IShareholderDetail>(endpoints.shareholders.details(id));
  return response.data;
}

export async function createShareholder(data: {
  name: string;
  equityPercent: number;
  userId?: string | null;
  note?: string | null;
}): Promise<{ id: string }> {
  const response = await axios.post(endpoints.shareholders.create, data);
  return response.data;
}

export async function updateShareholder(
  id: string,
  data: {
    name: string;
    equityPercent: number;
    userId?: string | null;
    isActive: boolean;
    note?: string | null;
  }
): Promise<void> {
  await axios.put(endpoints.shareholders.update(id), data);
}

export async function deleteShareholder(id: string): Promise<void> {
  await axios.delete(endpoints.shareholders.delete(id));
}

// ========== Revenue Channel (kênh thu tiền) ==========

export async function getRevenueChannels(isActive?: boolean): Promise<IRevenueChannel[]> {
  const response = await axios.get<IRevenueChannel[]>(endpoints.shareholders.channels, {
    params: isActive !== undefined ? { isActive } : undefined,
  });
  return response.data;
}

/** Method thực tế đã ghi nhận trong thanh toán (KiotViet trả tự do, không phải enum cố định) */
export async function getKnownPaymentMethods(): Promise<string[]> {
  const response = await axios.get<string[]>(endpoints.shareholders.knownPaymentMethods);
  return response.data;
}

export async function createRevenueChannel(data: {
  paymentMethod: string;
  bankAccountId?: string | null;
  shareholderId: string;
  effectiveFrom: string;
}): Promise<{ id: string }> {
  const response = await axios.post(endpoints.shareholders.createChannel, data);
  return response.data;
}

export async function updateRevenueChannel(
  id: string,
  data: {
    paymentMethod: string;
    bankAccountId?: string | null;
    shareholderId: string;
    effectiveFrom: string;
    isActive: boolean;
  }
): Promise<void> {
  await axios.put(endpoints.shareholders.updateChannel(id), data);
}

export async function deleteRevenueChannel(id: string): Promise<void> {
  await axios.delete(endpoints.shareholders.deleteChannel(id));
}

// ========== Capital Transaction (sổ giao dịch vốn) ==========

export async function getCapitalTransactions(params: {
  fromDate?: string;
  toDate?: string;
  shareholderId?: string;
  type?: CapitalTransactionType;
  pageNumber?: number;
  pageSize?: number;
}): Promise<IPagedCapitalTransactions> {
  const response = await axios.get<IPagedCapitalTransactions>(
    endpoints.shareholders.transactions,
    { params }
  );
  return response.data;
}

export async function createCapitalTransaction(data: {
  shareholderId: string;
  type: CapitalTransactionType;
  amount: number;
  transactionDate: string;
  counterpartyShareholderId?: string | null;
  refExpenseId?: string | null;
  refPurchaseOrderId?: string | null;
  note?: string | null;
}): Promise<{ id: string }> {
  const response = await axios.post(endpoints.shareholders.createTransaction, data);
  return response.data;
}

export async function updateCapitalTransaction(
  id: string,
  data: {
    shareholderId: string;
    type: CapitalTransactionType;
    amount: number;
    transactionDate: string;
    counterpartyShareholderId?: string | null;
    note?: string | null;
  }
): Promise<void> {
  await axios.put(endpoints.shareholders.updateTransaction(id), data);
}

export async function deleteCapitalTransaction(id: string): Promise<void> {
  await axios.delete(endpoints.shareholders.deleteTransaction(id));
}

// ========== Statement (sao kê) ==========

export async function getShareholderStatement(
  id: string,
  params: { fromDate: string; toDate: string }
): Promise<IShareholderStatement> {
  const response = await axios.get<IShareholderStatement>(
    endpoints.shareholders.statement(id),
    { params }
  );
  return response.data;
}

// ========== Settlement (chốt sổ) ==========

export async function getSettlementPreview(params: {
  fromDate: string;
  toDate: string;
  reserveAmount?: number;
}): Promise<ISettlementPreview> {
  const response = await axios.get<ISettlementPreview>(endpoints.shareholders.settlementPreview, {
    params,
  });
  return response.data;
}

export async function getSettlements(): Promise<ISettlementListItem[]> {
  const response = await axios.get<ISettlementListItem[]>(endpoints.shareholders.settlements);
  return response.data;
}

export async function getSettlementById(id: string): Promise<ISettlementDetail> {
  const response = await axios.get<ISettlementDetail>(endpoints.shareholders.settlementDetails(id));
  return response.data;
}

export async function closeSettlement(data: {
  name: string;
  fromDate: string;
  toDate: string;
  reserveAmount: number;
  note?: string | null;
}): Promise<{ id: string }> {
  const response = await axios.post(endpoints.shareholders.settlements, data);
  return response.data;
}

export async function markTransferPaid(transferId: string): Promise<{ paidTransactionId: string }> {
  const response = await axios.post(endpoints.shareholders.markTransferPaid(transferId));
  return response.data;
}

export type { ICapitalTransaction };
