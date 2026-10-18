import imageCompression from 'browser-image-compression';

import axios, { endpoints } from 'src/utils/axios';

import type {
  IPurchaseImport,
  IPurchaseImportSummary,
  IPurchaseImportCapabilities,
  IUpdatePurchaseImportRequest,
  IUpdatePurchaseImportLineRequest,
} from 'src/types/purchase-import';

// ----------------------------------------------------------------------
// Nhập phiếu từ ảnh hoá đơn NCC. Ảnh KHÔNG đi qua API: nén → xin presigned URL → PUT thẳng lên R2 → gửi objectKey.

type PresignedUpload = { objectKey: string; uploadUrl: string; headers: Record<string, string> };

/** Hoá đơn viết tay cần đọc được chữ số nhỏ — nén nhẹ, giữ cạnh dài 2400px. */
const COMPRESSION = { maxSizeMB: 2.5, maxWidthOrHeight: 2400, useWebWorker: true, fileType: 'image/jpeg' } as const;

export async function getPurchaseImportCapabilities(): Promise<IPurchaseImportCapabilities> {
  const response = await axios.get<IPurchaseImportCapabilities>(endpoints.purchaseImports.capabilities);
  return response.data;
}

/** Nén ảnh chụp hoá đơn / ảnh gửi trợ lý (giữ đọc được chữ số nhỏ); lỗi thì gửi nguyên ảnh. */
export async function compressInvoiceImage(file: File): Promise<File> {
  try {
    const blob = await imageCompression(file, COMPRESSION);
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Nén + tải các tờ hoá đơn lên R2, trả objectKey theo đúng thứ tự tờ. */
export async function uploadInvoiceImages(files: File[]): Promise<string[]> {
  const prepared = await Promise.all(files.map(compressInvoiceImage));
  const presign = await axios.post<PresignedUpload[]>(endpoints.purchaseImports.presign, {
    files: prepared.map((f) => ({ fileName: f.name, contentType: f.type, sizeBytes: f.size })),
  });
  await Promise.all(
    presign.data.map(async (p, i) => {
      const put = await fetch(p.uploadUrl, { method: 'PUT', headers: p.headers, body: prepared[i] });
      if (!put.ok) throw new Error(`Tải ảnh lên thất bại (${put.status})`);
    })
  );
  return presign.data.map((p) => p.objectKey);
}

export async function createPurchaseImport(data: {
  objectKeys: string[];
  supplierId?: string | null;
  warehouseId?: string | null;
  hints?: string | null;
}): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.purchaseImports.create, data);
  return response.data;
}

export async function getRecentPurchaseImports(limit = 30): Promise<IPurchaseImportSummary[]> {
  const response = await axios.get<IPurchaseImportSummary[]>(endpoints.purchaseImports.list, { params: { limit } });
  return response.data;
}

export async function getPurchaseImport(id: string): Promise<IPurchaseImport> {
  const response = await axios.get<IPurchaseImport>(endpoints.purchaseImports.details(id));
  return response.data;
}

export async function updatePurchaseImport(id: string, data: IUpdatePurchaseImportRequest): Promise<IPurchaseImport> {
  const response = await axios.patch<IPurchaseImport>(endpoints.purchaseImports.details(id), data);
  return response.data;
}

export async function updatePurchaseImportLine(
  id: string,
  lineNo: number,
  data: IUpdatePurchaseImportLineRequest
): Promise<IPurchaseImport> {
  const response = await axios.patch<IPurchaseImport>(endpoints.purchaseImports.line(id, lineNo), data);
  return response.data;
}

export async function commitPurchaseImport(id: string, allowDuplicate = false): Promise<{ purchaseOrderId: string }> {
  const response = await axios.post<{ purchaseOrderId: string }>(endpoints.purchaseImports.commit(id), { allowDuplicate });
  return response.data;
}

export async function retryPurchaseImport(id: string): Promise<void> {
  await axios.post(endpoints.purchaseImports.retry(id));
}

export async function cancelPurchaseImport(id: string): Promise<void> {
  await axios.post(endpoints.purchaseImports.cancel(id));
}
