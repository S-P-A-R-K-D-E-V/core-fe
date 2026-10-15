import axios, { endpoints } from 'src/utils/axios';

import type {
  IBankTxn,
  IPagedItems,
  IBankTxnQuery,
  IPaymentIntentQuery,
  IPaymentIntentSummary,
  IReconciliationSummary,
} from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Đối soát thanh toán (Admin, Manager): giao dịch ngân hàng / cổng, khớp tay, bỏ qua, tổng hợp.
// ----------------------------------------------------------------------

export async function getReconciliationSummary(params: { from?: string; to?: string }): Promise<IReconciliationSummary> {
  const res = await axios.get<IReconciliationSummary>(endpoints.paymentReconciliation.summary, { params });
  return res.data;
}

export async function getBankTransactions(params: IBankTxnQuery): Promise<IPagedItems<IBankTxn>> {
  const res = await axios.get<IPagedItems<IBankTxn>>(endpoints.paymentReconciliation.transactions, { params });
  return res.data;
}

export async function getReconciliationIntents(params: IPaymentIntentQuery): Promise<IPagedItems<IPaymentIntentSummary>> {
  const res = await axios.get<IPagedItems<IPaymentIntentSummary>>(endpoints.paymentReconciliation.intents, { params });
  return res.data;
}

export async function matchBankTransaction(id: string, intentId: string): Promise<IBankTxn> {
  const res = await axios.post<IBankTxn>(endpoints.paymentReconciliation.match(id), { intentId });
  return res.data;
}

export async function ignoreBankTransaction(id: string, reason: string): Promise<IBankTxn> {
  const res = await axios.post<IBankTxn>(endpoints.paymentReconciliation.ignore(id), { reason });
  return res.data;
}
