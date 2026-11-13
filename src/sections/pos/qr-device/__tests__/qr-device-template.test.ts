import { describe, expect, it } from 'vitest';

import {
  toHex,
  usbIdLabel,
  toPrintable,
  encodeTemplate,
  probeCandidates,
  QR_DEVICE_PRESETS,
  QR_DEVICE_BAUD_RATES,
} from '../qr-device-template';

const info = {
  payload: '000201ABC',
  amount: 125000,
  bankName: 'VCB',
  accountNumber: '0123',
  accountName: 'NGUYEN VAN A',
  content: 'HD001',
};

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('encodeTemplate', () => {
  it('thay chỗ trống và ký tự điều khiển', () => {
    const bytes = encodeTemplate('{payload}|{amount}\\r\\n', info);
    expect(text(bytes)).toBe('000201ABC|125000\r\n');
    expect(bytes[bytes.length - 2]).toBe(0x0d);
    expect(bytes[bytes.length - 1]).toBe(0x0a);
  });

  it('số tiền có dấu chấm, thông tin tài khoản', () => {
    expect(text(encodeTemplate('{amountVnd} {bank} {account} {accountName} {content}', info))).toBe(
      '125.000 VCB 0123 NGUYEN VAN A HD001'
    );
  });

  it('\\xHH thành đúng một byte, \\\\ thành dấu gạch', () => {
    expect(Array.from(encodeTemplate('\\x02\\xFFA\\\\\\0\\t', info))).toEqual([0x02, 0xff, 0x41, 0x5c, 0x00, 0x09]);
  });

  it('chỗ trống lạ / dấu ngoặc lẻ giữ nguyên', () => {
    expect(text(encodeTemplate('{"qr":"{payload}","x":{unknown}}', info))).toBe('{"qr":"000201ABC","x":{unknown}}');
  });

  it('chữ có dấu mã UTF-8', () => {
    expect(Array.from(encodeTemplate('đ', null))).toEqual([0xc4, 0x91]);
  });

  it('mẫu rỗng → không byte nào', () => {
    expect(encodeTemplate('', info).length).toBe(0);
  });
});

describe('nhật ký', () => {
  it('hex + chữ đọc được', () => {
    const bytes = Uint8Array.from([0x4f, 0x4b, 0x0d, 0x0a]);
    expect(toHex(bytes)).toBe('4F 4B 0D 0A');
    expect(toPrintable(bytes)).toBe('OK‹0D›‹0A›');
  });

  it('VID:PID', () => {
    expect(usbIdLabel(0x1a86, 0x7523)).toBe('1A86:7523');
    expect(usbIdLabel(undefined, undefined)).toBeNull();
  });
});

describe('probeCandidates', () => {
  it('mọi kiểu ở 2 tốc độ phổ biến trước, không trùng', () => {
    const list = probeCandidates();
    const keys = list.map((c) => `${c.baudRate}:${c.preset.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(list[0]).toMatchObject({ baudRate: QR_DEVICE_BAUD_RATES[0], preset: { id: QR_DEVICE_PRESETS[0].id } });
    expect(list[1]).toMatchObject({ baudRate: QR_DEVICE_BAUD_RATES[1], preset: { id: QR_DEVICE_PRESETS[0].id } });
    QR_DEVICE_PRESETS.forEach((p) => {
      expect(keys).toContain(`115200:${p.id}`);
      expect(keys).toContain(`9600:${p.id}`);
    });
    QR_DEVICE_BAUD_RATES.forEach((b) => expect(list.some((c) => c.baudRate === b)).toBe(true));
  });
});
