import { describe, expect, it } from 'vitest';

import { crc16, buildVietQrPayload, normalizeTransferContent } from '../vietqr';
import { vnDayKey, deviceCode, nextOfflineCode, noteWithOfflineCode } from '../pos-device';

// Cùng bộ ca của core-be (CoreCms.Tests/Payment/VietQrPayloadTests.cs) — chuỗi QR dựng tại máy phải giống hệt máy chủ.
describe('buildVietQrPayload', () => {
  it.each([
    ['970416', '257678859', null, null, '00020101021138530010A0000007270123000697041601092576788590208QRIBFTTA53037045802VN6304AE9F'],
    [
      '970416',
      '257678859',
      10000,
      'Chuyen tien',
      '00020101021238530010A0000007270123000697041601092576788590208QRIBFTTA53037045405100005802VN62150811Chuyen tien630453E6',
    ],
    [
      '970423',
      'mynamebvh',
      50000,
      'test',
      '00020101021238530010A000000727012300069704230109mynamebvh0208QRIBFTTA53037045405500005802VN62080804test6304AB76',
    ],
    [
      '970454',
      '99ZP24009M07248267',
      null,
      null,
      '00020101021138620010A00000072701320006970454011899ZP24009M072482670208QRIBFTTA53037045802VN6304073C',
    ],
  ])('BIN %s, TK %s, %s đ, "%s"', (bin, account, amount, content, expected) => {
    expect(buildVietQrPayload(bin, account, amount, content)).toBe(expected);
  });

  it('CRC-16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1');
    expect(crc16('')).toBe('FFFF');
    expect(crc16('A')).toBe('B915');
  });

  it('nội dung: bỏ dấu, ký tự lạ thành 1 khoảng trắng, tối đa 25 ký tự', () => {
    expect(normalizeTransferContent('Mã tạm: Q7-261112-003')).toBe('Ma tam Q7 261112 003');
    expect(normalizeTransferContent('Đặt cọc   đơn #12')).toBe('Dat coc don 12');
    expect(normalizeTransferContent('a'.repeat(30))).toHaveLength(25);
  });

  it('BIN / số tài khoản / số tiền sai thì báo lỗi', () => {
    expect(() => buildVietQrPayload('9704', '123', 1000)).toThrow();
    expect(() => buildVietQrPayload('970416', '', 1000)).toThrow();
    expect(() => buildVietQrPayload('970416', '123', 0)).toThrow();
    expect(() => buildVietQrPayload('970416', '123', 10.5)).toThrow();
  });
});

describe('mã tạm', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it('mã máy sinh một lần, giữ nguyên', () => {
    const storage = memory();
    const first = deviceCode(storage, () => 0);
    expect(first).toBe('AA');
    expect(deviceCode(storage, () => 0.99)).toBe('AA');
  });

  it('ngày theo giờ Việt Nam: 23:30 UTC ngày 11 = ngày 12 ở VN', () => {
    expect(vnDayKey(new Date('2026-11-11T23:30:00Z'))).toBe('261112');
  });

  it('đếm trong ngày, sang ngày mới đếm lại', () => {
    const storage = memory();
    storage.setItem('pos_device_code', 'Q7');
    expect(nextOfflineCode(new Date('2026-11-12T03:00:00Z'), storage)).toBe('Q7-261112-001');
    expect(nextOfflineCode(new Date('2026-11-12T04:00:00Z'), storage)).toBe('Q7-261112-002');
    expect(nextOfflineCode(new Date('2026-11-13T03:00:00Z'), storage)).toBe('Q7-261113-001');
  });

  it('ghi mã tạm vào ghi chú một lần', () => {
    expect(noteWithOfflineCode(undefined, 'Q7-261112-001')).toBe('Mã tạm: Q7-261112-001');
    expect(noteWithOfflineCode('Khách quen', 'Q7-261112-001')).toBe('Khách quen | Mã tạm: Q7-261112-001');
    expect(noteWithOfflineCode('Khách quen | Mã tạm: Q7-261112-001', 'Q7-261112-001')).toBe(
      'Khách quen | Mã tạm: Q7-261112-001'
    );
  });
});
