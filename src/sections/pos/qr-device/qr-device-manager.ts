import {
  type CustomerDisplayView,
  subscribeCustomerDisplayView,
} from 'src/sections/customer-display/customer-display-bus';

import { getSerial, SerialLink, type SerialPortLike, isWebSerialSupported } from './qr-device-serial';
import { type QrDeviceSettings, loadQrDeviceSettings, saveQrDeviceSettings } from './qr-device-settings';
import { toHex, toPrintable, encodeTemplate, type QrDeviceInfo, type QrDeviceTemplates } from './qr-device-template';

// ----------------------------------------------------------------------
// Máy hiện QR cắm USB ở quầy. Mỗi tab giữ một kết nối (một cổng COM chỉ mở được ở một nơi). Máy đi theo trạng thái
// màn khách (customer-display-bus): có QR chờ quét → gửi lệnh hiện QR + số tiền; đã trả → lệnh "đã nhận" (hoặc xoá);
// còn lại → xoá. Chỉ gửi khi trạng thái đổi. Mọi lệnh ghi xuống cổng chạy tuần tự.
// ----------------------------------------------------------------------

export type QrDeviceStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'error';

export type QrDeviceLogEntry = { id: number; at: number; dir: 'tx' | 'rx' | 'info' | 'error'; text: string; hex?: string };

export type QrDeviceSnapshot = {
  status: QrDeviceStatus;
  error: string | null;
  settings: QrDeviceSettings;
  port: { usbVendorId?: number; usbProductId?: number } | null;
  log: QrDeviceLogEntry[];
};

const MAX_LOG = 200;
/** Byte máy gửi về trong khoảng này gộp vào một dòng nhật ký. */
const RX_MERGE_MS = 150;

let snapshot: QrDeviceSnapshot = {
  status: 'disconnected',
  error: null,
  settings: loadQrDeviceSettings(),
  port: null,
  log: [],
};
const subscribers = new Set<() => void>();
let link: SerialLink | null = null;
let attached = false;
let lastKey = 'idle';
let lastView: CustomerDisplayView = { mode: 'idle' };
let queue: Promise<unknown> = Promise.resolve();
let logSeq = 0;

function set(patch: Partial<QrDeviceSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  subscribers.forEach((fn) => fn());
}

function log(dir: QrDeviceLogEntry['dir'], text: string, bytes?: Uint8Array) {
  const now = Date.now();
  const last = snapshot.log[snapshot.log.length - 1];
  if (dir === 'rx' && bytes && last?.dir === 'rx' && now - last.at < RX_MERGE_MS) {
    const merged: QrDeviceLogEntry = {
      ...last,
      at: now,
      text: last.text + text,
      hex: `${last.hex ?? ''} ${toHex(bytes)}`.trim(),
    };
    set({ log: [...snapshot.log.slice(0, -1), merged] });
    return;
  }
  logSeq += 1;
  const entry: QrDeviceLogEntry = { id: logSeq, at: now, dir, text, hex: bytes ? toHex(bytes) : undefined };
  set({ log: [...snapshot.log, entry].slice(-MAX_LOG) });
}

/** Chạy tuần tự (mở / đóng / ghi không chồng lên nhau). */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

function updateSettings(patch: Partial<QrDeviceSettings>) {
  const settings = { ...snapshot.settings, ...patch };
  saveQrDeviceSettings(settings);
  set({ settings });
}

function errorText(error: unknown): string {
  const e = error as { name?: string; message?: string };
  if (e?.name === 'InvalidStateError') return 'Cổng đang mở ở tab hoặc phần mềm khác — đóng chỗ đó rồi kết nối lại';
  if (e?.name === 'NetworkError') return 'Không mở được cổng — rút cáp USB cắm lại rồi thử lại';
  if (e?.name === 'SecurityError') return 'Trình duyệt chặn truy cập cổng USB';
  return e?.message || 'Lỗi không rõ';
}

/** Cổng đã cấp quyền: đúng máy đã chọn lần trước; chưa lưu thì lấy cổng duy nhất. */
export function pickGrantedPort(ports: SerialPortLike[], settings: QrDeviceSettings): SerialPortLike | null {
  if (settings.usbVendorId != null) {
    return (
      ports.find((p) => {
        const info = p.getInfo();
        return info.usbVendorId === settings.usbVendorId && info.usbProductId === settings.usbProductId;
      }) ?? null
    );
  }
  return ports.length === 1 ? ports[0] : null;
}

function onRx(bytes: Uint8Array) {
  log('rx', toPrintable(bytes), bytes);
}

function onLost(error: unknown) {
  link = null;
  log('error', `Mất kết nối: ${errorText(error)}`);
  set({ status: 'disconnected', error: null });
}

async function closeLink() {
  const current = link;
  link = null;
  if (current) await current.close();
}

async function openPort(port: SerialPortLike, baudRate: number): Promise<boolean> {
  await closeLink();
  set({ status: 'connecting', error: null });
  const next = new SerialLink(port, onRx, onLost);
  try {
    await next.open(baudRate);
  } catch (error) {
    const message = errorText(error);
    log('error', `Không mở được cổng: ${message}`);
    set({ status: 'error', error: message });
    return false;
  }
  link = next;
  const info = port.getInfo();
  updateSettings({ enabled: true, baudRate, usbVendorId: info.usbVendorId, usbProductId: info.usbProductId });
  set({ status: 'connected', error: null, port: info });
  log('info', `Đã kết nối (${baudRate} baud)`);
  // Máy vừa cắm: gửi lại trạng thái hiện tại.
  lastKey = 'reconnect';
  await syncView(lastView, true);
  return true;
}

async function write(bytes: Uint8Array, label: string) {
  if (!link || bytes.length === 0) return;
  try {
    await link.write(bytes);
    log('tx', `${label}: ${toPrintable(bytes)}`, bytes);
  } catch (error) {
    log('error', `Gửi lệnh lỗi: ${errorText(error)}`);
  }
}

function viewKey(view: CustomerDisplayView): string {
  if (view.mode === 'qr' && view.qr.payload) return `qr:${view.qr.payload}:${Math.round(view.qr.amount)}`;
  if (view.mode === 'paid') return `paid:${Math.round(view.amount)}`;
  return 'idle';
}

export function infoFromView(view: CustomerDisplayView): QrDeviceInfo | null {
  if (view.mode !== 'qr' || !view.qr.payload) return null;
  return {
    payload: view.qr.payload,
    amount: view.qr.amount,
    bankName: view.qr.bankName,
    accountNumber: view.qr.accountNumber,
    accountName: view.qr.accountName,
    content: view.qr.paymentCode,
  };
}

async function syncView(view: CustomerDisplayView, inQueue = false): Promise<void> {
  lastView = view;
  const run = async () => {
    if (!link) return;
    const key = viewKey(view);
    if (key === lastKey) return;
    lastKey = key;
    const { templates } = snapshot.settings;
    const info = infoFromView(view);
    if (info) {
      await write(encodeTemplate(templates.show, info), 'Hiện QR');
    } else if (view.mode === 'paid' && templates.paid) {
      await write(
        encodeTemplate(templates.paid, { payload: '', amount: view.amount }),
        'Đã nhận tiền'
      );
    } else {
      await write(encodeTemplate(templates.clear, null), 'Xoá');
    }
  };
  if (inQueue) await run();
  else await enqueue(run);
}

function onSerialConnect() {
  if (!snapshot.settings.enabled || link) return;
  qrDevice.reconnect().catch(console.error);
}

function onSerialDisconnect(event: Event) {
  if (link && (event.target as unknown) === link.port) {
    link = null;
    log('info', 'Đã rút cáp máy QR');
    set({ status: 'disconnected', error: null });
  }
}

export const qrDevice = {
  getSnapshot: () => snapshot,
  subscribe(fn: () => void) {
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  },

  /** Gắn vào màn khách + tự nối lại cổng đã chọn. Gọi nhiều lần không sao. */
  attach() {
    if (attached || typeof window === 'undefined') return;
    attached = true;
    if (!isWebSerialSupported()) {
      set({ status: 'unsupported' });
      return;
    }
    subscribeCustomerDisplayView((view) => {
      syncView(view).catch(console.error);
    });
    const serial = getSerial();
    serial?.addEventListener('connect', onSerialConnect);
    serial?.addEventListener('disconnect', onSerialDisconnect);
    if (snapshot.settings.enabled) qrDevice.reconnect().catch(console.error);
  },

  /** Mở lại cổng đã cấp quyền (không hỏi người dùng). */
  reconnect(): Promise<boolean> {
    return enqueue(async () => {
      const serial = getSerial();
      if (!serial || link) return !!link;
      const port = pickGrantedPort(await serial.getPorts(), snapshot.settings);
      if (!port) return false;
      return openPort(port, snapshot.settings.baudRate);
    });
  },

  /** Chọn cổng (hộp chọn của trình duyệt — phải gọi ngay trong sự kiện bấm nút). */
  async choosePort(): Promise<boolean> {
    const serial = getSerial();
    if (!serial) {
      set({ status: 'unsupported' });
      return false;
    }
    let port: SerialPortLike;
    try {
      port = await serial.requestPort();
    } catch (error) {
      if ((error as { name?: string })?.name === 'NotFoundError') return false; // bấm Huỷ
      set({ status: 'error', error: errorText(error) });
      return false;
    }
    return enqueue(() => openPort(port, snapshot.settings.baudRate));
  },

  /** Ngắt và thôi tự kết nối. */
  disconnect(): Promise<void> {
    return enqueue(async () => {
      await closeLink();
      updateSettings({ enabled: false });
      set({ status: 'disconnected', error: null });
      log('info', 'Đã ngắt kết nối');
    });
  },

  /** Đổi tốc độ cổng; đang kết nối thì mở lại với tốc độ mới. */
  setBaudRate(baudRate: number): Promise<boolean> {
    return enqueue(async () => {
      updateSettings({ baudRate });
      const port = link?.port;
      if (!port) return false;
      return openPort(port, baudRate);
    });
  },

  /** Lưu kiểu lệnh. */
  setTemplates(presetId: string, templates: QrDeviceTemplates, verified = false) {
    updateSettings({ presetId, templates, verified });
    lastKey = 'changed';
  },

  /** Gửi thử một mẫu lệnh (trang cài đặt). */
  sendTemplate(template: string, info: QrDeviceInfo | null, label = 'Gửi thử'): Promise<void> {
    return enqueue(async () => {
      if (!link) {
        log('error', 'Chưa kết nối máy QR');
        return;
      }
      lastKey = 'test';
      await write(encodeTemplate(template, info), label);
    });
  },

  clearLog() {
    set({ log: [] });
  },
};

/** Đặt lại (test). */
export function resetQrDeviceForTests() {
  link = null;
  attached = false;
  lastKey = 'idle';
  lastView = { mode: 'idle' };
  queue = Promise.resolve();
  snapshot = { status: 'disconnected', error: null, settings: loadQrDeviceSettings(), port: null, log: [] };
  subscribers.clear();
}
