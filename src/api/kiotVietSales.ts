import axios, { endpoints } from 'src/utils/axios';

import {
  IKiotVietSalesQueryParams,
  IKiotVietSalesQueryResponse,
} from 'src/types/corecms-api';

// ======================================================================
// KiotViet Sales Query (Admin)
// ======================================================================

function buildParams(p: IKiotVietSalesQueryParams): Record<string, string | number> {
  const params: Record<string, string | number> = {
    fromDate: p.fromDate,
    toDate: p.toDate,
  };
  if (p.code && p.code.trim()) params.code = p.code.trim();
  if (p.paymentMethod) params.paymentMethod = p.paymentMethod;
  if (p.bankAccountId != null) params.bankAccountId = p.bankAccountId;
  return params;
}

export async function queryKiotVietSales(
  p: IKiotVietSalesQueryParams
): Promise<IKiotVietSalesQueryResponse> {
  const res = await axios.get(endpoints.kiotViet.salesQuery, { params: buildParams(p) });
  return res.data;
}

export async function exportKiotVietSalesExcel(p: IKiotVietSalesQueryParams): Promise<void> {
  const res = await axios.get(endpoints.kiotViet.salesExportExcel, {
    params: buildParams(p),
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `KiotViet_Sales_${p.fromDate}_${p.toDate}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
