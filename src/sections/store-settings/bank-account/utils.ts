import type { IVietQRBank, IKiotVietBankAccount } from 'src/types/corecms-api';
import type { IPaymentConnection, IBankAccountWithConnections } from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Tài khoản ngân hàng của cửa hàng (mục 7c): dòng KiotViet đồng bộ chỉ đọc, dòng cửa hàng tự khai sửa / tắt được.
// Giới hạn nhập khớp core-be (BankAccountRules): BIN 6 số, số tài khoản 3–30 chữ số hoặc chữ cái, chủ tài khoản ≤ 200,
// ghi chú ≤ 500.
// ----------------------------------------------------------------------

export const ACCOUNT_NUMBER_MIN = 3;
export const ACCOUNT_NUMBER_MAX = 30;
export const ACCOUNT_HOLDER_MAX = 200;
export const DESCRIPTION_MAX = 500;
/** Nội dung chuyển khoản của VietQR tối đa 25 ký tự (trường con 62.08 của EMVCo) — core-be cắt bớt nếu dài hơn. */
export const VIETQR_CONTENT_MAX = 25;

const lower = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

/** Ngân hàng VietQR của một tài khoản: khớp BIN trước, rồi mã ngân hàng (VCB, TCB…), rồi tên viết tắt. */
export function findVietQRBank(
  banks: IVietQRBank[],
  account: { bin?: string | null; code?: string | null; shortName?: string | null }
): IVietQRBank | undefined {
  const bin = (account.bin ?? '').trim();
  if (bin) {
    const byBin = banks.find((b) => b.bin === bin);
    if (byBin) return byBin;
  }
  const code = lower(account.code);
  if (code) {
    const byCode = banks.find((b) => lower(b.code) === code);
    if (byCode) return byCode;
  }
  const shortName = lower(account.shortName);
  if (shortName)
    return banks.find((b) => lower(b.shortName) === shortName || lower(b.code) === shortName);
  return undefined;
}

/** Bỏ dấu tiếng Việt (đ → d) để tìm kiếm / chuẩn hoá tên chủ tài khoản. */
export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** Tên chủ tài khoản như trên app ngân hàng: viết hoa, không dấu, một khoảng trắng giữa các chữ. */
export function normalizeAccountHolder(value: string): string {
  return stripDiacritics(value).toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Số tài khoản: chỉ giữ chữ số và chữ cái (tài khoản định danh) — bỏ khoảng trắng, dấu chấm, gạch nối. */
export function sanitizeAccountNumber(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, '').slice(0, ACCOUNT_NUMBER_MAX);
}

/** Lọc ô chọn ngân hàng: tên viết tắt, tên đầy đủ, mã, BIN — không phân biệt dấu / hoa thường. */
export function matchesBankQuery(bank: IVietQRBank, query: string): boolean {
  const q = stripDiacritics(query).toLowerCase().trim();
  if (!q) return true;
  return [bank.shortName, bank.name, bank.code, bank.bin].some((v) =>
    stripDiacritics(v ?? '')
      .toLowerCase()
      .includes(q)
  );
}

export type BankAccountFormValues = {
  bin: string;
  bankName: string;
  shortName: string;
  accountNumber: string;
  accountHolder: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
};

export type BankAccountFormField = 'bank' | 'accountNumber' | 'accountHolder' | 'description';

export type BankAccountFormErrors = Partial<Record<BankAccountFormField, string>>;

/** Kiểm tra phía trình duyệt — cùng luật với validator core-be để báo lỗi ngay tại ô. */
export function validateBankAccountForm(values: BankAccountFormValues): BankAccountFormErrors {
  const errors: BankAccountFormErrors = {};
  if (!/^[0-9]{6}$/.test(values.bin.trim()) || !values.bankName.trim())
    errors.bank = 'Chọn ngân hàng.';

  const number = sanitizeAccountNumber(values.accountNumber);
  if (!number) errors.accountNumber = 'Nhập số tài khoản.';
  else if (number.length < ACCOUNT_NUMBER_MIN || number !== values.accountNumber.replace(/\s/g, ''))
    errors.accountNumber = `Số tài khoản gồm ${ACCOUNT_NUMBER_MIN}–${ACCOUNT_NUMBER_MAX} chữ số hoặc chữ cái, không có dấu hay ký tự đặc biệt.`;

  const holder = values.accountHolder.trim();
  if (!holder) errors.accountHolder = 'Nhập tên chủ tài khoản.';
  else if (holder.length > ACCOUNT_HOLDER_MAX)
    errors.accountHolder = `Tối đa ${ACCOUNT_HOLDER_MAX} ký tự.`;

  if (values.description.trim().length > DESCRIPTION_MAX)
    errors.description = `Tối đa ${DESCRIPTION_MAX} ký tự.`;
  return errors;
}

/**
 * Lỗi validation của core-be (ValidationProblem: errors theo tên thuộc tính — Bin, AccountNumber…) → lỗi theo ô.
 * Lỗi không thuộc ô nào (trùng tài khoản, tài khoản KiotViet…) để phần chung hiện.
 */
export function fieldErrorsFromProblem(err: unknown): BankAccountFormErrors {
  const errors: BankAccountFormErrors = {};
  const source = (err as { errors?: unknown } | null)?.errors;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return errors;

  Object.entries(source as Record<string, unknown>).forEach(([rawKey, messages]) => {
    const message = (Array.isArray(messages) ? messages : [messages]).find(
      (m) => typeof m === 'string' && m
    );
    if (typeof message !== 'string') return;
    const key = rawKey.replace(/^\$\./, '').toLowerCase();
    let field: BankAccountFormField | null = null;
    if (key === 'bin' || key === 'bankname' || key === 'shortname') field = 'bank';
    else if (key === 'accountnumber') field = 'accountNumber';
    else if (key === 'accountholder') field = 'accountHolder';
    else if (key === 'description') field = 'description';
    if (field && !errors[field]) errors[field] = message;
  });
  return errors;
}

/** Dòng của GET /bank-accounts hoặc GET payment/bank-accounts — mọi trường (trừ id) có thể thiếu / null. */
type RawBankAccount = { id: string } & {
  [K in Exclude<keyof IKiotVietBankAccount, 'id'>]?: IKiotVietBankAccount[K] | null;
} & {
  qrMode?: IBankAccountWithConnections['qrMode'] | null;
  isManagedByKiotViet?: boolean | null;
  connections?: IPaymentConnection[] | null;
};

/**
 * Một dòng tài khoản về cùng dạng BankAccountWithConnections: GET payment/bank-accounts đã đúng dạng; GET /bank-accounts
 * (dịch vụ thanh toán tắt) không có kết nối và tên cờ KiotViet là `managedByKiotViet`.
 */
export function normalizeBankAccount(raw: RawBankAccount): IBankAccountWithConnections {
  return {
    id: raw.id,
    kiotVietId: raw.kiotVietId ?? null,
    bankName: raw.bankName ?? null,
    shortName: raw.shortName ?? null,
    code: raw.code ?? null,
    bin: raw.bin ?? null,
    accountNumber: raw.accountNumber ?? null,
    accountHolder: raw.accountHolder ?? null,
    description: raw.description ?? null,
    isDefault: !!raw.isDefault,
    isActive: raw.isActive !== false,
    isManagedByKiotViet: !!(raw.isManagedByKiotViet ?? raw.managedByKiotViet),
    qrMode: raw.qrMode === 'bank_direct' ? 'bank_direct' : 'vietqr',
    connections: raw.connections ?? [],
  };
}

/** Tên ngắn của ngân hàng để hiện (tên viết tắt → tên đầy đủ). */
export function bankAccountBankLabel(
  account: Pick<IBankAccountWithConnections, 'shortName' | 'bankName'>,
  bank?: IVietQRBank
): string {
  return account.shortName || bank?.shortName || account.bankName || bank?.name || 'Ngân hàng';
}

/** Một dòng mô tả tài khoản cho ô chọn: "VCB · 0123456789 · NGUYEN VAN A". */
export function bankAccountOptionLabel(
  account: Pick<
    IBankAccountWithConnections,
    'shortName' | 'bankName' | 'accountNumber' | 'accountHolder' | 'description'
  >
): string {
  return [
    account.shortName || account.bankName,
    account.accountNumber,
    account.accountHolder || account.description,
  ]
    .filter(Boolean)
    .join(' · ');
}
