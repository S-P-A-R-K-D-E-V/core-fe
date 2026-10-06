// ----------------------------------------------------------------------
// Mã hoá mã vạch cho tem — phần "không giao diện", không phụ thuộc React hay DOM.
//
// Kết quả là MẪU VẠCH dạng chuỗi '1' / '0' (1 = vạch đen, 0 = khoảng trắng), mỗi ký tự là 1 module.
// Việc đổi module ra điểm in của máy in nhiệt nằm ở label-geometry.ts.
//
// Chọn loại mã (chooseSymbology):
//  - đúng 13 chữ số và số kiểm tra hợp lệ         → EAN-13
//  - toàn chữ số, độ dài chẵn                     → Code 128 bộ C (2 chữ số / ký hiệu)
//  - còn lại                                      → Code 128 bắt đầu ở bộ B; tự chuyển sang bộ C cho
//                                                   các đoạn chữ số dài để mã ngắn nhất ("SP000123")
// Giá trị Code 128 không mã hoá được (chữ có dấu, ký tự điều khiển) → lỗi tiếng Việt cho đúng sản phẩm
// đó; KHÔNG bao giờ in ra một mã vạch "gần đúng".
// ----------------------------------------------------------------------

export type BarcodeSymbology = 'EAN13' | 'CODE128B' | 'CODE128C';

export type EncodedBarcode = {
  symbology: BarcodeSymbology;
  /** Đúng chuỗi máy quét sẽ trả về. */
  value: string;
  /** Mẫu vạch '1'/'0', mỗi ký tự 1 module — KHÔNG gồm vùng trắng hai bên. */
  modules: string;
  /** Vùng trắng bắt buộc bên trái / phải, tính bằng module. */
  quietLeft: number;
  quietRight: number;
  /** Chỉ Code 128: dãy giá trị ký hiệu, gồm cả start, checksum và stop. */
  codewords?: number[];
};

export type BarcodeResult = { ok: true; barcode: EncodedBarcode } | { ok: false; error: string };

/** Lỗi có câu tiếng Việt hiện thẳng cho người dùng. */
export class BarcodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BarcodeError';
  }
}

export const SYMBOLOGY_LABEL: Record<BarcodeSymbology, string> = {
  EAN13: 'EAN-13',
  CODE128B: 'Code 128',
  CODE128C: 'Code 128 (số)',
};

// ── EAN-13 ────────────────────────────────────────────────────────────────

// Bảng L (lẻ) của GS1; G = đảo chiều của R, R = phần bù của L.
const EAN_L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];

const EAN_R = EAN_L.map((pattern) =>
  pattern
    .split('')
    .map((bit) => (bit === '1' ? '0' : '1'))
    .join('')
);

const EAN_G = EAN_R.map((pattern) => pattern.split('').reverse().join(''));

// Chữ số đầu tiên không có vạch riêng: nó chọn kiểu L/G của 6 chữ số nửa trái.
const EAN_FIRST_DIGIT_PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

const EAN_GUARD = '101';
const EAN_CENTER = '01010';

// Vùng trắng chuẩn EAN-13: 11 module bên trái (chỗ của chữ số đầu), 7 module bên phải.
export const EAN13_QUIET_LEFT = 11;
export const EAN13_QUIET_RIGHT = 7;

/** Số kiểm tra của 12 chữ số đầu (trọng số 1, 3, 1, 3… tính từ trái). */
export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) {
    throw new BarcodeError('Cần đúng 12 chữ số để tính số kiểm tra EAN-13.');
  }
  const sum = first12
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(value: string): boolean {
  return /^\d{13}$/.test(value) && ean13CheckDigit(value.slice(0, 12)) === Number(value[12]);
}

/** 95 module: 101 + 6 chữ số trái (L/G) + 01010 + 6 chữ số phải (R) + 101. */
export function encodeEan13(value: string): EncodedBarcode {
  if (!/^\d{13}$/.test(value)) {
    throw new BarcodeError('Mã EAN-13 phải có đúng 13 chữ số.');
  }
  if (!isValidEan13(value)) {
    const expected = ean13CheckDigit(value.slice(0, 12));
    throw new BarcodeError(
      `Mã "${value}" sai số kiểm tra EAN-13 (chữ số cuối phải là ${expected}).`
    );
  }

  const digits = value.split('').map(Number);
  const parity = EAN_FIRST_DIGIT_PARITY[digits[0]];

  const left = digits
    .slice(1, 7)
    .map((digit, index) => (parity[index] === 'L' ? EAN_L[digit] : EAN_G[digit]))
    .join('');
  const right = digits
    .slice(7)
    .map((digit) => EAN_R[digit])
    .join('');

  return {
    symbology: 'EAN13',
    value,
    modules: EAN_GUARD + left + EAN_CENTER + right + EAN_GUARD,
    quietLeft: EAN13_QUIET_LEFT,
    quietRight: EAN13_QUIET_RIGHT,
  };
}

// ── Code 128 ──────────────────────────────────────────────────────────────

// Độ rộng vạch-khoảng xen kẽ (bắt đầu bằng vạch) của giá trị 0…105, mỗi ký hiệu 11 module;
// 106 = STOP (13 module, có thêm vạch kết thúc).
const CODE128_WIDTHS = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
  '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
  '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
  '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
  '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
  '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112'
).split(' ');

const CODE128_PATTERNS = CODE128_WIDTHS.map((widths) =>
  widths
    .split('')
    .map((width, index) => (index % 2 === 0 ? '1' : '0').repeat(Number(width)))
    .join('')
);

export const CODE128_SWITCH_C = 99;
export const CODE128_SWITCH_B = 100;
export const CODE128_START_B = 104;
export const CODE128_START_C = 105;
export const CODE128_STOP = 106;

// Vùng trắng tối thiểu của Code 128: 10 module mỗi bên.
export const CODE128_QUIET = 10;

/** Mẫu vạch của một giá trị ký hiệu 0…106. */
export function code128Pattern(codeword: number): string {
  const pattern = CODE128_PATTERNS[codeword];
  if (!pattern) throw new BarcodeError(`Giá trị ký hiệu Code 128 không hợp lệ: ${codeword}.`);
  return pattern;
}

/**
 * Checksum mod 103 của dãy [start, d1, d2, …]: start + Σ dᵢ × i.
 * Ký hiệu chuyển bộ (99 / 100) cũng là một dᵢ và được nhân trọng số như dữ liệu.
 */
export function code128Checksum(startAndData: number[]): number {
  return startAndData.reduce((sum, codeword, index) => sum + codeword * Math.max(index, 1), 0) % 103;
}

const isDigit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9';

function assertCode128Encodable(value: string) {
  if (!value) throw new BarcodeError('Chưa có mã để in vạch.');
  const bad = Array.from(value).find((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 32 || code > 126;
  });
  if (bad !== undefined) {
    const shown = (bad.codePointAt(0) ?? 0) < 32 ? 'ký tự điều khiển' : `"${bad}"`;
    throw new BarcodeError(
      `Mã "${value}" có ${shown} không in được thành mã vạch — Code 128 chỉ nhận chữ không dấu, số và ký hiệu thông thường.`
    );
  }
}

/**
 * Dãy ký hiệu (start + dữ liệu, chưa có checksum / stop) NGẮN NHẤT khi chỉ dùng bộ B và bộ C.
 * Quy hoạch động từ cuối chuỗi: cost[i][bộ] = số ký hiệu ít nhất để mã hoá value[i…] khi đang ở bộ đó.
 * Hoà thì ở lại bộ hiện tại, và bắt đầu bằng bộ B — kết quả luôn xác định.
 */
function code128AutoCodewords(value: string): number[] {
  const n = value.length;
  const costB: number[] = new Array(n + 1).fill(0);
  const costC: number[] = new Array(n + 1).fill(0);

  for (let i = n - 1; i >= 0; i -= 1) {
    const pair = isDigit(value[i]) && isDigit(value[i + 1]);
    // Ở bộ C mà không còn đủ cặp chữ số thì buộc chuyển về B (1 ký hiệu) rồi đi tiếp bằng B.
    const stayB = 1 + costB[i + 1];
    costC[i] = pair ? Math.min(1 + costC[i + 2], 1 + stayB) : 1 + stayB;
    costB[i] = pair ? Math.min(stayB, 2 + costC[i + 2]) : stayB;
  }

  const startC = costC[0] < costB[0];
  const codewords = [startC ? CODE128_START_C : CODE128_START_B];
  let inC = startC;
  let i = 0;

  while (i < n) {
    const pair = isDigit(value[i]) && isDigit(value[i + 1]);
    if (inC) {
      if (pair && 1 + costC[i + 2] <= 2 + costB[i + 1]) {
        codewords.push(Number(value.slice(i, i + 2)));
        i += 2;
      } else {
        codewords.push(CODE128_SWITCH_B);
        inC = false;
      }
    } else if (pair && 2 + costC[i + 2] < 1 + costB[i + 1]) {
      codewords.push(CODE128_SWITCH_C);
      inC = true;
    } else {
      codewords.push(value.charCodeAt(i) - 32);
      i += 1;
    }
  }

  return codewords;
}

const EVEN_DIGITS = /^(\d\d)+$/;

/**
 * Code 128. `mode`:
 *  - 'C'    : chỉ bộ C — value phải toàn chữ số, độ dài chẵn.
 *  - 'B'    : chỉ bộ B — mỗi ký tự ASCII in được là 1 ký hiệu.
 *  - 'auto' : toàn chữ số độ dài chẵn → bộ C; còn lại bộ B là chính, tự chuyển sang C cho các đoạn
 *             chữ số dài (mã ngắn nhất).
 * `symbology` của kết quả là 'CODE128C' khi cả mã nằm trong bộ C, ngược lại 'CODE128B'.
 */
export function encodeCode128(value: string, mode: 'auto' | 'B' | 'C' = 'auto'): EncodedBarcode {
  assertCode128Encodable(value);

  if (mode === 'C' && !EVEN_DIGITS.test(value)) {
    throw new BarcodeError('Code 128 bộ C chỉ nhận dãy chữ số có độ dài chẵn.');
  }
  const pureC = mode === 'C' || (mode === 'auto' && EVEN_DIGITS.test(value));

  let startAndData: number[];
  if (pureC) {
    startAndData = [CODE128_START_C, ...(value.match(/\d\d/g) ?? []).map(Number)];
  } else if (mode === 'B') {
    startAndData = [CODE128_START_B, ...Array.from(value).map((char) => char.charCodeAt(0) - 32)];
  } else {
    startAndData = code128AutoCodewords(value);
  }

  const codewords = [...startAndData, code128Checksum(startAndData), CODE128_STOP];

  return {
    symbology: pureC ? 'CODE128C' : 'CODE128B',
    value,
    modules: codewords.map(code128Pattern).join(''),
    quietLeft: CODE128_QUIET,
    quietRight: CODE128_QUIET,
    codewords,
  };
}

// ── Chọn loại mã + mã hoá ─────────────────────────────────────────────────

export function chooseSymbology(value: string): BarcodeSymbology {
  if (isValidEan13(value)) return 'EAN13';
  if (EVEN_DIGITS.test(value)) return 'CODE128C';
  return 'CODE128B';
}

/** Mã hoá theo loại tự chọn; lỗi trả về dạng dữ liệu (không ném) để giao diện liệt kê theo sản phẩm. */
export function encodeBarcode(rawValue: string | null | undefined): BarcodeResult {
  const value = (rawValue ?? '').trim();
  try {
    if (!value) throw new BarcodeError('Chưa có mã để in vạch.');
    if (chooseSymbology(value) === 'EAN13') return { ok: true, barcode: encodeEan13(value) };
    return { ok: true, barcode: encodeCode128(value) };
  } catch (error) {
    if (error instanceof BarcodeError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Tổng số module kể cả vùng trắng hai bên. */
export function totalModules(barcode: EncodedBarcode): number {
  return barcode.quietLeft + barcode.modules.length + barcode.quietRight;
}
