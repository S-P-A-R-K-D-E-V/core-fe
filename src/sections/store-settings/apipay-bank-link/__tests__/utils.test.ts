import { describe, expect, it } from 'vitest';

import type { IPaymentConnection } from 'src/types/payment-service';

import {
  BIN,
  identityLabel,
  linkFormErrors,
  needsAcbUserId,
  normalizeMobile,
  accountTypesFor,
  EMPTY_LINK_FORM,
  apiPayConnections,
  toBankAccountName,
  isManualActivation,
  coreBankAccountText,
  issuesVirtualAccount,
} from '../utils';

// ----------------------------------------------------------------------
// Luật liên kết ngân hàng ApiPay (docs "How to Connect Banks"): loại TK theo ngân hàng, CCCD hay MST, ACB OneBiz,
// kích hoạt thủ công, tài khoản ảo; tên in hoa không dấu; SĐT +84 → 0.
// ----------------------------------------------------------------------

describe('toBankAccountName', () => {
  it('bỏ dấu, đ → D, in hoa, gộp khoảng trắng', () => {
    expect(toBankAccountName('  nguyễn   văn  đức ')).toBe('NGUYEN VAN DUC');
    expect(toBankAccountName('Phạm Thị Ánh-Dương')).toBe('PHAM THI ANH DUONG');
    expect(toBankAccountName('ĐẶNG THU HÀ')).toBe('DANG THU HA');
    expect(toBankAccountName(' ... ')).toBe('');
  });
});

describe('normalizeMobile', () => {
  it('đổi +84 / 84 về 0 và bỏ ký tự phân cách', () => {
    expect(normalizeMobile('+84 858 838 502')).toBe('0858838502');
    expect(normalizeMobile('84858838502')).toBe('0858838502');
    expect(normalizeMobile('0858.838.502')).toBe('0858838502');
  });
});

describe('luật theo ngân hàng', () => {
  it('loại tài khoản mỗi ngân hàng nhận', () => {
    expect(accountTypesFor(BIN.VIETCOMBANK)).toEqual([
      'business-account',
      'business-household-account',
    ]);
    expect(accountTypesFor(BIN.SHINHAN)).toEqual(['personal-account', 'business-account']);
    expect(accountTypesFor(BIN.SACOMBANK)).toEqual([
      'personal-account',
      'business-household-account',
    ]);
    expect(accountTypesFor(BIN.MB)).toHaveLength(3);
  });

  it('ACB cá nhân không cần CCCD; ACB DN / HKD cần OneBiz; MB HKD dùng CCCD; DN dùng MST', () => {
    expect(identityLabel(BIN.ACB, 'personal-account')).toBeNull();
    expect(needsAcbUserId(BIN.ACB, 'business-household-account')).toBe(true);
    expect(needsAcbUserId(BIN.ACB, 'personal-account')).toBe(false);
    expect(needsAcbUserId(BIN.MB, 'business-account')).toBe(false);
    expect(identityLabel(BIN.MB, 'business-household-account')).toMatch(/CCCD/);
    expect(identityLabel(BIN.OCB, 'business-household-account')).toMatch(/Mã số thuế/);
    expect(identityLabel(BIN.BIDV, 'business-account')).toMatch(/Mã số thuế/);
  });

  it('kích hoạt thủ công và tài khoản ảo', () => {
    expect(isManualActivation(BIN.TPBANK, 'personal-account')).toBe(true);
    expect(isManualActivation(BIN.BIDV, 'business-account')).toBe(true);
    expect(isManualActivation(BIN.BIDV, 'business-household-account')).toBe(false);
    expect(isManualActivation(BIN.MB, 'business-account')).toBe(false);
    expect(issuesVirtualAccount(BIN.MB)).toBe(true);
    expect(issuesVirtualAccount(BIN.ACB)).toBe(false);
  });
});

describe('linkFormErrors', () => {
  const valid = {
    ...EMPTY_LINK_FORM,
    bankBin: BIN.MB,
    accountType: 'personal-account' as const,
    accountNumber: '2455 0721',
    accountName: 'Phạm Thanh Đạt',
    mobile: '0858838502',
    identity: '012345678901',
  };

  it('form đủ là hợp lệ, ACB cá nhân không cần CCCD', () => {
    expect(linkFormErrors(valid)).toEqual({});
    expect(linkFormErrors({ ...valid, bankBin: BIN.ACB, identity: '' })).toEqual({});
  });

  it('báo lỗi từng ô, không nhắc lại giá trị đã nhập', () => {
    const errors = linkFormErrors({
      ...valid,
      mobile: '99999',
      identity: '12',
      accountNumber: '12-34',
      bankBin: BIN.VIETCOMBANK,
    });
    expect(Object.keys(errors).sort()).toEqual([
      'accountNumber',
      'accountType',
      'identity',
      'mobile',
    ]);
    expect(Object.values(errors).join(' ')).not.toMatch(/99999/);
    expect(
      linkFormErrors({
        ...valid,
        bankBin: BIN.ACB,
        accountType: 'business-account',
        identity: '0101234567',
      })
    ).toEqual({ acbUserId: 'Nhập tên đăng nhập ACB OneBiz' });
  });
});

describe('apiPayConnections / coreBankAccountText', () => {
  const conn = (id: string, provider: string, status: 'active' | 'disabled' = 'active') =>
    ({ id, provider, status, displayName: id }) as IPaymentConnection;

  it('chỉ lấy kết nối ApiPay, bỏ trùng, kết nối đang dùng lên trước', () => {
    const list = apiPayConnections([
      conn('a', 'apipay', 'disabled'),
      conn('s', 'sepay'),
      conn('b', 'apipay'),
      conn('a', 'apipay', 'disabled'),
    ]);
    expect(list.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('báo đã thêm / mặc định / lỗi', () => {
    expect(coreBankAccountText({ id: 'x', created: true, isDefault: true })).toMatch(
      /Đã thêm.*mặc định/
    );
    expect(coreBankAccountText({ id: 'x', created: false, isDefault: false })).toMatch(
      /đã bật lại/
    );
    expect(coreBankAccountText({ error: 'Thiếu BIN' })).toMatch(/Chưa thêm được.*Thiếu BIN/);
    expect(coreBankAccountText(null)).toBeNull();
  });
});
