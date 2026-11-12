// ----------------------------------------------------------------------
// Chuỗi mã QR chuyển khoản VietQR (NAPAS 247, EMVCo Merchant-Presented Mode) dựng ngay trong trình duyệt — dùng khi mất
// mạng (không tạo được QR qua máy chủ). Chép đúng VietQrPayload.cs của core-be (cùng bộ ca kiểm thử):
//   00 = "01"; 01 = "12" có số tiền / "11" không; 38 = { 00 = A000000727, 01 = { 00 = BIN, 01 = số TK }, 02 = QRIBFTTA };
//   53 = "704"; 54 = số tiền; 58 = "VN"; 62 = { 08 = nội dung }; 63 = CRC-16/CCITT-FALSE của chuỗi tới hết "6304".
// ----------------------------------------------------------------------

const NAPAS_GUID = 'A000000727';
const TRANSFER_TO_ACCOUNT = 'QRIBFTTA';
const MAX_ACCOUNT_NUMBER_LENGTH = 19;
const MAX_AMOUNT = 9_999_999_999_999;
export const MAX_TRANSFER_CONTENT_LENGTH = 25;

const isAsciiLetterOrDigit = (c: string) => /^[A-Za-z0-9]$/.test(c);

function field(id: string, value: string): string {
  if (value.length === 0 || value.length > 99) throw new Error(`Trường ${id} của mã QR phải dài 1–99 ký tự.`);
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC-16/CCITT-FALSE (đa thức 0x1021, khởi tạo 0xFFFF) — 4 chữ số hex in hoa, tính trên byte UTF-8. */
export function crc16(text: string): string {
  let crc = 0xffff;
  new TextEncoder().encode(text).forEach((byte) => {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  });
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function cleanBin(bin: string | null | undefined): string | null {
  const trimmed = (bin ?? '').trim();
  return /^\d{6}$/.test(trimmed) ? trimmed : null;
}

export function cleanAccountNumber(accountNumber: string | null | undefined): string | null {
  if (accountNumber == null) return null;
  const cleaned = accountNumber.replace(/[\s.-]/g, '');
  return cleaned.length > 0 && cleaned.length <= MAX_ACCOUNT_NUMBER_LENGTH && /^[A-Za-z0-9]+$/.test(cleaned)
    ? cleaned
    : null;
}

/** Nội dung chuyển khoản ngân hàng nào cũng nhận: bỏ dấu (đ → d), chỉ chữ / số ASCII, ký tự khác thành 1 khoảng trắng. */
export function normalizeTransferContent(raw: string | null | undefined, maxLength = MAX_TRANSFER_CONTENT_LENGTH): string {
  if (!raw || !raw.trim()) return '';
  const decomposed = raw.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD');
  let text = '';
  let gap = false;
  Array.from(decomposed).forEach((c) => {
    if (/\p{Mn}/u.test(c)) return; // dấu thanh / mũ tách ra sau NFD
    if (!isAsciiLetterOrDigit(c)) {
      gap = true;
      return;
    }
    if (gap && text.length > 0) text += ' ';
    gap = false;
    text += c;
  });
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text;
}

/** @throws Error khi BIN / số tài khoản / số tiền không dùng được. */
export function buildVietQrPayload(
  bin: string | null | undefined,
  accountNumber: string | null | undefined,
  amount?: number | null,
  content?: string | null
): string {
  const b = cleanBin(bin);
  if (!b) throw new Error('BIN ngân hàng phải gồm đúng 6 chữ số.');
  const account = cleanAccountNumber(accountNumber);
  if (!account) throw new Error(`Số tài khoản phải gồm chữ hoặc số, tối đa ${MAX_ACCOUNT_NUMBER_LENGTH} ký tự.`);
  const hasAmount = amount != null;
  if (hasAmount && (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT)) {
    throw new Error('Số tiền phải là số nguyên từ 1 đến 13 chữ số.');
  }

  const merchantAccount =
    field('00', NAPAS_GUID) + field('01', field('00', b) + field('01', account)) + field('02', TRANSFER_TO_ACCOUNT);
  let payload = field('00', '01') + field('01', hasAmount ? '12' : '11') + field('38', merchantAccount) + field('53', '704');
  if (hasAmount) payload += field('54', String(amount));
  payload += field('58', 'VN');
  const purpose = normalizeTransferContent(content);
  if (purpose) payload += field('62', field('08', purpose));
  payload += '6304';
  return payload + crc16(payload);
}
