// Nhập phiếu từ ảnh hoá đơn NCC — khớp Core-be CoreCms.Contracts/Purchasing/PurchaseImportContracts.cs.

export type PurchaseImportStatus = 'Extracting' | 'NeedsReview' | 'Committed' | 'Failed' | 'Cancelled';

export type PurchaseImportLineStatus = 'Matched' | 'Suggested' | 'Unknown' | 'Resolved' | 'Skipped';

export interface IPurchaseImportCapabilities {
  enabled: boolean;
  maxImages: number;
  maxImageBytes: number;
  imageTypes: string[];
}

export interface IPurchaseImportCandidate {
  productId: string;
  code: string;
  name: string;
  /** 0–1: ≥ 0,85 tự khớp, 0,5–0,85 gợi ý. */
  score: number;
  reason: string;
  lastUnitPrice?: number | null;
}

export interface IPurchaseImportLine {
  lineNo: number;
  /** Dòng y như viết trên hoá đơn. */
  rawText: string;
  name?: string | null;
  sameAsAbove: boolean;
  unitText?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
  confidence?: number | null;
  status: PurchaseImportLineStatus;
  /** number_mismatch, number_corrected, ambiguous_reading, missing_numbers, unit_converted */
  issues: string[];
  candidates: IPurchaseImportCandidate[];
  suggestedProductId?: string | null;
  productId?: string | null;
  resolution: string;
}

export interface IPurchaseImport {
  id: string;
  status: PurchaseImportStatus;
  source: string;
  /** Đường dẫn ảnh đã ký — ghép getStorageUrl. */
  images: string[];
  supplierId?: string | null;
  supplierName?: string | null;
  supplierText?: string | null;
  supplierPhone?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  invoiceTotal?: number | null;
  linesTotal: number;
  userHints?: string | null;
  warnings: string[];
  error?: string | null;
  purchaseOrderId?: string | null;
  purchaseOrderNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  lines: IPurchaseImportLine[];
}

export interface IPurchaseImportSummary {
  id: string;
  status: PurchaseImportStatus;
  thumbnail?: string | null;
  supplierText?: string | null;
  invoiceNumber?: string | null;
  invoiceTotal?: number | null;
  lineCount: number;
  pendingLines: number;
  purchaseOrderId?: string | null;
  createdAt: string;
}

export interface IUpdatePurchaseImportRequest {
  supplierId?: string | null;
  warehouseId?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  invoiceTotal?: number | null;
}

export interface IUpdatePurchaseImportLineRequest {
  productId?: string | null;
  /** Mã vừa tạo mới cho dòng này (để hệ thống học). */
  created?: boolean;
  skip?: boolean | null;
  quantity?: number | null;
  unitPrice?: number | null;
  lineTotal?: number | null;
}
