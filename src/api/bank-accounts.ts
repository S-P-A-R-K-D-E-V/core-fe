import axios, { endpoints } from 'src/utils/axios';
import type { IBankAccountVietQr } from 'src/types/payment-service';
import {
  IVietQRBank,
  IKiotVietBankAccount,
  ICreateBankAccountRequest,
  IUpdateBankAccountRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

/** Tài khoản nhận tiền. `includeInactive` chỉ có tác dụng với Admin (màn quản lý); vai trò khác luôn nhận dòng đang bật. */
export async function getBankAccounts(params?: {
  includeInactive?: boolean;
}): Promise<IKiotVietBankAccount[]> {
  const res = await axios.get(endpoints.bankAccounts.list, {
    params: params?.includeInactive ? { includeInactive: true } : undefined,
  });
  return res.data;
}

/** Thêm tài khoản cửa hàng tự khai (Admin). */
export async function createBankAccount(data: ICreateBankAccountRequest): Promise<{ id: string }> {
  const res = await axios.post<{ id: string }>(endpoints.bankAccounts.list, data);
  return res.data;
}

/** Sửa tài khoản cửa hàng tự khai (Admin) — dòng đồng bộ KiotViet bị từ chối. */
export async function updateBankAccount(
  id: string,
  data: IUpdateBankAccountRequest
): Promise<void> {
  await axios.put(endpoints.bankAccounts.details(id), data);
}

/** Tắt tài khoản (không xoá dòng). Bật lại bằng updateBankAccount với isActive = true. */
export async function deactivateBankAccount(id: string): Promise<void> {
  await axios.delete(endpoints.bankAccounts.details(id));
}

/** Mã VietQR của tài khoản: không có amount = QR tĩnh (in dán quầy); có amount / content = QR động. */
export async function getBankAccountVietQr(
  id: string,
  params?: { amount?: number | null; content?: string | null }
): Promise<IBankAccountVietQr> {
  const query: Record<string, string | number> = {};
  if (params?.amount && params.amount > 0) query.amount = params.amount;
  if (params?.content?.trim()) query.content = params.content.trim();
  const res = await axios.get<IBankAccountVietQr>(endpoints.bankAccounts.vietqr(id), {
    params: query,
  });
  return res.data;
}

export async function getVietQRBanks(): Promise<IVietQRBank[]> {
  const res = await fetch('https://api.vietqr.io/v2/banks');
  const json = await res.json();
  if (json.code === '00') return json.data;
  return [];
}
