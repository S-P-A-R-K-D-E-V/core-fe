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
  /** Ảnh sản phẩm gắn với dòng — id trong `productImages`, url đã ký (ghép getStorageUrl). */
  imageId?: string | null;
  imageUrl?: string | null;
  /** Hàng chưa có trong danh mục: tên mã mới (mã được tạo khi tạo phiếu nhập). */
  newProductName?: string | null;
  newProductSalePrice?: number | null;
}

/** Ảnh của lần nhập: `id` dùng để gắn vào dòng, `url` đã ký (ghép getStorageUrl). */
export interface IPurchaseImportImage {
  id: string;
  url: string;
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
  /** Ảnh chụp món hàng (không phải tờ hoá đơn) — tách khi đọc hoặc gửi thêm khi trao đổi với trợ lý. */
  productImages?: IPurchaseImportImage[];
  /** Số tin đã trao đổi với trợ lý về lần nhập này. */
  conversationCount?: number;
}

/** Một tin trao đổi với trợ lý về lần nhập. */
export interface IPurchaseImportMessage {
  role: 'user' | 'assistant';
  /** Markdown nhẹ (trợ lý: đã kèm thay đổi đã áp, kết quả đối chiếu). */
  text: string;
  images: IPurchaseImportImage[];
  changes: string[];
  at: string;
}

/** Phiếu nhập cũ của cùng NCC giống hoá đơn đang duyệt. */
export interface IPurchaseImportDuplicate {
  purchaseOrderId: string;
  orderNumber: string;
  date: string;
  total: number;
  status: string;
  matchedLines: number;
  importLines: number;
  totalMatches: boolean;
}

/** NCC đã có giống tên / SĐT in trên hoá đơn. */
export interface IPurchaseImportSupplierCandidate {
  id: string;
  code?: string | null;
  name: string;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  /** 0–1: trùng SĐT 1, trùng tên 0,9, tên gần giống 0,6, chung chữ 0,4. */
  score: number;
  reason: string;
}

export interface IPurchaseImportSupplierSuggestions {
  candidates: IPurchaseImportSupplierCandidate[];
  /** NCC in trên hoá đơn — điền sẵn khi tạo NCC mới. */
  invoice?: { name?: string | null; phones: string[]; address?: string | null } | null;
}

/** Mã mới cho một dòng đã tích "tạo mã mới". */
export interface IPurchaseImportNewProduct {
  lineNo: number;
  name: string;
  salePrice: number;
  /** Trống → danh mục hay gặp của các mã gợi ý trên hoá đơn. */
  categoryId?: string | null;
  unit?: string | null;
}

export interface ICreatePurchaseImportProductsResponse {
  results: { lineNo: number; productId?: string | null; code?: string | null; error?: string | null }[];
  import: IPurchaseImport;
}

export interface IPurchaseImportAssistResponse {
  reply: string;
  changes: string[];
  /** Số dòng vừa đổi — đánh dấu trên màn hình. */
  changedLines: number[];
  /** Lần nhập đang đọc lại ảnh — hỏi lại tới khi hết Extracting. */
  rereading: boolean;
  duplicates: IPurchaseImportDuplicate[];
  import: IPurchaseImport;
  conversation: IPurchaseImportMessage[];
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
  /** Gắn ảnh sản phẩm của lần nhập vào dòng (id trong `productImages`); chuỗi rỗng = gỡ. */
  imageId?: string | null;
  /** Đặt tên mã mới cho dòng (tạo khi tạo phiếu nhập); chuỗi rỗng = bỏ. */
  newProductName?: string | null;
  newProductSalePrice?: number | null;
}
