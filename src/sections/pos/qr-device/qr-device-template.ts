// ----------------------------------------------------------------------
// Máy hiện QR cắm USB (vd QR01 / QR02 — LCD 2,4"): máy tính gửi lệnh qua cổng COM ảo (Web Serial). Bảng lệnh của từng
// loại máy do hãng quy định và chưa có tài liệu ⇒ lệnh được mô tả bằng MẪU CHỮ, đổi được ngay trên trang "Thử máy QR"
// mà không cần sửa code:
//   {payload}     chuỗi VietQR (EMVCo) — máy tự vẽ mã QR từ chuỗi này
//   {amount}      số tiền, số nguyên (10000)
//   {amountVnd}   số tiền có dấu chấm (10.000)
//   {bank} {account} {accountName} {content}   ngân hàng, số tài khoản, chủ tài khoản, nội dung chuyển khoản
//   \r \n \t \0 \\ \xHH                        ký tự điều khiển / một byte bất kỳ (HH hệ 16)
// Khi có tài liệu giao thức thật (khung có độ dài, mã kiểm tra…), viết thêm một bộ mã hoá riêng thay cho mẫu.
// ----------------------------------------------------------------------

export type QrDeviceInfo = {
  payload: string;
  amount: number;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  content?: string | null;
};

export type QrDeviceTemplates = {
  /** Hiện QR + số tiền. */
  show: string;
  /** Xoá QR, về màn chờ. Rỗng = không gửi gì. */
  clear: string;
  /** Đã nhận tiền. Rỗng = gửi lệnh xoá. */
  paid: string;
};

export type QrDevicePreset = { id: string; label: string; templates: QrDeviceTemplates };

/** Các kiểu lệnh hay gặp ở module hiện QR qua cổng serial — thử lần lượt khi chưa biết máy nhận kiểu nào. */
export const QR_DEVICE_PRESETS: QrDevicePreset[] = [
  { id: 'line-crlf', label: 'Chuỗi QR + xuống dòng (CR LF)', templates: { show: '{payload}\\r\\n', clear: '', paid: '' } },
  { id: 'line-lf', label: 'Chuỗi QR + xuống dòng (LF)', templates: { show: '{payload}\\n', clear: '', paid: '' } },
  { id: 'raw', label: 'Chuỗi QR trơn', templates: { show: '{payload}', clear: '', paid: '' } },
  {
    id: 'pipe-amount',
    label: 'Chuỗi QR | số tiền',
    templates: { show: '{payload}|{amount}\\r\\n', clear: '', paid: '' },
  },
  {
    id: 'json',
    label: 'JSON {qr, amount}',
    templates: {
      show: '{"qr":"{payload}","amount":{amount}}\\n',
      clear: '{"cmd":"clear"}\\n',
      paid: '{"cmd":"paid","amount":{amount}}\\n',
    },
  },
];

export const CUSTOM_PRESET_ID = 'custom';

/** Tốc độ cổng, theo thứ tự hay gặp. */
export const QR_DEVICE_BAUD_RATES = [115200, 9600, 38400, 57600, 19200];

export const findPreset = (id: string | null | undefined) => QR_DEVICE_PRESETS.find((p) => p.id === id) ?? null;

/** Thứ tự thử khi dò: kiểu phổ biến ở 2 tốc độ phổ biến trước, rồi kiểu đầu ở các tốc độ còn lại. */
export function probeCandidates(): { baudRate: number; preset: QrDevicePreset }[] {
  const [first, second, ...rest] = QR_DEVICE_BAUD_RATES;
  const out: { baudRate: number; preset: QrDevicePreset }[] = [];
  QR_DEVICE_PRESETS.forEach((preset) => {
    out.push({ baudRate: first, preset }, { baudRate: second, preset });
  });
  rest.forEach((baudRate) => {
    out.push({ baudRate, preset: QR_DEVICE_PRESETS[0] }, { baudRate, preset: QR_DEVICE_PRESETS[1] });
  });
  return out;
}

const vnd = (amount: number) => Math.round(amount).toLocaleString('vi-VN');

function placeholderValues(info: QrDeviceInfo): Record<string, string> {
  return {
    payload: info.payload,
    amount: String(Math.round(info.amount)),
    amountVnd: vnd(info.amount),
    bank: info.bankName ?? '',
    account: info.accountNumber ?? '',
    accountName: info.accountName ?? '',
    content: info.content ?? '',
  };
}

const ESCAPES: Record<string, number> = { r: 13, n: 10, t: 9, '0': 0, '\\': 92 };

/** Mẫu lệnh → byte gửi xuống máy (chữ mã UTF-8). Placeholder lạ giữ nguyên chữ. */
export function encodeTemplate(template: string, info: QrDeviceInfo | null): Uint8Array {
  const values = info ? placeholderValues(info) : {};
  const encoder = new TextEncoder();
  const bytes: number[] = [];
  let text = '';
  const flush = () => {
    if (text) bytes.push(...encoder.encode(text));
    text = '';
  };

  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === '\\' && i + 1 < template.length) {
      const next = template[i + 1];
      if (next in ESCAPES) {
        flush();
        bytes.push(ESCAPES[next]);
        i += 2;
        continue;
      }
      const hex = /^x([0-9a-fA-F]{2})/.exec(template.slice(i + 1));
      if (hex) {
        flush();
        bytes.push(parseInt(hex[1], 16));
        i += 4;
        continue;
      }
    }
    if (ch === '{') {
      const m = /^\{(\w+)\}/.exec(template.slice(i));
      if (m && m[1] in values) {
        text += values[m[1]];
        i += m[0].length;
        continue;
      }
    }
    text += ch;
    i += 1;
  }
  flush();
  return Uint8Array.from(bytes);
}

/** Byte → "48 65 0D 0A" (nhật ký). */
export const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

/** Byte → chữ đọc được, ký tự điều khiển hiện dạng ‹0D›. */
export function toPrintable(bytes: Uint8Array): string {
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return Array.from(decoded, (c) => {
    const code = c.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? `‹${code.toString(16).toUpperCase().padStart(2, '0')}›` : c;
  }).join('');
}

/** VID/PID USB dạng "1A86:7523" (CH340) — để tra loại chip / hỏi hãng. */
export const usbIdLabel = (vendorId?: number, productId?: number) =>
  vendorId == null
    ? null
    : `${vendorId.toString(16).toUpperCase().padStart(4, '0')}:${(productId ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;

/** Một số chip USB-serial phổ biến (gợi ý cho người cài đặt). */
const USB_VENDORS: Record<number, string> = {
  0x1a86: 'WCH (CH340/CH343)',
  0x10c4: 'Silicon Labs (CP210x)',
  0x0403: 'FTDI',
  0x067b: 'Prolific (PL2303)',
  0x0483: 'STMicroelectronics (STM32)',
  0x303a: 'Espressif (ESP32)',
};

export const usbVendorName = (vendorId?: number) => (vendorId == null ? null : USB_VENDORS[vendorId] ?? null);
