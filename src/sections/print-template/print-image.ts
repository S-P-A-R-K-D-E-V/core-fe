// ----------------------------------------------------------------------
// Ảnh trong mẫu in (hoá đơn, tem). Chỉ dùng ảnh của chính cửa hàng — ảnh tải lên print-templates/ và logo, phục vụ qua
// https://<tên miền cửa hàng>/media/… (cùng origin với trang in, in được ngay). core-be lọc cùng quy tắc khi lưu
// (PrintTemplateHtmlService.IsStoreMedia); web kiểm lại khi dựng trang in. Không React / DOM / mạng — dùng được ở mọi nơi
// (tải ảnh lên: print-image-upload.ts).
// ----------------------------------------------------------------------

export const TEMPLATE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const IMAGE_WIDTH_RANGE = { min: 5, max: 100 };

const STORE_MEDIA = /^https:\/\/[a-z0-9.-]+(?::\d+)?\/media\/[\w\-./%]+$/i;

/** src là ảnh của cửa hàng: https://<tên miền>/media/… hoặc /media/… (không "..", không "//"). */
export function isSafeImageSrc(src: string | null | undefined): boolean {
  const value = (src ?? '').trim();
  if (!value || value.includes('..')) return false;
  if (value.startsWith('/media/')) return /^\/media\/[\w\-./%]+$/.test(value);
  return STORE_MEDIA.test(value);
}

/** Logo do core-be trả (Cài đặt cửa hàng): https tuyệt đối hoặc đường dẫn cùng tên miền (không "//"). */
export function isSafeLogoSrc(src: string | null | undefined): boolean {
  const value = (src ?? '').trim();
  if (!value || value.includes('..')) return false;
  if (value.startsWith('/')) return !value.startsWith('//') && /^\/[\w\-./%]+$/.test(value);
  return isSafeImageSrc(value) || /^https:\/\/[a-z0-9.-]+(?::\d+)?\/[\w\-./%]+$/i.test(value);
}

/** "40%" → 40 (5–100); khác → null. */
export function parseImageWidth(value: string | null | undefined): number | null {
  const match = /^(\d{1,3}(?:\.\d+)?)%$/.exec((value ?? '').trim());
  if (!match) return null;
  const width = Math.round(Number(match[1]));
  return width >= IMAGE_WIDTH_RANGE.min && width <= IMAGE_WIDTH_RANGE.max ? width : null;
}

/** Các file ảnh trong một lần kéo thả / dán. */
export function imageFilesOf(data: DataTransfer | null | undefined): File[] {
  return Array.from(data?.files ?? []).filter((file) => TEMPLATE_IMAGE_TYPES.includes(file.type));
}
