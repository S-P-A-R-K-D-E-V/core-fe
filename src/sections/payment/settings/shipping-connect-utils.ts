// ----------------------------------------------------------------------
// Liên kết shop của hãng vận chuyển bằng SĐT chủ shop + OTP (GHN): kiểm tra ô nhập trước khi gọi máy chủ.
// ----------------------------------------------------------------------

/** "+84 912.345.678" / "0912 345 678" → "0912345678"; không phải SĐT di động 10 số → null. */
export function normalizeVnPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('84')) digits = `0${digits.slice(2)}`;
  return /^0\d{9}$/.test(digits) ? digits : null;
}

/** Mã shop của hãng (GHN ShopId) là số dương. */
export function isShopRef(raw: string): boolean {
  return /^[1-9]\d{0,14}$/.test(raw.trim());
}
