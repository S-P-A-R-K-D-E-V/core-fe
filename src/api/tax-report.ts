import axios, { endpoints } from 'src/utils/axios';
import { TaxReportQuery, TaxReportResult } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getTaxReport(query: TaxReportQuery): Promise<TaxReportResult> {
  const params: Record<string, string | number> = {
    month: query.month,
    year: query.year,
  };
  if (query.paymentMethod) params.paymentMethod = query.paymentMethod;
  if (query.bankAccountId !== undefined) params.bankAccountId = query.bankAccountId;

  const response = await axios.get<TaxReportResult>(endpoints.reports.tax, { params });
  return response.data;
}

export async function exportTaxReport(query: TaxReportQuery): Promise<void> {
  const params: Record<string, string | number> = {
    month: query.month,
    year: query.year,
  };
  if (query.paymentMethod) params.paymentMethod = query.paymentMethod;
  if (query.bankAccountId !== undefined) params.bankAccountId = query.bankAccountId;

  const response = await axios.get(endpoints.reports.taxExport, {
    params,
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;

  const contentDisposition = response.headers['content-disposition'];
  const filename = contentDisposition
    ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
    : `bao-cao-thue_${query.year}-${String(query.month).padStart(2, '0')}.xlsx`;

  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
