import type { IBankLink, BankLinkAccountType } from 'src/types/payment-service';

import { normalizeMobile, toBankAccountName } from '../apipay-bank-link/utils';

// ----------------------------------------------------------------------
// Đăng ký báo có qua S Payment (kiểu KiotViet): luật form giống máy chủ (spark-payment BankLinkService.Validate) để báo
// lỗi tại chỗ — máy chủ vẫn kiểm lại. Không nhắc lại giá trị đã nhập trong câu lỗi.
// ----------------------------------------------------------------------

export { normalizeMobile, toBankAccountName };

/** Ngân hàng đăng ký báo có được, theo BIN tài khoản của cửa hàng. */
export const BANK_LINK_BINS: Record<string, string> = {
  '970415': 'vietinbank',
  '970422': 'mbbank',
};

export function bankLinkCodeOf(bin: string | null | undefined): string | null {
  return (bin && BANK_LINK_BINS[bin.trim()]) || null;
}

export const ACCOUNT_TYPE_LABELS: Record<BankLinkAccountType, string> = {
  individual: 'Cá nhân',
  household: 'Hộ kinh doanh',
  business: 'Doanh nghiệp',
};

/** Cá nhân: giấy tờ tuỳ thân; hộ kinh doanh / doanh nghiệp: mã số thuế hoặc số đăng ký kinh doanh (như KiotViet). */
export function identityLabel(type: BankLinkAccountType | ''): string {
  return type === 'individual' ? 'Số CCCD / CMND / Hộ chiếu' : 'Mã số thuế / Số ĐKKD';
}

/** Thời gian chờ trước khi cho gửi lại OTP. */
export const OTP_RESEND_SECONDS = 120;

export type RegisterFormValues = {
  bank: string;
  accountNumber: string;
  accountName: string;
  accountType: BankLinkAccountType | '';
  identity: string;
  mobile: string;
};

export const EMPTY_REGISTER_FORM: RegisterFormValues = {
  bank: '',
  accountNumber: '',
  accountName: '',
  accountType: '',
  identity: '',
  mobile: '',
};

export function cleanAccountNumber(value: string): string {
  return value.replace(/[\s.-]/g, '');
}

export function cleanIdentity(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}

export function identityError(type: BankLinkAccountType | '', value: string): string | undefined {
  const id = cleanIdentity(value);
  if (!id) return `Nhập ${identityLabel(type).toLowerCase()}`;
  if (type === 'individual') {
    return /^(\d{12}|\d{9}|[A-Z]{1,2}\d{6,8})$/.test(id)
      ? undefined
      : 'CCCD 12 số, CMND 9 số hoặc số hộ chiếu';
  }
  return /^[A-Z0-9-]{6,20}$/.test(id)
    ? undefined
    : 'Mã số thuế / số ĐKKD: 6–20 chữ số, chữ cái, dấu gạch';
}

export function mobileError(value: string): string | undefined {
  return /^0\d{9}$/.test(normalizeMobile(value))
    ? undefined
    : 'SĐT di động 10 số, đúng số đã đăng ký tại ngân hàng';
}

export function registerFormErrors(
  v: RegisterFormValues
): Partial<Record<keyof RegisterFormValues, string>> {
  const errors: Partial<Record<keyof RegisterFormValues, string>> = {};
  if (!v.bank) errors.bank = 'Chọn ngân hàng';
  if (!/^\d{6,20}$/.test(cleanAccountNumber(v.accountNumber))) {
    errors.accountNumber = 'Số tài khoản gồm 6–20 chữ số';
  }
  const name = toBankAccountName(v.accountName);
  if (!name) errors.accountName = 'Nhập tên chủ tài khoản';
  else if (name.length > 100) errors.accountName = 'Tối đa 100 ký tự';
  if (!v.accountType) errors.accountType = 'Chọn loại tài khoản';
  const id = identityError(v.accountType, v.identity);
  if (id) errors.identity = id;
  const mobile = mobileError(v.mobile);
  if (mobile) errors.mobile = mobile;
  return errors;
}

export function isOtp(value: string): boolean {
  return /^\d{4,8}$/.test(value.trim());
}

/** Giây còn lại trước khi gửi lại OTP được (0 = được gửi lại). */
export function resendSecondsLeft(otpSentAt: string | null | undefined, now: number): number {
  if (!otpSentAt) return 0;
  const sent = Date.parse(otpSentAt);
  if (Number.isNaN(sent)) return 0;
  return Math.max(0, Math.ceil((sent + OTP_RESEND_SECONDS * 1000 - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function bankLinkStatus(link: IBankLink): {
  label: string;
  color: 'success' | 'warning' | 'default';
} {
  switch (link.status) {
    case 'active':
      return { label: 'Đã báo có', color: 'success' };
    case 'otp_required':
      return { label: 'Chờ xác thực OTP', color: 'warning' };
    case 'revoking':
      return { label: 'Đang huỷ — chờ OTP', color: 'warning' };
    default:
      return { label: 'Đã huỷ', color: 'default' };
  }
}

/** Đã báo có lên trước, rồi theo ngày đăng ký mới nhất. */
export function sortBankLinks(links: IBankLink[]): IBankLink[] {
  const rank = (l: IBankLink) => (l.status === 'active' ? 0 : l.status === 'revoking' ? 1 : 2);
  return [...links].sort(
    (a, b) => rank(a) - rank(b) || Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}
