import type { IPosPaymentConnection } from 'src/types/corecms-api';

import { paymentProviderLabel } from './payment-status';

// ----------------------------------------------------------------------
// Nguồn xác nhận chuyển khoản khi tạo QR ở quầy: theo tài khoản ngân hàng (mặc định, như cũ) hoặc một kết nối
// spark-payment thu ngân chọn (vd "ApiPay — MB 9704…": QR vào số VA của kết nối, ApiPay báo tiền về là đơn tự xác nhận).
// ----------------------------------------------------------------------

/** localStorage: nguồn thu ngân chọn lần trước trên máy này ('' = theo tài khoản). */
export const POS_PAYMENT_CONNECTION_STORAGE_KEY = 'pos.paymentConnectionId';

/** "ApiPay — MB 9704229999": nhà cung cấp — ngân hàng + tài khoản / VA nhận tiền. */
export function posConnectionLabel(connection: IPosPaymentConnection): string {
  const account = [connection.bankName, connection.accountNumber].filter(Boolean).join(' ');
  return `${paymentProviderLabel(connection.provider)} — ${account}`;
}

/** Lựa chọn đã lưu còn trong danh sách (chưa bị tắt) thì giữ, không thì về mặc định theo tài khoản. */
export function resolveSavedConnectionId(
  saved: string | null | undefined,
  connections: Pick<IPosPaymentConnection, 'id'>[]
): string {
  return saved && connections.some((c) => c.id === saved) ? saved : '';
}

/**
 * Nơi nhận của mã QR trong body POST payment/qr/create: có kết nối → connectionId (bankAccountId chỉ để ghi lại tài khoản,
 * QR vào tài khoản của kết nối); không → bankAccountId như cũ.
 */
export function qrTarget(
  connectionId: string | null | undefined,
  bankAccountId: string | null | undefined
): { bankAccountId: string | null; connectionId: string | null } {
  return connectionId
    ? { connectionId, bankAccountId: bankAccountId || null }
    : { connectionId: null, bankAccountId: bankAccountId || null };
}

export function readSavedConnectionId(): string | null {
  try {
    return window.localStorage.getItem(POS_PAYMENT_CONNECTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveConnectionId(id: string): void {
  try {
    if (id) window.localStorage.setItem(POS_PAYMENT_CONNECTION_STORAGE_KEY, id);
    else window.localStorage.removeItem(POS_PAYMENT_CONNECTION_STORAGE_KEY);
  } catch {
    // Trình duyệt chặn lưu trữ — chỉ mất ghi nhớ lựa chọn.
  }
}
