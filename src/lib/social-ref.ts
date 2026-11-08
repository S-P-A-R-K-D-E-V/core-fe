// ----------------------------------------------------------------------
// Mã nguồn bài đăng mạng xã hội (Bán hàng online). Link trong bài Threads trỏ về cửa hàng mang "?r=<mã 8 ký tự>"; shop nhớ
// mã gần nhất 30 ngày trong trình duyệt và gửi kèm khi đặt đơn online → core-be tính doanh thu theo bài / kênh.
// Chỉ lưu mã (không có dữ liệu cá nhân). Trình duyệt chặn lưu trữ thì bỏ qua, đặt đơn vẫn bình thường.
// ----------------------------------------------------------------------

export const SOCIAL_REF_PARAM = 'r';
export const SOCIAL_REF_STORAGE_KEY = 'spark-social-ref';
export const SOCIAL_REF_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CODE = /^[abcdefghijkmnpqrstuvwxyz23456789]{8}$/;

export function normalizeSocialRef(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase() ?? '';
  return CODE.test(v) ? v : null;
}

/** Đọc ?r= trong địa chỉ hiện tại và nhớ lại (lần bấm sau cùng thắng). */
export function captureSocialRef(search: string, now = Date.now()): string | null {
  const code = normalizeSocialRef(new URLSearchParams(search).get(SOCIAL_REF_PARAM));
  if (!code) return null;
  try {
    window.localStorage.setItem(SOCIAL_REF_STORAGE_KEY, JSON.stringify({ code, at: now }));
  } catch {
    // Không lưu được (chế độ riêng tư…) — bỏ qua.
  }
  return code;
}

/** Mã còn hạn 30 ngày, hoặc null. */
export function readSocialRef(now = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(SOCIAL_REF_STORAGE_KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number };
    if (typeof at !== 'number' || now - at > SOCIAL_REF_TTL_MS) return null;
    return normalizeSocialRef(code);
  } catch {
    return null;
  }
}
