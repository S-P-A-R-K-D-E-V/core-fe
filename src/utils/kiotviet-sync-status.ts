import type { ISalesOrder } from 'src/types/corecms-api';

import { apiErrorMessage, hasApiErrorCode } from './api-error';

// ----------------------------------------------------------------------
// Trạng thái đẩy hoá đơn sang KiotViet (field kiotVietSyncStatus — core-be: KiotVietPushStatuses).
//
// Hoá đơn tạo trong hệ thống chỉ được đẩy khi cửa hàng có đẩy hoá đơn (KiotViet:Push:Enabled bật VÀ cửa hàng đã
// nối KiotViet); còn lại mang "NotPushed" — trạng thái bình thường, KHÔNG phải lỗi. Giá trị lạ (core-be mới hơn)
// hiện trung tính: không bao giờ thành lỗi, không có nút đẩy lại.
// ----------------------------------------------------------------------

export type KiotVietSyncColor = 'default' | 'info' | 'warning' | 'success' | 'error';

export interface KiotVietSyncDisplay {
  label: string;
  color: KiotVietSyncColor;
  /** Chú thích kèm nhãn: lỗi lần đẩy gần nhất (Failed), mã đơn trên KiotViet (Synced) hoặc giải thích nhãn. */
  hint: string;
}

type SyncFields = Partial<
  Pick<
    ISalesOrder,
    | 'orderNumber'
    | 'kiotVietId'
    | 'kiotVietSyncStatus'
    | 'kiotVietSyncError'
    | 'kiotVietSyncAttempts'
    | 'kiotVietOrderCode'
  >
>;

const NOT_PUSHED: KiotVietSyncDisplay = {
  label: 'Không đẩy KiotViet',
  color: 'default',
  hint: 'Hoá đơn chỉ lưu trong hệ thống, không gửi sang KiotViet',
};

// Số hoá đơn do hệ thống tự sinh: HD-yyyyMMdd-0001 (core-be: SalesOrderRepository.GenerateCodeAsync).
const SYSTEM_ORDER_NUMBER = /^HD-\d{8}-\d+$/;

/**
 * Hoá đơn kéo về từ KiotViet (đã có id KiotViet), không phải hoá đơn tạo trong hệ thống?
 *
 * Core-be trả kiotVietId của hoá đơn: có id = hoá đơn kéo về từ KiotViet. Core-be cũ chưa trả field này
 * (undefined) thì suy từ dấu vết của hoá đơn tạo trong hệ thống — số hoá đơn do hệ thống sinh, hoặc đã từng thử
 * đẩy (số lần đẩy > 0, còn lỗi đẩy); trạng thái "None" một mình không đủ vì hoá đơn Pending/Failed bị huỷ cũng
 * về "None".
 */
export function isFromKiotViet(order: SyncFields): boolean {
  // Mọi trạng thái khác None chỉ được gán cho hoá đơn tạo trong hệ thống
  if ((order.kiotVietSyncStatus || 'None') !== 'None') return false;

  if (order.kiotVietId !== undefined) return order.kiotVietId !== null;

  const createdInSystem =
    SYSTEM_ORDER_NUMBER.test(order.orderNumber ?? '') ||
    (order.kiotVietSyncAttempts ?? 0) > 0 ||
    !!order.kiotVietSyncError;

  return !createdInSystem;
}

/** Nhãn + màu của cột KiotViet. Chỉ "Failed" mang màu lỗi. */
export function kiotVietSyncDisplay(order: SyncFields): KiotVietSyncDisplay {
  const status = order.kiotVietSyncStatus || 'None';

  switch (status) {
    case 'Pending':
      return { label: 'Chờ đồng bộ', color: 'warning', hint: '' };
    case 'Pushing':
      return { label: 'Đang đồng bộ', color: 'info', hint: '' };
    case 'Synced':
      return {
        label: 'Đã đồng bộ',
        color: 'success',
        hint: order.kiotVietOrderCode ? `Mã đơn KiotViet: ${order.kiotVietOrderCode}` : '',
      };
    case 'Failed':
      return { label: 'Lỗi đồng bộ', color: 'error', hint: order.kiotVietSyncError || '' };
    case 'NotPushed':
      return NOT_PUSHED;
    case 'None':
      // Hoá đơn tạo trong hệ thống bị huỷ khi còn Pending/Failed: chưa từng lên KiotViet
      return isFromKiotViet(order)
        ? { label: 'Từ KiotViet', color: 'default', hint: '' }
        : NOT_PUSHED;
    default:
      return { label: status, color: 'default', hint: '' };
  }
}

/** Chỉ hoá đơn "Failed" đẩy lại được — core-be từ chối mọi trạng thái khác (Pending do hệ thống tự đẩy). */
export function canRetryKiotVietPush(status?: string | null): boolean {
  return status === 'Failed';
}

/** Lời báo sau khi tạo hoá đơn: chỉ nhắc KiotViet khi core-be trả "Pending" (đã xếp hàng đẩy). */
export function salesOrderCreatedMessage(status?: string | null): string {
  return status === 'Pending' ? 'Đã tạo đơn — đang đồng bộ KiotViet' : 'Đã tạo đơn';
}

/** Mã lỗi 409 của POST kiotviet/push/sales-orders/{id}/retry: cửa hàng không đẩy hoá đơn sang KiotViet. */
export const KIOTVIET_PUSH_DISABLED = 'KiotVietSalesOrder.PushDisabled';

export interface KiotVietRetryError {
  message: string;
  /** Cửa hàng không đẩy hoá đơn — là thông tin cho người dùng, không phải lỗi của thao tác. */
  pushDisabled: boolean;
  /** Core-be đã trả lời (từ chối theo trạng thái hiện tại của đơn) → dữ liệu đang hiện có thể đã cũ. */
  fromServer: boolean;
}

/**
 * Lời từ chối đẩy lại — body { message, code, title, errorCodes }: luôn hiện câu của core-be.
 * Không có body (mất mạng: axios reject bằng chuỗi) → câu mặc định.
 */
export function kiotVietRetryError(
  error: any,
  fallback = 'Không thể đồng bộ lại'
): KiotVietRetryError {
  const fromServer = !!error && typeof error === 'object';

  return {
    message: fromServer ? apiErrorMessage(error, fallback) : fallback,
    pushDisabled: hasApiErrorCode(error, KIOTVIET_PUSH_DISABLED),
    fromServer,
  };
}
