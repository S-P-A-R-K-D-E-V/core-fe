import imageCompression from 'browser-image-compression';

import { uploadPrintTemplateImage } from 'src/api/print-templates';

import { TEMPLATE_IMAGE_TYPES } from './print-image';

// ----------------------------------------------------------------------
// Tải ảnh lên để chèn vào mẫu in: nén trước (giữ định dạng — PNG giữ nền trong suốt) rồi gửi POST
// /print-templates/images; core-be trả https://<tên miền>/media/print-templates/….
// ----------------------------------------------------------------------

/** Ảnh trên tem / phiếu nhỏ: 1000 px là dư cho giấy 80 mm ở 203 dpi (576 điểm) và đủ nét cho A5. */
const COMPRESSION = { maxSizeMB: 0.3, maxWidthOrHeight: 1000, useWebWorker: true };

/** Lỗi → ném Error có câu tiếng Việt (loại file sai) hoặc lỗi của API. */
export async function uploadTemplateImage(file: File): Promise<string> {
  if (!TEMPLATE_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Chỉ chèn được ảnh PNG, JPEG hoặc WebP.');
  }
  let blob: Blob = file;
  try {
    blob = await imageCompression(file, { ...COMPRESSION, fileType: file.type });
  } catch {
    blob = file;
  }
  return uploadPrintTemplateImage(blob, file.name || 'anh');
}
