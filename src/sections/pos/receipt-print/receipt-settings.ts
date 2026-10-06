import type { ISalesOrderReceipt, IKiotVietBankAccount } from 'src/types/corecms-api';

import { RECEIPT_PAPER_WIDTHS, DEFAULT_RECEIPT_PAPER_WIDTH } from './receipt-html';

import type { ReceiptPaperWidth } from './receipt-html';

// ----------------------------------------------------------------------
// Lựa chọn khi in hoá đơn, nhớ theo trình duyệt (localStorage) — mỗi máy tính ở quầy gắn với máy in của
// nó: khổ giấy cuộn và tài khoản nhận đã chọn cho mã QR chuyển khoản. Không có React / DOM ngoài việc
// đọc-ghi storage (truyền storage giả vào khi test).
// ----------------------------------------------------------------------

export const RECEIPT_SETTINGS_STORAGE_KEY = 'pos-receipt-print-settings';

export type ReceiptPrintSettings = {
  paperWidth: ReceiptPaperWidth;
  /** Tài khoản nhận chọn lần gần nhất cho mã QR (id của GET /bank-accounts); null = chưa chọn. */
  bankAccountId: string | null;
};

export const DEFAULT_RECEIPT_SETTINGS: ReceiptPrintSettings = {
  paperWidth: DEFAULT_RECEIPT_PAPER_WIDTH,
  bankAccountId: null,
};

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function normalizeReceiptSettings(input: unknown): ReceiptPrintSettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<ReceiptPrintSettings>;
  return {
    paperWidth: RECEIPT_PAPER_WIDTHS.includes(raw.paperWidth as ReceiptPaperWidth)
      ? (raw.paperWidth as ReceiptPaperWidth)
      : DEFAULT_RECEIPT_SETTINGS.paperWidth,
    bankAccountId:
      typeof raw.bankAccountId === 'string' && raw.bankAccountId ? raw.bankAccountId : null,
  };
}

export function loadReceiptSettings(
  storage: KeyValueStorage | null = browserStorage()
): ReceiptPrintSettings {
  try {
    const raw = storage?.getItem(RECEIPT_SETTINGS_STORAGE_KEY);
    return normalizeReceiptSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_RECEIPT_SETTINGS };
  }
}

export function saveReceiptSettings(
  settings: ReceiptPrintSettings,
  storage: KeyValueStorage | null = browserStorage()
) {
  try {
    storage?.setItem(
      RECEIPT_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeReceiptSettings(settings))
    );
  } catch {
    /* storage đầy hoặc bị chặn — bỏ qua, lần sau dùng mặc định */
  }
}

// ── Tài khoản nhận cho mã QR chuyển khoản ─────────────────────────────────

/**
 * Hoá đơn còn tiền phải trả mà core-be chưa xác định được tài khoản nhận (cửa hàng có nhiều tài khoản,
 * hoặc không có tài khoản nào dùng được) → hỏi người dùng muốn in mã QR vào tài khoản nào.
 */
export function needsTransferAccount(receipt: ISalesOrderReceipt): boolean {
  return !receipt.invoice.isCancelled && receipt.totals.remaining > 0 && !receipt.transferQr;
}

/** Tài khoản tạo được mã VietQR: có BIN 6 chữ số và số tài khoản. */
export function usableTransferAccounts(accounts: IKiotVietBankAccount[]): IKiotVietBankAccount[] {
  return (Array.isArray(accounts) ? accounts : []).filter(
    (account) =>
      /^\d{6}$/.test((account.bin ?? '').trim()) && (account.accountNumber ?? '').trim() !== ''
  );
}

/** "Vietcombank - 0123456789 (Tài khoản cửa hàng)" */
export function transferAccountLabel(account: IKiotVietBankAccount): string {
  const bank = (account.shortName ?? '').trim() || (account.bankName ?? '').trim();
  const number = (account.accountNumber ?? '').trim();
  const description = (account.description ?? '').trim();
  return `${[bank, number].filter(Boolean).join(' - ')}${description ? ` (${description})` : ''}`;
}
