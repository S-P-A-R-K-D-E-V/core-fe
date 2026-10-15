import type {
  IPaymentConnection,
  ApiPayAccountType,
  IApiPayLinkedBank,
  IApiPayCoreBankAccount,
} from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Liên kết ngân hàng qua ApiPay — luật theo docs.apipay.vn "How to Connect Banks" / "Bank Management": loại tài khoản
// từng ngân hàng nhận, CCCD hay mã số thuế, ACB OneBiz, ngân hàng kích hoạt thủ công, ngân hàng cấp tài khoản ảo (VA).
// Máy chủ kiểm lại mọi thứ; ở đây chỉ để form hỏi đúng và báo trước.
// ----------------------------------------------------------------------

export const BIN = {
  ACB: '970416',
  MB: '970422',
  BIDV: '970418',
  OCB: '970448',
  VIETINBANK: '970415',
  VIB: '970441',
  SACOMBANK: '970403',
  VPBANK: '970432',
  PGBANK: '970430',
  SHINHAN: '970424',
  COOPBANK: '970446',
  VIETCOMBANK: '970436',
  MSB: '970426',
  TPBANK: '970423',
} as const;

export const ACCOUNT_TYPE_OPTIONS: { value: ApiPayAccountType; label: string }[] = [
  { value: 'personal-account', label: 'Cá nhân' },
  { value: 'business-account', label: 'Doanh nghiệp' },
  { value: 'business-household-account', label: 'Hộ kinh doanh' },
];

/** Vietcombank không nhận cá nhân, Shinhan không nhận hộ kinh doanh, Sacombank không nhận doanh nghiệp. */
export function accountTypesFor(bin: string | null | undefined): ApiPayAccountType[] {
  switch (bin) {
    case BIN.VIETCOMBANK:
      return ['business-account', 'business-household-account'];
    case BIN.SHINHAN:
      return ['personal-account', 'business-account'];
    case BIN.SACOMBANK:
      return ['personal-account', 'business-household-account'];
    default:
      return ACCOUNT_TYPE_OPTIONS.map((o) => o.value);
  }
}

/** ACB doanh nghiệp / hộ kinh doanh cần tên đăng nhập ACB OneBiz. */
export function needsAcbUserId(
  bin: string | null | undefined,
  type: ApiPayAccountType | ''
): boolean {
  return bin === BIN.ACB && !!type && type !== 'personal-account';
}

/** Ô CCCD / mã số thuế: null = không cần (ACB cá nhân). */
export function identityLabel(
  bin: string | null | undefined,
  type: ApiPayAccountType | ''
): string | null {
  if (!type) return 'Số CCCD / mã số thuế';
  if (bin === BIN.ACB && type === 'personal-account') return null;
  if (type === 'personal-account') return 'Số CCCD của chủ tài khoản (12 số)';
  if (type === 'business-household-account' && (bin === BIN.MB || bin === BIN.VPBANK)) {
    return 'Số CCCD của chủ hộ kinh doanh (12 số)';
  }
  if (type === 'business-household-account') return 'Mã số thuế hộ kinh doanh (hoặc CCCD chủ hộ)';
  return 'Mã số thuế doanh nghiệp';
}

/** ApiPay liên hệ chủ tài khoản để kích hoạt (tới 24 giờ), không có bước OTP. */
export function isManualActivation(
  bin: string | null | undefined,
  type: ApiPayAccountType | ''
): boolean {
  if (!bin || !type) return false;
  if (bin === BIN.MSB || bin === BIN.TPBANK || bin === BIN.VIETCOMBANK) return true;
  if (type !== 'business-account') return false;
  return [BIN.OCB, BIN.VPBANK, BIN.BIDV, BIN.VIETINBANK, BIN.SHINHAN].includes(bin as never);
}

/** Ngân hàng ApiPay cấp tài khoản ảo (VA): QR phải in số VA thì ApiPay mới báo tiền về. */
export function issuesVirtualAccount(bin: string | null | undefined): boolean {
  return [
    BIN.MB,
    BIN.BIDV,
    BIN.OCB,
    BIN.VIB,
    BIN.SACOMBANK,
    BIN.VPBANK,
    BIN.SHINHAN,
    BIN.COOPBANK,
    BIN.TPBANK,
  ].includes(bin as never);
}

/** Tên chủ tài khoản như trên app ngân hàng: in hoa, không dấu (đ → D), một khoảng trắng giữa các từ. */
export function toBankAccountName(value: string): string {
  return value
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** SĐT: bỏ khoảng trắng / dấu chấm / gạch; +84 hoặc 84 đầu số → 0. */
export function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (value.trim().startsWith('+') || (digits.startsWith('84') && digits.length >= 11)) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export type LinkFormValues = {
  bankBin: string;
  accountType: ApiPayAccountType | '';
  accountNumber: string;
  accountName: string;
  mobile: string;
  identity: string;
  acbUserId: string;
  nickname: string;
};

export const EMPTY_LINK_FORM: LinkFormValues = {
  bankBin: '',
  accountType: '',
  accountNumber: '',
  accountName: '',
  mobile: '',
  identity: '',
  acbUserId: '',
  nickname: '',
};

/** Lỗi theo ô (rỗng = hợp lệ). Không nhắc lại giá trị đã nhập. */
export function linkFormErrors(v: LinkFormValues): Partial<Record<keyof LinkFormValues, string>> {
  const errors: Partial<Record<keyof LinkFormValues, string>> = {};
  if (!v.bankBin) errors.bankBin = 'Chọn ngân hàng';
  if (!v.accountType) errors.accountType = 'Chọn loại tài khoản';
  else if (v.bankBin && !accountTypesFor(v.bankBin).includes(v.accountType)) {
    errors.accountType = 'Ngân hàng này không nhận loại tài khoản đã chọn';
  }
  if (!/^[A-Za-z0-9]{3,30}$/.test(v.accountNumber.replace(/\s/g, ''))) {
    errors.accountNumber = 'Số tài khoản gồm 3–30 chữ số hoặc chữ cái';
  }
  if (!toBankAccountName(v.accountName)) errors.accountName = 'Nhập tên chủ tài khoản';
  if (!/^0\d{9,10}$/.test(normalizeMobile(v.mobile))) {
    errors.mobile = 'SĐT đăng ký với ngân hàng: 10–11 số, bắt đầu bằng 0';
  }
  const identity = v.identity.replace(/\s/g, '');
  if (identityLabel(v.bankBin, v.accountType) !== null && !identity) {
    errors.identity = 'Bắt buộc với ngân hàng và loại tài khoản này';
  } else if (identity && !/^[A-Za-z0-9-]{9,20}$/.test(identity)) {
    errors.identity = 'Chỉ gồm chữ số, chữ cái và dấu gạch (9–20 ký tự)';
  }
  if (needsAcbUserId(v.bankBin, v.accountType) && !v.acbUserId.trim()) {
    errors.acbUserId = 'Nhập tên đăng nhập ACB OneBiz';
  }
  if (v.nickname.trim().length > 50) errors.nickname = 'Tối đa 50 ký tự';
  return errors;
}

export function isOtp(value: string): boolean {
  return /^\d{4,8}$/.test(value.trim());
}

export function linkedBankStatus(b: IApiPayLinkedBank): {
  label: string;
  color: 'success' | 'warning' | 'default';
} {
  if (b.status === 'active') return { label: 'Đang hoạt động', color: 'success' };
  if (b.status === 'inactive') return { label: 'Đang tắt trên ApiPay', color: 'default' };
  return b.manualActivationPending
    ? { label: 'Chờ ApiPay kích hoạt', color: 'warning' }
    : { label: 'Chờ xác nhận OTP', color: 'warning' };
}

export function isApiPayConnection(c: IPaymentConnection): boolean {
  return c.provider === 'apipay';
}

/** Kết nối ApiPay, bỏ trùng theo id, kết nối đang dùng lên trước. */
export function apiPayConnections(connections: IPaymentConnection[]): IPaymentConnection[] {
  const byId = new Map<string, IPaymentConnection>();
  connections.filter(isApiPayConnection).forEach((c) => {
    if (!byId.has(c.id)) byId.set(c.id, c);
  });
  return Array.from(byId.values()).sort(
    (a, b) => Number(b.status === 'active') - Number(a.status === 'active')
  );
}

export function apiPayConnectionLabel(c: IPaymentConnection): string {
  const env = c.publicSettings?.environment === 'test' ? ' (thử nghiệm)' : '';
  const account = c.bankAccount?.accountNumber ? ` · nhận vào ${c.bankAccount.accountNumber}` : '';
  return `${c.displayName}${env}${account}${c.status === 'active' ? '' : ' · đã tắt'}`;
}

/** Câu báo kết quả thêm tài khoản ngân hàng cho POS (core-be). */
export function coreBankAccountText(
  sync: IApiPayCoreBankAccount | null | undefined
): string | null {
  if (!sync) return null;
  if (sync.error) return `Chưa thêm được vào Tài khoản ngân hàng: ${sync.error}`;
  const base = sync.created
    ? 'Đã thêm vào Tài khoản ngân hàng của cửa hàng'
    : 'Tài khoản đã có trong Tài khoản ngân hàng của cửa hàng (đã bật lại)';
  return sync.isDefault
    ? `${base} — là tài khoản mặc định khi thu chuyển khoản.`
    : `${base} — chọn ở màn bán hàng, hoặc đặt làm mặc định ở tab Tài khoản ngân hàng.`;
}
