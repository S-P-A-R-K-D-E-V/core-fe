import type { IKiotVietBankAccount } from 'src/types/corecms-api';

import { configFor, manualPool, planTransfer, type RoutingStats } from 'src/utils/transfer-routing';

import type { KitTransferRouting } from './pos-print-kit';

// ----------------------------------------------------------------------
// Chọn tài khoản cho QR tĩnh lúc mất mạng theo "Tài khoản nhận theo kênh" đã lưu trên máy (thuần — test được).
// ----------------------------------------------------------------------

const ROTATION_KEY = 'pos_offline_transfer_used';

/** Lần dùng gần nhất của từng tài khoản trên máy này (luân phiên khi mất mạng — xấp xỉ, chỉ tính QR tĩnh của máy). */
export function localStats(): RoutingStats {
  try {
    const raw = window.localStorage.getItem(ROTATION_KEY);
    return raw ? { lastUsed: JSON.parse(raw) as Record<string, number> } : {};
  } catch {
    return {};
  }
}

export function rememberUsed(accountId: string) {
  try {
    const stats = (localStats().lastUsed ?? {}) as Record<string, number>;
    window.localStorage.setItem(ROTATION_KEY, JSON.stringify({ ...stats, [accountId]: Date.now() }));
  } catch {
    // Không lưu được (chế độ riêng tư) — lần sau vẫn theo thứ tự cấu hình.
  }
}

/**
 * Tài khoản cho QR tĩnh theo "Tài khoản nhận theo kênh" đã lưu trên máy (quy tắc giá trị hoá đơn / khung giờ / thứ tự; không có số
 * liệu S Payment nên không bỏ qua tài khoản hết lượt). Không cấu hình → tài khoản mặc định như trước. Pool = tài khoản thu ngân
 * được đổi (null = mọi tài khoản).
 */
export function offlineTransferChoice(
  accounts: IKiotVietBankAccount[],
  routing: KitTransferRouting | null | undefined,
  branchId: string | null | undefined,
  amount: number,
  now: Date,
  stats: RoutingStats = {}
): { accountId: string; pool: IKiotVietBankAccount[] } {
  const fallback = accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? '';
  const { config } = configFor(routing?.transfer, routing?.branches, branchId);
  const plan = planTransfer(config, { amount, now }, stats);
  const pick = plan?.candidates.find((id) => accounts.some((a) => a.id === id));
  const allowed = manualPool(config);
  const pool = allowed ? accounts.filter((a) => allowed.has(a.id)) : accounts;
  return { accountId: pick ?? fallback, pool: pool.length ? pool : accounts };
}
