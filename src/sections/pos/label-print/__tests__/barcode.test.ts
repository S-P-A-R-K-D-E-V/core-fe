import { describe, expect, it } from 'vitest';

import {
  encodeEan13,
  isValidEan13,
  totalModules,
  CODE128_STOP,
  encodeBarcode,
  encodeCode128,
  code128Pattern,
  ean13CheckDigit,
  chooseSymbology,
  code128Checksum,
  CODE128_START_B,
  CODE128_START_C,
} from '../barcode';

// ----------------------------------------------------------------------
// Bộ mã hoá được đối chiếu với giá trị ĐÃ BIẾT, chép nguyên văn vào đây (không tính lại bằng chính
// bảng của mã nguồn):
//  - EAN-13: ví dụ số kiểm tra của Wikipedia (4006381333931) và mã mẫu GTIN-13 5901234123457 với đủ
//    95 module (cùng chuỗi trong bộ test của thư viện JsBarcode);
//  - Code 128: bảng 107 mẫu vạch ở DẠNG NHỊ PHÂN (mã nguồn giữ dạng độ rộng — hai cách chép độc lập),
//    ví dụ checksum của Wikipedia ("PJJ123C" bộ A → 54) và Barcode Island ("HI345678", bắt đầu bộ B
//    → 68), chuỗi module của "123456" bộ C (bộ test của JsBarcode, checksum 44);
//  - một bộ GIẢI MÃ viết riêng trong file này (dùng bảng nhị phân ở dưới) đọc ngược mẫu vạch ra đúng
//    chuỗi ban đầu.
// ----------------------------------------------------------------------

// Giá trị 0…105 rồi STOP — dạng vạch (1) / khoảng (0) từng module.
const CODE128_BINARY = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011',
];

// Độ rộng khoảng-vạch-khoảng-vạch của mã L (bảng UPC/EAN dạng "độ rộng"), chữ số 0…9.
const EAN_L_WIDTHS = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'];

const EAN_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

const widthsToModules = (widths: string, first: '0' | '1') =>
  widths
    .split('')
    .map((width, index) => ((index % 2 === 0) === (first === '1') ? '1' : '0').repeat(Number(width)))
    .join('');

const reverse = (text: string) => text.split('').reverse().join('');

/** Đọc ngược 95 module EAN-13 ra 13 chữ số (chữ số đầu suy từ kiểu L/G của nửa trái). */
function decodeEan13(modules: string): string {
  const codeL = EAN_L_WIDTHS.map((widths) => widthsToModules(widths, '0'));
  const codeR = EAN_L_WIDTHS.map((widths) => widthsToModules(widths, '1'));
  const codeG = codeR.map(reverse);

  expect(modules).toHaveLength(95);
  expect(modules.slice(0, 3) + modules.slice(45, 50) + modules.slice(92)).toBe('10101010101');

  let parity = '';
  let digits = '';
  for (let index = 0; index < 6; index += 1) {
    const chunk = modules.slice(3 + index * 7, 10 + index * 7);
    const asL = codeL.indexOf(chunk);
    const asG = codeG.indexOf(chunk);
    expect(asL >= 0 || asG >= 0).toBe(true);
    parity += asL >= 0 ? 'L' : 'G';
    digits += String(asL >= 0 ? asL : asG);
  }
  for (let index = 0; index < 6; index += 1) {
    const digit = codeR.indexOf(modules.slice(50 + index * 7, 57 + index * 7));
    expect(digit).toBeGreaterThanOrEqual(0);
    digits += String(digit);
  }
  const first = EAN_PARITY.indexOf(parity);
  expect(first).toBeGreaterThanOrEqual(0);
  return `${first}${digits}`;
}

/** Đọc ngược mẫu vạch Code 128 (bộ B / C, có chuyển bộ) ra chuỗi ký tự; kiểm tra cả checksum. */
function decodeCode128(modules: string): string {
  const symbols: number[] = [];
  let position = 0;
  while (position < modules.length) {
    if (modules.slice(position) === CODE128_BINARY[106]) {
      symbols.push(106);
      break;
    }
    const value = CODE128_BINARY.indexOf(modules.slice(position, position + 11));
    expect(value).toBeGreaterThanOrEqual(0);
    symbols.push(value);
    position += 11;
  }

  expect(symbols.pop()).toBe(106);
  const check = symbols.pop();
  expect(check).toBe(symbols.reduce((sum, value, index) => sum + value * (index || 1), 0) % 103);

  const start = symbols.shift();
  expect([104, 105]).toContain(start);
  let inC = start === 105;
  let text = '';
  symbols.forEach((value) => {
    if (inC && value === 100) inC = false;
    else if (inC) text += String(value).padStart(2, '0');
    else if (value === 99) inC = true;
    else {
      expect(value).toBeLessThan(95);
      text += String.fromCharCode(value + 32);
    }
  });
  return text;
}

describe('EAN-13', () => {
  it('số kiểm tra của các mã đã công bố', () => {
    expect(ean13CheckDigit('400638133393')).toBe(1); // Wikipedia: 4006381333931
    expect(ean13CheckDigit('590123412345')).toBe(7); // mã mẫu GS1: 5901234123457
    expect(ean13CheckDigit('978030640615')).toBe(7); // ISBN-13 978-0-306-40615-7
    expect(ean13CheckDigit('893456789012')).toBe(0);
    expect(ean13CheckDigit('200000000001')).toBe(5);
  });

  it('isValidEan13: đúng 13 chữ số và khớp số kiểm tra', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('5901234123457')).toBe(true);
    expect(isValidEan13('8934567890120')).toBe(true);
    expect(isValidEan13('8934567890126')).toBe(false); // sai số kiểm tra
    expect(isValidEan13('590123412345')).toBe(false); // 12 số
    expect(isValidEan13('59012341234570')).toBe(false); // 14 số
    expect(isValidEan13('59012341234S7')).toBe(false);
  });

  it('5901234123457 → đúng 95 module đã công bố', () => {
    const barcode = encodeEan13('5901234123457');

    expect(barcode.modules).toBe(
      '10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101'
    );
    expect(barcode.modules).toHaveLength(95);
    expect(barcode.symbology).toBe('EAN13');
  });

  it('vùng trắng chuẩn: 11 module trái, 7 module phải → cả mã 113 module', () => {
    const barcode = encodeEan13('4006381333931');

    expect(barcode.quietLeft).toBe(11);
    expect(barcode.quietRight).toBe(7);
    expect(totalModules(barcode)).toBe(113);
  });

  it('cấu trúc: vạch chặn 101 … 01010 … 101, nửa phải là mã R (phần bù của bảng L dạng độ rộng)', () => {
    const { modules } = encodeEan13('0123456789012');

    expect(modules.slice(0, 3)).toBe('101');
    expect(modules.slice(45, 50)).toBe('01010');
    expect(modules.slice(92)).toBe('101');

    // Chữ số đầu 0 → cả 6 chữ số trái dùng mã L: 1 2 3 4 5 6
    const left = [1, 2, 3, 4, 5, 6].map((digit) => widthsToModules(EAN_L_WIDTHS[digit], '0')).join('');
    expect(modules.slice(3, 45)).toBe(left);

    // Nửa phải 7 8 9 0 1 2: cùng độ rộng nhưng bắt đầu bằng vạch
    const right = [7, 8, 9, 0, 1, 2].map((digit) => widthsToModules(EAN_L_WIDTHS[digit], '1')).join('');
    expect(modules.slice(50, 92)).toBe(right);
  });

  it('giải mã ngược ra đúng 13 chữ số, với đủ 10 kiểu chữ số đầu', () => {
    const values = [
      '0123456789012',
      '1234567890128',
      '2000000000015',
      '3800065711135',
      '4006381333931',
      '5901234123457',
      '6901234567892',
      '7501031311309',
      '8934567890120',
      '9780306406157',
    ];

    values.forEach((value) => {
      expect(isValidEan13(value), value).toBe(true);
      expect(decodeEan13(encodeEan13(value).modules)).toBe(value);
    });
    expect(values.map((value) => value[0]).join('')).toBe('0123456789');
  });

  it('từ chối mã sai số kiểm tra, nói rõ chữ số đúng', () => {
    expect(() => encodeEan13('8934567890126')).toThrow(/chữ số cuối phải là 0/);
    expect(() => encodeEan13('123')).toThrow(/13 chữ số/);
  });
});

describe('Code 128 — bảng mẫu vạch', () => {
  it('107 mẫu khớp bảng nhị phân chép độc lập', () => {
    CODE128_BINARY.forEach((pattern, codeword) => {
      expect(code128Pattern(codeword), `giá trị ${codeword}`).toBe(pattern);
    });
    expect(() => code128Pattern(107)).toThrow();
  });

  it('bất biến của chuẩn: 11 module, bắt đầu bằng vạch, kết thúc bằng khoảng, số module đen chẵn, không trùng', () => {
    const symbols = CODE128_BINARY.slice(0, 106).map((_, codeword) => code128Pattern(codeword));

    symbols.forEach((pattern) => {
      expect(pattern).toHaveLength(11);
      expect(pattern[0]).toBe('1');
      expect(pattern[10]).toBe('0');
      expect(pattern.split('1').length - 1).toSatisfy((bars: number) => bars % 2 === 0);
      // 3 vạch + 3 khoảng = 6 đoạn
      expect(pattern.match(/1+|0+/g)).toHaveLength(6);
    });
    expect(new Set(symbols).size).toBe(106);
    expect(code128Pattern(CODE128_STOP)).toHaveLength(13);
  });
});

describe('Code 128 — checksum', () => {
  it('ví dụ của Wikipedia: "PJJ123C" bộ A → tổng 878, checksum 54', () => {
    // Start A = 103; P J J 1 2 3 C = 48 42 42 17 18 19 35
    expect(code128Checksum([103, 48, 42, 42, 17, 18, 19, 35])).toBe(54);
  });

  it('ví dụ của Barcode Island: "HI345678" (B rồi chuyển C) → tổng 1407, checksum 68', () => {
    expect(code128Checksum([104, 40, 41, 99, 34, 56, 78])).toBe(68);
  });
});

describe('Code 128 — bộ B', () => {
  it('"a@B=1": Start B, checksum 21, Stop; module ghép từ bảng nhị phân độc lập', () => {
    // Giá trị = mã ASCII − 32: a 65, @ 32, B 34, = 29, 1 17.
    // 104 + 65·1 + 32·2 + 34·3 + 29·4 + 17·5 = 536 = 5·103 + 21 (tính tay)
    const expected = [CODE128_START_B, 65, 32, 34, 29, 17, 21, CODE128_STOP];
    const barcode = encodeCode128('a@B=1');

    expect(barcode.symbology).toBe('CODE128B');
    expect(barcode.codewords).toEqual(expected);
    expect(barcode.modules).toBe(expected.map((codeword) => CODE128_BINARY[codeword]).join(''));
    expect(barcode.modules).toHaveLength(7 * 11 + 13);
  });

  it('"BarCode 1": Start B (104), checksum 33, Stop (106)', () => {
    // 104 + 34·1 + 65·2 + 82·3 + 35·4 + 79·5 + 68·6 + 69·7 + 0·8 + 17·9 = 2093 = 20·103 + 33
    const { codewords } = encodeCode128('BarCode 1');

    expect(codewords?.[0]).toBe(104);
    expect(codewords?.slice(-2)).toEqual([33, 106]);
  });

  it('vùng trắng 10 module mỗi bên; mỗi ký hiệu 11 module, Stop 13 module', () => {
    const barcode = encodeCode128('KT-NO-01');

    expect(barcode.quietLeft).toBe(10);
    expect(barcode.quietRight).toBe(10);
    // start + 8 ký tự + checksum = 10 ký hiệu × 11 + stop 13
    expect(barcode.modules).toHaveLength(10 * 11 + 13);
    expect(totalModules(barcode)).toBe(143);
  });

  it('tự chuyển sang bộ C cho đoạn chữ số dài — đúng dãy của ví dụ "HI345678"', () => {
    const barcode = encodeCode128('HI345678');

    expect(barcode.symbology).toBe('CODE128B');
    expect(barcode.codewords).toEqual([104, 40, 41, 99, 34, 56, 78, 68, 106]);
  });

  it('mã hàng kiểu "SP000123" ngắn hơn hẳn so với chỉ dùng bộ B', () => {
    const auto = encodeCode128('SP000123');
    const onlyB = encodeCode128('SP000123', 'B');

    // S P [chuyển C] 00 01 23
    expect(auto.codewords?.slice(0, 7)).toEqual([104, 51, 48, 99, 0, 1, 23]);
    expect(auto.modules).toHaveLength(8 * 11 + 13);
    expect(onlyB.modules).toHaveLength(10 * 11 + 13);
  });

  it('không chuyển bộ khi không lợi: 2 chữ số cuối vẫn ở bộ B', () => {
    expect(encodeCode128('KT-NO-01').codewords?.slice(1, 9)).toEqual([43, 52, 13, 46, 47, 13, 16, 17]);
  });

  it('dãy số lẻ chữ số: vẫn hợp lệ và ngắn nhất (1 ký tự ở B + các cặp ở C)', () => {
    const { codewords } = encodeCode128('12345');

    // Start B, "1", chuyển C, 23, 45
    expect(codewords?.slice(0, 5)).toEqual([104, 17, 99, 23, 45]);
    expect(codewords?.[5]).toBe(code128Checksum([104, 17, 99, 23, 45]));
  });
});

describe('Code 128 — giải mã ngược', () => {
  it('mẫu vạch đọc ra đúng chuỗi ban đầu (bộ B, bộ C, có chuyển bộ, đủ ký hiệu ASCII)', () => {
    const values = [
      'SP000123',
      'KT-NO-01',
      'HI345678',
      'a@B=1',
      '12345',
      '123456',
      '00',
      '8934567890126',
      '99990000A1234',
      'A1B22C333D4444E55555F666666',
      ' !"#$%&\'()*+,-./0123456789:;<=>?@',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`',
      'abcdefghijklmnopqrstuvwxyz{|}~',
    ];

    values.forEach((value) => {
      expect(decodeCode128(encodeCode128(value).modules), value).toBe(value);
      expect(decodeCode128(encodeCode128(value, 'B').modules), value).toBe(value);
    });
  });

  it('chế độ tự động không bao giờ dài hơn chỉ dùng bộ B', () => {
    ['SP000123', '1234', '12A34', '1234567', 'A12345678B', '00000000000000000001'].forEach((value) => {
      expect(encodeCode128(value).modules.length).toBeLessThanOrEqual(
        encodeCode128(value, 'B').modules.length
      );
    });
  });
});

describe('Code 128 — bộ C', () => {
  it('"123456": Start C, checksum 44, Stop và đúng chuỗi module đã công bố', () => {
    const barcode = encodeCode128('123456');

    expect(barcode.symbology).toBe('CODE128C');
    expect(barcode.codewords).toEqual([CODE128_START_C, 12, 34, 56, 44, CODE128_STOP]);
    expect(barcode.modules).toBe(
      '11010011100101100111001000101100011100010110100011011101100011101011'
    );
  });

  it("mode 'C' từ chối dãy lẻ hoặc có chữ", () => {
    expect(() => encodeCode128('12345', 'C')).toThrow(/độ dài chẵn/);
    expect(() => encodeCode128('12A4', 'C')).toThrow(/độ dài chẵn/);
  });
});

describe('chọn loại mã', () => {
  it('13 số đúng số kiểm tra → EAN-13; toàn số độ dài chẵn → bộ C; còn lại → bộ B', () => {
    expect(chooseSymbology('8934567890120')).toBe('EAN13');
    expect(chooseSymbology('2000000000015')).toBe('EAN13');
    expect(chooseSymbology('8934567890126')).toBe('CODE128B'); // 13 số, sai số kiểm tra
    expect(chooseSymbology('12345678')).toBe('CODE128C');
    expect(chooseSymbology('893456789012')).toBe('CODE128C');
    expect(chooseSymbology('1234567')).toBe('CODE128B');
    expect(chooseSymbology('SP000123')).toBe('CODE128B');
    expect(chooseSymbology('KT-NO-01')).toBe('CODE128B');
  });

  it('encodeBarcode dùng đúng loại đã chọn và giữ nguyên giá trị (bỏ khoảng trắng đầu / cuối)', () => {
    const values = ['8934567890120', '12345678', 'SP000123', 'KT-NO-01', '8934567890126', '1234567'];

    values.forEach((value) => {
      const result = encodeBarcode(`  ${value} `);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.barcode.value).toBe(value);
        expect(result.barcode.symbology).toBe(chooseSymbology(value));
      }
    });
  });
});

describe('giá trị không mã hoá được → lỗi tiếng Việt, không có mã vạch', () => {
  it('chữ có dấu', () => {
    const result = encodeBarcode('ÁO-01');

    expect(result).toEqual({
      ok: false,
      error:
        'Mã "ÁO-01" có "Á" không in được thành mã vạch — Code 128 chỉ nhận chữ không dấu, số và ký hiệu thông thường.',
    });
  });

  it('chữ "đ", ký tự điều khiển, emoji', () => {
    expect(encodeBarcode('đen-01')).toMatchObject({ ok: false, error: expect.stringContaining('"đ"') });
    expect(encodeBarcode('AB\tCD')).toMatchObject({
      ok: false,
      error: expect.stringContaining('ký tự điều khiển'),
    });
    expect(encodeBarcode('SP😀1')).toMatchObject({ ok: false, error: expect.stringContaining('"😀"') });
  });

  it('không có mã', () => {
    expect(encodeBarcode('')).toEqual({ ok: false, error: 'Chưa có mã để in vạch.' });
    expect(encodeBarcode('   ')).toEqual({ ok: false, error: 'Chưa có mã để in vạch.' });
    expect(encodeBarcode(null)).toEqual({ ok: false, error: 'Chưa có mã để in vạch.' });
  });
});
