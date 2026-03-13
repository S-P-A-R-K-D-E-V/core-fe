import axios, { endpoints } from 'src/utils/axios';
import {
  IDashboardSummary,
  IRevenueReport,
  IProductSalesReport,
  ICustomerReport,
  IInventoryReport,
  IPaymentMethodReport,
  IBarcodeLookup,
} from 'src/types/corecms-api';

export async function getDashboardSummary(): Promise<IDashboardSummary> {
  const response = await axios.get<IDashboardSummary>(endpoints.reports.dashboard);
  return response.data;
}

export async function getRevenueReport(params: {
  fromDate: string;
  toDate: string;
  groupBy?: string;
}): Promise<IRevenueReport> {
  const response = await axios.get<IRevenueReport>(endpoints.reports.revenue, { params });
  return response.data;
}

export async function getProductSalesReport(params: {
  fromDate: string;
  toDate: string;
}): Promise<IProductSalesReport[]> {
  const response = await axios.get<IProductSalesReport[]>(endpoints.reports.productSales, { params });
  return response.data;
}

export async function getCustomerReport(params: {
  fromDate: string;
  toDate: string;
}): Promise<ICustomerReport[]> {
  const response = await axios.get<ICustomerReport[]>(endpoints.reports.customers, { params });
  return response.data;
}

export async function getInventoryReport(params?: {
  warehouseId?: string;
  lowStockOnly?: boolean;
}): Promise<IInventoryReport[]> {
  const response = await axios.get<IInventoryReport[]>(endpoints.reports.inventory, { params });
  return response.data;
}

export async function getPaymentMethodReport(params: {
  fromDate: string;
  toDate: string;
}): Promise<IPaymentMethodReport[]> {
  const response = await axios.get<IPaymentMethodReport[]>(endpoints.reports.paymentMethods, { params });
  return response.data;
}

export async function lookupBarcode(
  barcode: string,
  warehouseId?: string
): Promise<IBarcodeLookup> {
  const response = await axios.get<IBarcodeLookup>(endpoints.reports.barcodeLookup(barcode), {
    params: warehouseId ? { warehouseId } : undefined,
  });
  return response.data;
}

export function getExportUrl(
  type: 'revenue' | 'product-sales' | 'customers' | 'inventory' | 'sales-orders',
  params?: Record<string, string>
): string {
  const baseUrls: Record<string, string> = {
    revenue: endpoints.reports.revenueExport,
    'product-sales': endpoints.reports.productSalesExport,
    customers: endpoints.reports.customersExport,
    inventory: endpoints.reports.inventoryExport,
    'sales-orders': endpoints.reports.salesOrdersExport,
  };

  const url = baseUrls[type];
  if (!params) return url;

  const searchParams = new URLSearchParams(params);
  return `${url}?${searchParams.toString()}`;
}

export async function downloadExport(
  type: 'revenue' | 'product-sales' | 'customers' | 'inventory' | 'sales-orders',
  params?: Record<string, string>
): Promise<void> {
  const url = getExportUrl(type, params);
  const response = await axios.get(url, { responseType: 'blob' });

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;

  const contentDisposition = response.headers['content-disposition'];
  const filename = contentDisposition
    ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
    : `${type}-report.xlsx`;

  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
