import { describe, expect, it } from 'vitest';

import type { IKiotVietBankAccount } from 'src/types/corecms-api';

import { normalReceipt, cancelledReceipt, transferQrReceipt } from './receipt-fixtures';
import {
  loadReceiptSettings,
  saveReceiptSettings,
  needsTransferAccount,
  transferAccountLabel,
  usableTransferAccounts,
  DEFAULT_RECEIPT_SETTINGS,
  normalizeReceiptSettings,
  RECEIPT_SETTINGS_STORAGE_KEY,
} from '../receipt-settings';

// ----------------------------------------------------------------------
// Lựa chọn in hoá đơn nhớ theo trình duyệt (khổ giấy, tài khoản nhận cho mã QR) và việc xác định khi
// nào cần hỏi tài khoản nhận.
// ----------------------------------------------------------------------

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const account = (id: string, extra: Partial<IKiotVietBankAccount> = {}): IKiotVietBankAccount => ({
  id,
  bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam',
  shortName: 'Vietcombank',
  bin: '970436',
  accountNumber: '0123456789',
  ...extra,
});

describe('lựa chọn in hoá đơn', () => {
  it('mặc định: giấy 80 mm, chưa chọn tài khoản nhận', () => {
    expect(DEFAULT_RECEIPT_SETTINGS).toEqual({ paperWidth: 80, bankAccountId: null });
    expect(loadReceiptSettings(fakeStorage())).toEqual({ paperWidth: 80, bankAccountId: null });
    expect(loadReceiptSettings(null)).toEqual({ paperWidth: 80, bankAccountId: null });
  });

  it('lưu rồi đọc lại đúng khổ giấy và tài khoản đã chọn, dưới khoá pos-receipt-print-settings', () => {
    const storage = fakeStorage();
    saveReceiptSettings({ paperWidth: 58, bankAccountId: 'acc-2' }, storage);
    expect(RECEIPT_SETTINGS_STORAGE_KEY).toBe('pos-receipt-print-settings');
    expect(JSON.parse(storage.data.get(RECEIPT_SETTINGS_STORAGE_KEY) as string)).toEqual({
      paperWidth: 58,
      bankAccountId: 'acc-2',
    });
    expect(loadReceiptSettings(storage)).toEqual({ paperWidth: 58, bankAccountId: 'acc-2' });
  });

  it('dữ liệu hỏng hoặc giá trị lạ → về mặc định, không ném lỗi', () => {
    expect(
      loadReceiptSettings(fakeStorage({ [RECEIPT_SETTINGS_STORAGE_KEY]: '{không phải json' }))
    ).toEqual(DEFAULT_RECEIPT_SETTINGS);
    expect(normalizeReceiptSettings({ paperWidth: 76, bankAccountId: 12 })).toEqual(
      DEFAULT_RECEIPT_SETTINGS
    );
    expect(normalizeReceiptSettings({ paperWidth: '58', bankAccountId: '' })).toEqual(
      DEFAULT_RECEIPT_SETTINGS
    );
    expect(normalizeReceiptSettings('58')).toEqual(DEFAULT_RECEIPT_SETTINGS);
    expect(normalizeReceiptSettings(null)).toEqual(DEFAULT_RECEIPT_SETTINGS);
  });

  it('storage bị chặn / đầy: đọc ra mặc định, ghi không ném lỗi', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadReceiptSettings(blocked)).toEqual(DEFAULT_RECEIPT_SETTINGS);
    expect(() =>
      saveReceiptSettings({ paperWidth: 58, bankAccountId: null }, blocked)
    ).not.toThrow();
  });
});

describe('tài khoản nhận cho mã QR chuyển khoản', () => {
  it('chỉ hỏi tài khoản khi hoá đơn chưa huỷ, còn tiền phải trả và core-be chưa trả mã QR', () => {
    const unpaid = { ...transferQrReceipt(), transferQr: null };
    expect(needsTransferAccount(unpaid)).toBe(true);
    // core-be đã tự xác định được tài khoản
    expect(needsTransferAccount(transferQrReceipt())).toBe(false);
    // đã trả đủ
    expect(needsTransferAccount(normalReceipt())).toBe(false);
    // đã huỷ (còn 255.000đ nhưng không thu nữa)
    expect(needsTransferAccount(cancelledReceipt())).toBe(false);
  });

  it('tài khoản dùng được: BIN đúng 6 chữ số và có số tài khoản', () => {
    const accounts = [
      account('ok'),
      account('ok-spaces', { bin: ' 970422 ', accountNumber: ' 1900 1234 567 ' }),
      account('no-bin', { bin: undefined }),
      account('null-bin', { bin: null as unknown as undefined }),
      account('short-bin', { bin: '97043' }),
      account('letters-bin', { bin: '97O436' }),
      account('no-number', { accountNumber: '   ' }),
      account('null-number', { accountNumber: null as unknown as undefined }),
    ];
    expect(usableTransferAccounts(accounts).map((item) => item.id)).toEqual(['ok', 'ok-spaces']);
    expect(usableTransferAccounts([])).toEqual([]);
    expect(usableTransferAccounts(null as unknown as IKiotVietBankAccount[])).toEqual([]);
  });

  it('nhãn tài khoản: tên ngắn của ngân hàng, số tài khoản, ghi chú của cửa hàng', () => {
    expect(transferAccountLabel(account('a'))).toBe('Vietcombank - 0123456789');
    expect(transferAccountLabel(account('a', { description: 'Tài khoản cửa hàng' }))).toBe(
      'Vietcombank - 0123456789 (Tài khoản cửa hàng)'
    );
    expect(transferAccountLabel(account('a', { shortName: undefined }))).toBe(
      'Ngân hàng TMCP Ngoại thương Việt Nam - 0123456789'
    );
    expect(transferAccountLabel(account('a', { shortName: undefined, bankName: undefined }))).toBe(
      '0123456789'
    );
  });
});
