import type { ISalesOrderReceiptStore, ISalesOrderReceiptBranch } from './corecms-api';

// ----------------------------------------------------------------------
// GET /purchase-orders/{id}/print (core-be GetPurchaseOrderPrintQuery): phiếu nhập để in. Thời gian "…Local" là chuỗi
// dd/MM/yyyy HH:mm theo múi giờ cửa hàng; mọi số tiền đã làm tròn tới đồng.
// ----------------------------------------------------------------------

export interface IPurchaseOrderPrintInfo {
  id: string;
  code: string;
  dateUtc: string;
  dateLocal: string;
  timezone: string;
  supplierName: string | null;
  supplierCode: string | null;
  supplierPhone: string | null;
  supplierAddress: string | null;
  warehouseName: string | null;
  createdByName: string | null;
  note: string | null;
  /** Trạng thái trong DB (Draft, Completed, Returned, Cancelled…). */
  status: string;
  /** Phiếu tạm / Đã nhập hàng / Đã huỷ… */
  statusLabel: string;
  isCancelled: boolean;
}

export interface IPurchaseOrderPrintLine {
  lineNo: number;
  name: string;
  code: string | null;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  /** Thuế suất VAT (%). */
  vatRate: number;
  lineTotal: number;
  note: string | null;
}

export interface IPurchaseOrderPrintTotals {
  subTotal: number;
  discount: number;
  vat: number;
  /** Cần trả nhà cung cấp. */
  total: number;
  paid: number;
  remaining: number;
}

export interface IPurchaseOrderPrint {
  /** Luôn là "PHIẾU NHẬP HÀNG". */
  title: string;
  store: ISalesOrderReceiptStore;
  branch: ISalesOrderReceiptBranch | null;
  purchase: IPurchaseOrderPrintInfo;
  lines: IPurchaseOrderPrintLine[];
  totals: IPurchaseOrderPrintTotals;
  printedAtLocal: string;
}
