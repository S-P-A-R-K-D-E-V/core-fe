import { describe, expect, it } from 'vitest';

import type { IVietQRBank } from 'src/types/corecms-api';

import {
  findVietQRBank,
  matchesBankQuery,
  normalizeBankAccount,
  sanitizeAccountNumber,
  bankAccountBankLabel,
  fieldErrorsFromProblem,
  normalizeAccountHolder,
  bankAccountOptionLabel,
  validateBankAccountForm,
} from '../utils';

import type { BankAccountFormValues } from '../utils';

// ----------------------------------------------------------------------
// Tài khoản ngân hàng: khớp ngân hàng VietQR theo BIN, chuẩn hoá ô nhập theo luật core-be, lỗi ProblemDetails theo ô,
// gộp hai dạng response (GET /bank-accounts và GET payment/bank-accounts).
// ----------------------------------------------------------------------

const bank = (
  b: Partial<IVietQRBank> & Pick<IVietQRBank, 'bin' | 'code' | 'shortName'>
): IVietQRBank => ({
  id: Number(b.bin),
  name: `Ngân hàng ${b.shortName}`,
  logo: `https://cdn/${b.code}.png`,
  transferSupported: 1,
  lookupSupported: 1,
  ...b,
});

const VCB = bank({
  bin: '970436',
  code: 'VCB',
  shortName: 'Vietcombank',
  name: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
});
const ACB = bank({ bin: '970416', code: 'ACB', shortName: 'ACB', name: 'Ngân hàng TMCP Á Châu' });
const MB = bank({
  bin: '970422',
  code: 'MB',
  shortName: 'MBBank',
  name: 'Ngân hàng TMCP Quân đội',
});
const BANKS = [VCB, ACB, MB];

describe('findVietQRBank', () => {
  it('khớp BIN trước (kể cả khoảng trắng thừa)', () => {
    expect(findVietQRBank(BANKS, { bin: '970416' })).toBe(ACB);
    expect(findVietQRBank(BANKS, { bin: ' 970422 ', code: 'VCB' })).toBe(MB);
  });

  it('BIN lạ / thiếu → theo mã ngân hàng rồi tên viết tắt, không phân biệt hoa thường', () => {
    expect(findVietQRBank(BANKS, { bin: '999999', code: 'vcb' })).toBe(VCB);
    expect(findVietQRBank(BANKS, { shortName: 'mbbank' })).toBe(MB);
    // Dòng KiotViet hay ghi tên viết tắt bằng mã
    expect(findVietQRBank(BANKS, { shortName: 'ACB' })).toBe(ACB);
  });

  it('không khớp gì → undefined', () => {
    expect(findVietQRBank(BANKS, { bin: '111111' })).toBeUndefined();
    expect(findVietQRBank(BANKS, {})).toBeUndefined();
    expect(findVietQRBank([], { bin: '970436' })).toBeUndefined();
  });
});

describe('matchesBankQuery', () => {
  it('tìm theo tên viết tắt / tên đầy đủ / mã / BIN, không dấu', () => {
    expect(matchesBankQuery(MB, 'quan doi')).toBe(true);
    expect(matchesBankQuery(MB, 'Quân Đội')).toBe(true);
    expect(matchesBankQuery(VCB, 'ngoai thuong')).toBe(true);
    expect(matchesBankQuery(VCB, '970436')).toBe(true);
    expect(matchesBankQuery(VCB, 'vcb')).toBe(true);
    expect(matchesBankQuery(ACB, 'quan doi')).toBe(false);
    expect(matchesBankQuery(ACB, '   ')).toBe(true);
  });
});

describe('normalizeAccountHolder / sanitizeAccountNumber', () => {
  it('chủ tài khoản: viết hoa, bỏ dấu (đ → D), gộp khoảng trắng', () => {
    expect(normalizeAccountHolder('  Nguyễn  Văn   Đức ')).toBe('NGUYEN VAN DUC');
    expect(normalizeAccountHolder('công ty tnhh cici')).toBe('CONG TY TNHH CICI');
  });

  it('số tài khoản: bỏ khoảng trắng / dấu chấm / gạch nối, giữ chữ cái (tài khoản định danh), tối đa 30', () => {
    expect(sanitizeAccountNumber('0123 456.789-0')).toBe('01234567890');
    expect(sanitizeAccountNumber('CICI68shop')).toBe('CICI68shop');
    expect(sanitizeAccountNumber('1'.repeat(40))).toHaveLength(30);
  });
});

describe('validateBankAccountForm', () => {
  const valid: BankAccountFormValues = {
    bin: '970436',
    bankName: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
    shortName: 'Vietcombank',
    accountNumber: '0123456789',
    accountHolder: 'NGUYEN VAN A',
    description: '',
    isDefault: false,
    isActive: true,
  };

  it('hợp lệ → không lỗi', () => {
    expect(validateBankAccountForm(valid)).toEqual({});
  });

  it('chưa chọn ngân hàng / BIN sai', () => {
    expect(validateBankAccountForm({ ...valid, bin: '', bankName: '' }).bank).toBeTruthy();
    expect(validateBankAccountForm({ ...valid, bin: '97043' }).bank).toBeTruthy();
  });

  it('số tài khoản: trống, quá ngắn, có ký tự đặc biệt', () => {
    expect(validateBankAccountForm({ ...valid, accountNumber: '' }).accountNumber).toBe(
      'Nhập số tài khoản.'
    );
    expect(validateBankAccountForm({ ...valid, accountNumber: '12' }).accountNumber).toMatch(
      /3–30/
    );
    expect(validateBankAccountForm({ ...valid, accountNumber: '123#456' }).accountNumber).toMatch(
      /3–30/
    );
  });

  it('chủ tài khoản bắt buộc, ghi chú tối đa 500 ký tự', () => {
    expect(validateBankAccountForm({ ...valid, accountHolder: '  ' }).accountHolder).toBeTruthy();
    expect(
      validateBankAccountForm({ ...valid, description: 'x'.repeat(501) }).description
    ).toBeTruthy();
  });
});

describe('fieldErrorsFromProblem', () => {
  it('ValidationProblem của core-be (khoá = tên thuộc tính) → lỗi theo ô', () => {
    const err = {
      title: 'One or more validation errors occurred.',
      errors: {
        Bin: ['Mã BIN ngân hàng gồm đúng 6 chữ số (ví dụ 970436).'],
        AccountNumber: [
          'Số tài khoản gồm 3–30 chữ số hoặc chữ cái, không có dấu hay ký tự đặc biệt.',
        ],
        '$.accountHolder': ['The JSON value could not be converted.'],
      },
    };
    expect(fieldErrorsFromProblem(err)).toEqual({
      bank: 'Mã BIN ngân hàng gồm đúng 6 chữ số (ví dụ 970436).',
      accountNumber: 'Số tài khoản gồm 3–30 chữ số hoặc chữ cái, không có dấu hay ký tự đặc biệt.',
      accountHolder: 'The JSON value could not be converted.',
    });
  });

  it('lỗi không thuộc ô nào (trùng tài khoản, mặc định khi đang tắt) / không phải ValidationProblem → {}', () => {
    expect(
      fieldErrorsFromProblem({ errors: { 'BankAccount.InactiveCannotBeDefault': ['…'] } })
    ).toEqual({});
    expect(
      fieldErrorsFromProblem({
        title: 'Tài khoản ngân hàng này đã có…',
        errorCodes: ['BankAccount.Duplicate'],
      })
    ).toEqual({});
    expect(fieldErrorsFromProblem('Something went wrong')).toEqual({});
    expect(fieldErrorsFromProblem(null)).toEqual({});
  });
});

describe('normalizeBankAccount', () => {
  it('GET /bank-accounts (dịch vụ tắt): cờ KiotViet tên managedByKiotViet, không có kết nối → VietQR', () => {
    const a = normalizeBankAccount({
      id: 'a1',
      kiotVietId: 12,
      bankName: 'Vietcombank',
      bin: '970436',
      accountNumber: '0123',
      managedByKiotViet: true,
      isDefault: true,
    });
    expect(a).toMatchObject({
      id: 'a1',
      isManagedByKiotViet: true,
      isDefault: true,
      isActive: true,
      qrMode: 'vietqr',
      connections: [],
      accountHolder: null,
    });
  });

  it('GET payment/bank-accounts: giữ qrMode, connections, isActive = false', () => {
    const conn = {
      id: 'c1',
      provider: 'acb',
      kind: 'bank_direct',
      displayName: 'ACB',
      status: 'active',
      webhookUrl: 'u',
      createdAt: '',
    } as const;
    const a = normalizeBankAccount({
      id: 'a2',
      isActive: false,
      isManagedByKiotViet: false,
      qrMode: 'bank_direct',
      connections: [conn],
    });
    expect(a.isActive).toBe(false);
    expect(a.isManagedByKiotViet).toBe(false);
    expect(a.qrMode).toBe('bank_direct');
    expect(a.connections).toEqual([conn]);
  });
});

describe('nhãn tài khoản', () => {
  it('tên ngắn ngân hàng: shortName → VietQR → bankName', () => {
    expect(bankAccountBankLabel({ shortName: 'VCB', bankName: 'Vietcombank' })).toBe('VCB');
    expect(bankAccountBankLabel({ shortName: null, bankName: 'Ngân hàng X' }, VCB)).toBe(
      'Vietcombank'
    );
    expect(bankAccountBankLabel({ shortName: null, bankName: null })).toBe('Ngân hàng');
  });

  it('dòng chọn tài khoản: ngân hàng · số · chủ tài khoản (hoặc ghi chú)', () => {
    expect(
      bankAccountOptionLabel({
        shortName: 'ACB',
        bankName: null,
        accountNumber: '123',
        accountHolder: 'NGUYEN A',
        description: 'Quầy 1',
      })
    ).toBe('ACB · 123 · NGUYEN A');
    expect(
      bankAccountOptionLabel({
        shortName: null,
        bankName: 'MB',
        accountNumber: '456',
        accountHolder: null,
        description: 'Quầy 2',
      })
    ).toBe('MB · 456 · Quầy 2');
  });
});
