import { findPreset, QR_DEVICE_PRESETS, type QrDeviceTemplates } from './qr-device-template';

// ----------------------------------------------------------------------
// Cài đặt máy QR — theo từng máy tính quầy (localStorage), vì cổng USB gắn với máy tính đó.
// ----------------------------------------------------------------------

export const QR_DEVICE_SETTINGS_KEY = 'pos_qr_device';

export type QrDeviceSettings = {
  /** Tự kết nối lại khi mở màn bán hàng / cắm lại cáp. */
  enabled: boolean;
  baudRate: number;
  /** Kiểu lệnh có sẵn đang dùng, hoặc 'custom' (mẫu tự nhập). */
  presetId: string;
  templates: QrDeviceTemplates;
  /** Cổng đã chọn lần trước — để tự mở lại đúng máy. */
  usbVendorId?: number;
  usbProductId?: number;
  /** Người cài đặt đã xác nhận máy hiện được QR với kiểu lệnh này. */
  verified: boolean;
};

export const DEFAULT_QR_DEVICE_SETTINGS: QrDeviceSettings = {
  enabled: false,
  baudRate: 115200,
  presetId: QR_DEVICE_PRESETS[0].id,
  templates: QR_DEVICE_PRESETS[0].templates,
  verified: false,
};

export function loadQrDeviceSettings(): QrDeviceSettings {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(QR_DEVICE_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_QR_DEVICE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<QrDeviceSettings>;
    const preset = findPreset(parsed.presetId);
    const templates = {
      ...(preset?.templates ?? DEFAULT_QR_DEVICE_SETTINGS.templates),
      ...(parsed.templates ?? {}),
    };
    return {
      ...DEFAULT_QR_DEVICE_SETTINGS,
      ...parsed,
      baudRate: Number(parsed.baudRate) > 0 ? Number(parsed.baudRate) : DEFAULT_QR_DEVICE_SETTINGS.baudRate,
      templates: {
        show: String(templates.show ?? ''),
        clear: String(templates.clear ?? ''),
        paid: String(templates.paid ?? ''),
      },
    };
  } catch {
    return { ...DEFAULT_QR_DEVICE_SETTINGS };
  }
}

export function saveQrDeviceSettings(settings: QrDeviceSettings) {
  try {
    localStorage.setItem(QR_DEVICE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Chế độ ẩn danh / bộ nhớ đầy — dùng tạm trong phiên.
  }
}
