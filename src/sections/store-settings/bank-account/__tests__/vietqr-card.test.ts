import { describe, expect, it } from 'vitest';

import { formatVnd, vietQrFileName, buildVietQrCardHtml } from '../vietqr-card';

import type { VietQrCardData } from '../vietqr-card';

// ----------------------------------------------------------------------
// Thẻ VietQR in dán quầy: tài liệu tự đặt khổ A6, mã QR vẽ từ payload thành SVG ngay trong tài liệu (không ảnh ngoài),
// chữ của người dùng được thoát HTML; QR tĩnh không in dòng số tiền.
// ----------------------------------------------------------------------

// Chuỗi VietQR (EMVCo) tĩnh của 970436 / 0123456789
const PAYLOAD =
  '00020101021138540010A00000072701240006970436011001234567890208QRIBFTTA53037045802VN6304ABCD';

const base: VietQrCardData = {
  storeName: 'CiCi <Accessories>',
  bankLogoUrl: 'https://cdn.vietqr.io/img/VCB.png',
  bankLabel: 'Vietcombank',
  bankName: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
  accountNumber: '0123456789',
  accountName: 'NGUYEN VAN A',
  payload: PAYLOAD,
  imageUrl: 'https://img.vietqr.io/image/970436-0123456789-compact2.png',
};

describe('buildVietQrCardHtml', () => {
  it('khổ A6, QR là SVG trong tài liệu, không dùng ảnh QR ngoài khi có payload', () => {
    const html = buildVietQrCardHtml(base);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('@page{size:105mm 148mm;margin:0}');
    expect(html).toContain('<svg class="qc"');
    expect(html).not.toContain('img.vietqr.io');
    expect(html).toContain('0123456789');
    expect(html).toContain('NGUYEN VAN A');
    expect(html).toContain('Ngân hàng TMCP Ngoại Thương Việt Nam');
  });

  it('thoát HTML chữ của người dùng (tên cửa hàng, nội dung)', () => {
    const html = buildVietQrCardHtml({ ...base, content: '<b>x</b>' });
    expect(html).toContain('CiCi &lt;Accessories&gt;');
    expect(html).not.toContain('<Accessories>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('QR tĩnh: không có dòng số tiền / nội dung; QR động: có', () => {
    const fixed = buildVietQrCardHtml(base);
    expect(fixed).not.toContain('Số tiền');
    expect(fixed).not.toContain('Nội dung:');

    const dynamic = buildVietQrCardHtml({ ...base, amount: 125000, content: 'BAN 3' });
    expect(dynamic).toContain('Số tiền: <b>125.000 đ</b>');
    expect(dynamic).toContain('Nội dung: <b>BAN 3</b>');
  });

  it('không có payload → dùng ảnh dự phòng; không có tên cửa hàng → bỏ dòng đó', () => {
    const html = buildVietQrCardHtml({ ...base, payload: null, storeName: null });
    expect(html).toContain('<img src="https://img.vietqr.io/image/970436-0123456789-compact2.png"');
    expect(html).not.toContain('class="store"');
  });
});

describe('formatVnd / vietQrFileName', () => {
  it('định dạng tiền VND', () => {
    expect(formatVnd(125000)).toBe('125.000 đ');
    expect(formatVnd(0)).toBe('0 đ');
  });

  it('tên file: không dấu, chữ thường, kèm số tiền nếu có', () => {
    expect(vietQrFileName({ bankLabel: 'Vietcombank', accountNumber: '0123456789' })).toBe(
      'vietqr-vietcombank-0123456789.png'
    );
    expect(
      vietQrFileName({ bankLabel: 'Ngân hàng Đông Á', accountNumber: '01', amount: 50000 })
    ).toBe('vietqr-ngan-hang-dong-a-01-50000.png');
  });
});
