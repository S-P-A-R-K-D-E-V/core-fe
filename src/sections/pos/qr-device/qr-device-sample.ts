import { loadPrintKit } from '../offline/pos-print-kit';
import { buildVietQrPayload } from '../offline/vietqr';

import type { IKiotVietBankAccount } from 'src/types/corecms-api';

import type { QrDeviceInfo } from './qr-device-template';

export const SAMPLE_AMOUNT = 10_000;
export const SAMPLE_CONTENT = 'THU MAY QR';

/**
 * QR thử 10.000đ vào tài khoản nhận tiền mặc định đã lưu trên máy (màn bán hàng lưu lúc có mạng); chưa có thì dùng
 * số tài khoản giả — chỉ để xem máy có vẽ được mã không, đừng chuyển tiền.
 */
export async function sampleQrInfo(): Promise<QrDeviceInfo> {
  let account: IKiotVietBankAccount | null = null;
  try {
    const kit = await loadPrintKit();
    account = kit.bankAccounts.find((a) => a.isDefault) ?? kit.bankAccounts[0] ?? null;
  } catch {
    account = null;
  }
  const bin = account?.bin || '970436';
  const accountNumber = account?.accountNumber || '0000000000';
  let payload: string;
  try {
    payload = buildVietQrPayload(bin, accountNumber, SAMPLE_AMOUNT, SAMPLE_CONTENT);
  } catch {
    payload = buildVietQrPayload('970436', '0000000000', SAMPLE_AMOUNT, SAMPLE_CONTENT);
  }
  return {
    payload,
    amount: SAMPLE_AMOUNT,
    bankName: account?.bankName ?? 'Vietcombank',
    accountNumber,
    accountName: account?.accountHolder ?? '',
    content: SAMPLE_CONTENT,
  };
}
