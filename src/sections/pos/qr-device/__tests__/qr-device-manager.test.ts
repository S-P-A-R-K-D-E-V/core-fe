import { it, vi, expect, describe, afterEach, beforeEach } from 'vitest';

import {
  customerDisplay,
  resetCustomerDisplayForTests,
} from 'src/sections/customer-display/customer-display-bus';

import { QR_DEVICE_SETTINGS_KEY } from '../qr-device-settings';
import { qrDevice, pickGrantedPort, resetQrDeviceForTests } from '../qr-device-manager';

// ----------------------------------------------------------------------
// Cổng serial giả: ghi lại byte được gửi, cho phép "máy" gửi byte về, giả rút cáp.

class FakePort {
  written: string[] = [];

  opened: number[] = [];

  isOpen = false;

  readable: ReadableStream<Uint8Array> | null = null;

  writable: WritableStream<Uint8Array> | null = null;

  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  constructor(private readonly info: { usbVendorId?: number; usbProductId?: number }) {}

  getInfo() {
    return this.info;
  }

  async open({ baudRate }: { baudRate: number }) {
    if (this.isOpen) throw Object.assign(new Error('already open'), { name: 'InvalidStateError' });
    this.isOpen = true;
    this.opened.push(baudRate);
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
      },
    });
    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) => {
        this.written.push(new TextDecoder().decode(chunk));
      },
    });
  }

  async close() {
    this.isOpen = false;
    this.readable = null;
    this.writable = null;
  }

  emit(text: string) {
    this.controller?.enqueue(new TextEncoder().encode(text));
  }
}

class FakeSerial extends EventTarget {
  ports: FakePort[] = [];

  requested: FakePort | null = null;

  async getPorts() {
    return this.ports;
  }

  async requestPort() {
    if (!this.requested) throw Object.assign(new Error('cancel'), { name: 'NotFoundError' });
    this.ports.push(this.requested);
    return this.requested;
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

let serial: FakeSerial;

beforeEach(() => {
  localStorage.clear();
  serial = new FakeSerial();
  Object.defineProperty(navigator, 'serial', { value: serial, configurable: true });
  resetCustomerDisplayForTests();
  resetQrDeviceForTests();
});

afterEach(() => {
  // @ts-expect-error dọn thuộc tính giả
  delete navigator.serial;
});

const qr = (payload: string, amount: number) => ({ amount, imageSrc: 'data:,', payload, paymentCode: 'HD1' });

describe('pickGrantedPort', () => {
  const a = new FakePort({ usbVendorId: 0x1a86, usbProductId: 0x7523 });
  const b = new FakePort({ usbVendorId: 0x10c4, usbProductId: 0xea60 });
  const base = { enabled: true, baudRate: 9600, presetId: 'raw', templates: { show: '', clear: '', paid: '' }, verified: false };

  it('đúng máy đã chọn', () => {
    expect(pickGrantedPort([a, b] as never, { ...base, usbVendorId: 0x10c4, usbProductId: 0xea60 })).toBe(b);
    expect(pickGrantedPort([a] as never, { ...base, usbVendorId: 0x10c4, usbProductId: 0xea60 })).toBeNull();
  });

  it('chưa lưu máy: chỉ lấy khi có đúng một cổng', () => {
    expect(pickGrantedPort([a] as never, base)).toBe(a);
    expect(pickGrantedPort([a, b] as never, base)).toBeNull();
  });
});

describe('qrDevice', () => {
  it('chọn cổng → hiện QR theo màn khách, chỉ gửi khi đổi, đã trả thì xoá', async () => {
    const port = new FakePort({ usbVendorId: 0x1a86, usbProductId: 0x7523 });
    serial.requested = port;
    localStorage.setItem(
      QR_DEVICE_SETTINGS_KEY,
      JSON.stringify({ presetId: 'custom', templates: { show: 'Q:{payload}:{amount}\\n', clear: 'C\\n', paid: '' } })
    );
    resetQrDeviceForTests();
    qrDevice.attach();

    expect(await qrDevice.choosePort()).toBe(true);
    expect(port.opened).toEqual([115200]);
    expect(qrDevice.getSnapshot().status).toBe('connected');
    // Cài đặt nhớ máy để lần sau tự mở
    const saved = JSON.parse(localStorage.getItem(QR_DEVICE_SETTINGS_KEY)!);
    expect(saved).toMatchObject({ enabled: true, usbVendorId: 0x1a86, usbProductId: 0x7523 });

    customerDisplay.setQr(qr('PAY1', 50000));
    await flush();
    customerDisplay.setQr(qr('PAY1', 50000)); // trùng → không gửi lại
    await flush();
    customerDisplay.setQr(qr('PAY2', 60000));
    await flush();
    customerDisplay.paid(60000); // không có mẫu "đã nhận" → xoá
    await flush();

    // Vừa nối: xoá màn máy về màn chờ.
    expect(port.written).toEqual(['C\n', 'Q:PAY1:50000\n', 'Q:PAY2:60000\n', 'C\n']);
    expect(qrDevice.getSnapshot().log.some((e) => e.dir === 'tx')).toBe(true);
  });

  it('QR không có chuỗi gốc (chỉ có ảnh) → coi như không có QR', async () => {
    const port = new FakePort({});
    serial.requested = port;
    qrDevice.attach();
    await qrDevice.choosePort();
    qrDevice.setTemplates('custom', { show: 'S{payload}', clear: 'C', paid: 'P{amount}' });
    customerDisplay.setQr({ amount: 1000, imageSrc: 'data:,' });
    await flush();
    customerDisplay.setQr(qr('X', 1000));
    await flush();
    customerDisplay.paid(1000);
    await flush();
    // Đổi mẫu lệnh → gửi lại trạng thái (không có QR → xoá).
    expect(port.written).toEqual(['C', 'SX', 'P1000']);
  });

  it('mở lại tự động cổng đã cấp quyền + gửi lại trạng thái hiện tại', async () => {
    const port = new FakePort({ usbVendorId: 1, usbProductId: 2 });
    serial.ports = [port];
    localStorage.setItem(
      QR_DEVICE_SETTINGS_KEY,
      JSON.stringify({ enabled: true, baudRate: 9600, usbVendorId: 1, usbProductId: 2, presetId: 'line-lf' })
    );
    resetQrDeviceForTests();
    customerDisplay.setQr(qr('ABC', 2000));
    qrDevice.attach();
    await vi.waitFor(() => expect(port.written).toEqual(['ABC\n']));
    expect(port.opened).toEqual([9600]);
  });

  it('chưa bật thì không tự mở cổng', async () => {
    const port = new FakePort({});
    serial.ports = [port];
    qrDevice.attach();
    await flush();
    expect(port.opened).toEqual([]);
    expect(qrDevice.getSnapshot().status).toBe('disconnected');
  });

  it('rút cáp → chưa kết nối; cắm lại → tự nối', async () => {
    const port = new FakePort({ usbVendorId: 7, usbProductId: 8 });
    serial.requested = port;
    qrDevice.attach();
    await qrDevice.choosePort();

    const unplug = new Event('disconnect');
    Object.defineProperty(unplug, 'target', { value: port });
    serial.dispatchEvent(unplug);
    expect(qrDevice.getSnapshot().status).toBe('disconnected');

    await port.close();
    serial.dispatchEvent(new Event('connect'));
    await vi.waitFor(() => expect(qrDevice.getSnapshot().status).toBe('connected'));
    expect(port.opened.length).toBe(2);
  });

  it('đổi tốc độ khi đang nối → mở lại cổng với tốc độ mới', async () => {
    const port = new FakePort({});
    serial.requested = port;
    qrDevice.attach();
    await qrDevice.choosePort();
    await qrDevice.setBaudRate(9600);
    expect(port.opened).toEqual([115200, 9600]);
    expect(qrDevice.getSnapshot().settings.baudRate).toBe(9600);
  });

  it('ghi byte máy gửi về vào nhật ký', async () => {
    const port = new FakePort({});
    serial.requested = port;
    qrDevice.attach();
    await qrDevice.choosePort();
    port.emit('OK\r\n');
    await vi.waitFor(() =>
      expect(qrDevice.getSnapshot().log.find((e) => e.dir === 'rx')).toMatchObject({ text: 'OK‹0D›‹0A›', hex: '4F 4B 0D 0A' })
    );
  });

  it('bấm Huỷ ở hộp chọn cổng → không lỗi', async () => {
    qrDevice.attach();
    expect(await qrDevice.choosePort()).toBe(false);
    expect(qrDevice.getSnapshot().status).toBe('disconnected');
  });

  it('cổng đang mở ở nơi khác → báo lỗi dễ hiểu', async () => {
    const port = new FakePort({});
    port.isOpen = true;
    serial.requested = port;
    qrDevice.attach();
    expect(await qrDevice.choosePort()).toBe(false);
    expect(qrDevice.getSnapshot()).toMatchObject({ status: 'error' });
    expect(qrDevice.getSnapshot().error).toMatch(/tab hoặc phần mềm khác/);
  });

  it('trình duyệt không có Web Serial → unsupported', () => {
    // @ts-expect-error dọn thuộc tính giả
    delete navigator.serial;
    qrDevice.attach();
    expect(qrDevice.getSnapshot().status).toBe('unsupported');
  });
});
