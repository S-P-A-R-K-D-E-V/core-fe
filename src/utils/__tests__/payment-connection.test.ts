import { describe, expect, it, beforeEach } from 'vitest';

import type { IPosPaymentConnection } from 'src/types/corecms-api';

import {
  qrTarget,
  posConnectionKey,
  saveConnectionId,
  posConnectionLabel,
  readSavedConnectionId,
  resolveSavedConnectionId,
  POS_PAYMENT_CONNECTION_STORAGE_KEY,
} from 'src/utils/payment-connection';

const apiPay: IPosPaymentConnection = {
  id: 'conn-apipay',
  provider: 'apipay',
  kind: 'bank_feed',
  displayName: 'ApiPay MB',
  bin: '970422',
  accountNumber: '9704229999',
  environment: 'test',
  bankAccountId: null,
  bankName: 'MB',
};

describe('posConnectionLabel', () => {
  it('ghi nhà cung cấp — ngân hàng + tài khoản / VA nhận', () => {
    expect(posConnectionLabel(apiPay)).toBe('ApiPay — MB 9704229999');
  });

  it('không biết ngân hàng thì chỉ có số tài khoản, nhà cung cấp lạ hiện nguyên khoá', () => {
    expect(posConnectionLabel({ ...apiPay, provider: 'newfeed', bankName: null })).toBe(
      'newfeed — 9704229999'
    );
  });
});

describe('resolveSavedConnectionId', () => {
  it('giữ lựa chọn còn trong danh sách, kết nối đã tắt / chưa chọn thì về theo tài khoản', () => {
    expect(resolveSavedConnectionId('conn-apipay', [apiPay])).toBe('conn-apipay');
    expect(resolveSavedConnectionId('conn-old', [apiPay])).toBe('');
    expect(resolveSavedConnectionId(null, [apiPay])).toBe('');
    expect(resolveSavedConnectionId('conn-apipay', [])).toBe('');
  });
});

describe('qrTarget', () => {
  it('theo kết nối: gửi connectionId, tài khoản chỉ để ghi lại', () => {
    expect(qrTarget('conn-apipay', null)).toEqual({
      connectionId: 'conn-apipay',
      bankAccountId: null,
    });
    expect(qrTarget('conn-apipay', 'acc-mb')).toEqual({
      connectionId: 'conn-apipay',
      bankAccountId: 'acc-mb',
    });
  });

  it('theo tài khoản như cũ', () => {
    expect(qrTarget('', 'acc-mb')).toEqual({ connectionId: null, bankAccountId: 'acc-mb' });
  });
});

describe('ghi nhớ lựa chọn theo máy', () => {
  beforeEach(() => window.localStorage.clear());

  it('lưu kết nối đã chọn, chọn lại "theo tài khoản" thì xoá', () => {
    saveConnectionId('conn-apipay');
    expect(window.localStorage.getItem(POS_PAYMENT_CONNECTION_STORAGE_KEY)).toBe('conn-apipay');
    expect(readSavedConnectionId()).toBe('conn-apipay');

    saveConnectionId('');
    expect(readSavedConnectionId()).toBeNull();
  });
});

describe('posConnectionKey — kết nối chưa gắn tài khoản tách theo tài khoản', () => {
  const vtb: IPosPaymentConnection = {
    ...apiPay,
    id: 'conn-vtb',
    provider: 'vietinbank',
    kind: 'bank_direct',
    bin: '970415',
    accountNumber: '103885549137',
    bankAccountId: 'acc-vtb',
    bankName: 'VietinBank',
    key: 'conn-vtb:acc-vtb',
  };

  it('dùng key của BE, BE cũ không có key thì dùng id', () => {
    expect(posConnectionKey(vtb)).toBe('conn-vtb:acc-vtb');
    expect(posConnectionKey(apiPay)).toBe('conn-apipay');
  });

  it('nhớ lựa chọn theo key: hai tài khoản cùng một kết nối là hai lựa chọn khác nhau', () => {
    const other = { ...vtb, bankAccountId: 'acc-vtb-2', key: 'conn-vtb:acc-vtb-2' };
    expect(resolveSavedConnectionId('conn-vtb:acc-vtb-2', [vtb, other])).toBe('conn-vtb:acc-vtb-2');
    expect(resolveSavedConnectionId('conn-vtb', [vtb, other])).toBe('');
  });
});
