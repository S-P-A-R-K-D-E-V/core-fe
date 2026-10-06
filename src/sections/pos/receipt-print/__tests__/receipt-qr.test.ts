import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';

import { SAMPLE_VIETQR_PAYLOAD } from './receipt-fixtures';
import { buildReceiptQr, QR_QUIET_MODULES } from '../receipt-qr';

// ----------------------------------------------------------------------
// Mã QR chuyển khoản của phiếu thanh toán: SVG vẽ từ chuỗi VietQR, mỗi ô rộng một số nguyên điểm in
// (8 điểm/mm), có vùng trắng 4 ô, vừa bề rộng cho phép.
// ----------------------------------------------------------------------

const parseSvg = (svg: string) =>
  new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;

/** Dựng lại ma trận ô đen từ các hình chữ nhật của path (toạ độ đã trừ vùng trắng). */
function darkModules(svg: string, size: number): boolean[][] {
  const matrix = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const path = parseSvg(svg).querySelector('path')?.getAttribute('d') ?? '';
  Array.from(path.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)).forEach((match) => {
    const [x, y, length] = [Number(match[1]), Number(match[2]), Number(match[3])];
    expect(match[4]).toBe(match[3]);
    for (let col = x; col < x + length; col += 1) {
      matrix[y - QR_QUIET_MODULES][col - QR_QUIET_MODULES] = true;
    }
  });
  return matrix;
}

describe('buildReceiptQr', () => {
  const qr = buildReceiptQr(SAMPLE_VIETQR_PAYLOAD, 38);

  it('vẽ đúng ma trận của chuỗi VietQR (mức sửa lỗi M)', () => {
    expect(qr).not.toBeNull();
    const { svg, modules } = qr as NonNullable<typeof qr>;
    const expected = QRCode.create(SAMPLE_VIETQR_PAYLOAD, { errorCorrectionLevel: 'M' }).modules;
    expect(modules).toBe(expected.size);

    const drawn = darkModules(svg, modules);
    for (let row = 0; row < modules; row += 1) {
      for (let col = 0; col < modules; col += 1) {
        expect(drawn[row][col]).toBe(!!expected.get(row, col));
      }
    }
  });

  it('có đủ ba ô định vị 7×7 ở ba góc', () => {
    const { svg, modules } = qr as NonNullable<typeof qr>;
    const drawn = darkModules(svg, modules);
    const finder = (top: number, left: number) => {
      for (let row = 0; row < 7; row += 1) {
        for (let col = 0; col < 7; col += 1) {
          const ring = row === 0 || row === 6 || col === 0 || col === 6;
          const core = row >= 2 && row <= 4 && col >= 2 && col <= 4;
          expect(drawn[top + row][left + col]).toBe(ring || core);
        }
      }
    };
    finder(0, 0);
    finder(0, modules - 7);
    finder(modules - 7, 0);
  });

  it('mỗi ô rộng một số nguyên điểm in, cả mã kể cả vùng trắng 4 ô vừa bề rộng cho phép', () => {
    const { svg, modules, moduleDots, sizeMm } = qr as NonNullable<typeof qr>;
    const total = modules + QR_QUIET_MODULES * 2;
    const root = parseSvg(svg);
    expect(root.getAttribute('viewBox')).toBe(`0 0 ${total} ${total}`);
    expect(root.getAttribute('width')).toBe(`${sizeMm}mm`);
    expect(root.getAttribute('height')).toBe(`${sizeMm}mm`);
    expect(root.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(Number.isInteger(moduleDots)).toBe(true);
    expect(sizeMm).toBe((total * moduleDots) / 8);
    expect(sizeMm).toBeLessThanOrEqual(38);
    // ô to nhất còn vừa: thêm một điểm in nữa là tràn (hoặc đã ở cỡ tối đa 5 điểm = 0,625 mm)
    expect(moduleDots === 5 || (total * (moduleDots + 1)) / 8 > 38).toBe(true);
    // ô ≥ 0,5 mm cho mã VietQR trên giấy 80 mm — điện thoại quét dễ
    expect(moduleDots).toBeGreaterThanOrEqual(4);
  });

  it('bề rộng cho phép nhỏ hơn thì ô nhỏ lại, vẫn là số nguyên điểm in', () => {
    const wide = buildReceiptQr(SAMPLE_VIETQR_PAYLOAD, 38) as NonNullable<typeof qr>;
    const narrow = buildReceiptQr(SAMPLE_VIETQR_PAYLOAD, 20) as NonNullable<typeof qr>;
    expect(narrow.modules).toBe(wide.modules);
    expect(narrow.moduleDots).toBeLessThan(wide.moduleDots);
    expect(narrow.sizeMm).toBeLessThanOrEqual(20);
  });

  it('không có nội dung, nội dung quá dài, hoặc không vừa bề rộng dù ô nhỏ nhất → null', () => {
    expect(buildReceiptQr('', 38)).toBeNull();
    expect(buildReceiptQr('   ', 38)).toBeNull();
    expect(buildReceiptQr(null, 38)).toBeNull();
    expect(buildReceiptQr('x'.repeat(4000), 38)).toBeNull();
    expect(buildReceiptQr(SAMPLE_VIETQR_PAYLOAD, 5)).toBeNull();
  });

  it('SVG không tham chiếu tài nguyên ngoài', () => {
    const { svg } = qr as NonNullable<typeof qr>;
    expect(svg).not.toMatch(/href|url\(|<image|<script/);
  });
});
