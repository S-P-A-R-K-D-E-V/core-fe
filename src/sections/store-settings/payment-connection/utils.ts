import type {
  PaymentProvider,
  IPaymentQuotaUsage,
  IPaymentConnection,
  IPaymentProviderInfo,
  IPaymentProviderField,
  PaymentConnectionKind,
} from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Form kết nối thanh toán dựng từ danh mục GET payment/settings/providers (mục 7c): mỗi nhà cung cấp tự khai `fields`
// (khoá credentials, nhãn, bắt buộc, bí mật, kiểu ô). Không còn form cứng theo từng nhà.
//   - Tạo: ô bắt buộc phải có; ô trống không gửi.
//   - Cập nhật: mọi ô không bắt buộc; ô bí mật để trống = giữ nguyên; ô không bí mật điền sẵn từ publicSettings và chỉ
//     gửi khi đã đổi (giá trị che như "abcd…wxyz" của clientId không bị gửi ngược lên).
// ----------------------------------------------------------------------

export type CredentialValues = Record<string, string | boolean>;

export type ConnectionFormMode = 'create' | 'update';

/** Nhà cung cấp không cho cửa hàng chọn trên core-fe (ngân hàng giả lập chỉ dùng ở console spark-payment). */
export const HIDDEN_PROVIDER_KEYS: readonly string[] = ['mockbank'];

/** BIN NAPAS của ngân hàng kết nối trực tiếp — kết nối chưa gắn tài khoản chỉ dùng cho tài khoản CÙNG ngân hàng. */
export const BANK_DIRECT_BINS: Readonly<Record<string, string>> = {
  acb: '970416',
  mbbank: '970422',
  bidv: '970418',
  vietinbank: '970415',
};

export function visibleProviders(providers: IPaymentProviderInfo[]): IPaymentProviderInfo[] {
  return providers.filter((p) => !HIDDEN_PROVIDER_KEYS.includes(p.key));
}

// ---------------------------------------------------------------------- Trình hướng dẫn kết nối qua S Payment

export type ProviderGroup = {
  kind: string;
  title: string;
  description: string;
  providers: IPaymentProviderInfo[];
};

const PROVIDER_GROUPS: ReadonlyArray<Omit<ProviderGroup, 'providers'>> = [
  {
    kind: 'bank_direct',
    title: 'Ngân hàng trực tiếp',
    description:
      'S Payment nối thẳng Open API của ngân hàng — ngân hàng báo tiền về, không qua bên thứ ba.',
  },
  {
    kind: 'bank_feed',
    title: 'Biến động số dư qua bên thứ ba',
    description: 'ApiPay / SePay / Casso đọc biến động số dư tài khoản rồi báo về S Payment.',
  },
  {
    kind: 'gateway',
    title: 'Cổng thanh toán',
    description: 'Trang thanh toán cho đơn online (thẻ, ví, QR của cổng).',
  },
];

/** Dịch vụ cho cửa hàng chọn, gom theo nhóm (ngân hàng trực tiếp → bên thứ ba → cổng → khác); nhóm rỗng bỏ đi. */
export function groupProviders(providers: IPaymentProviderInfo[]): ProviderGroup[] {
  const selectable = visibleProviders(providers);
  const known = PROVIDER_GROUPS.map((g) => g.kind);
  const groups: ProviderGroup[] = PROVIDER_GROUPS.map((g) => ({
    ...g,
    providers: selectable.filter((p) => p.kind === g.kind),
  }));
  groups.push({
    kind: 'other',
    title: 'Khác',
    description: '',
    providers: selectable.filter((p) => !known.includes(p.kind)),
  });
  return groups.filter((g) => g.providers.length > 0);
}

/** Cổng thanh toán không nhận chuyển khoản vào tài khoản cửa hàng → bỏ bước chọn tài khoản nhận. */
export function needsReceivingAccount(provider: Pick<IPaymentProviderInfo, 'kind'>): boolean {
  return provider.kind !== 'gateway';
}

/** Ngân hàng trực tiếp: tên ngân hàng (ACB, VietinBank…) để ghi "mọi tài khoản VietinBank". */
export function bankDirectName(provider: Pick<IPaymentProviderInfo, 'key' | 'displayName'>): string {
  return provider.displayName.split(/\s+[—-]\s+/)[0];
}

/** Tên kết nối gợi ý: "VietinBank · 103885549137" (có tài khoản) hoặc tên nhà cung cấp. */
export function suggestedConnectionName(
  provider: Pick<IPaymentProviderInfo, 'key' | 'displayName'>,
  accountNumber?: string | null
): string {
  const name = bankDirectName(provider);
  return accountNumber ? `${name} · ${accountNumber}` : name;
}

/**
 * Nhà ngân hàng trực tiếp chỉ gắn được tài khoản của chính ngân hàng đó. null = dùng được; chuỗi = lý do không dùng được.
 * Không biết BIN tài khoản / nhà không phải ngân hàng trực tiếp → không chặn.
 */
export function providerUnavailableReason(
  provider: Pick<IPaymentProviderInfo, 'key' | 'kind' | 'displayName'>,
  accountBin: string | null | undefined
): string | null {
  if (provider.kind !== 'bank_direct') return null;
  const bin = BANK_DIRECT_BINS[provider.key];
  const accountBinTrimmed = accountBin?.trim();
  if (!bin || !accountBinTrimmed || bin === accountBinTrimmed) return null;
  return 'Chỉ dùng cho tài khoản mở tại chính ngân hàng này.';
}

/** Ô nhập kiểu mật khẩu (có nút hiện/ẩn). */
export function isSecretField(field: IPaymentProviderField): boolean {
  return (
    field.type !== 'boolean' &&
    field.type !== 'select' &&
    (field.secret || field.type === 'password')
  );
}

/** "true" / "True" / "1" của publicSettings (giá trị luôn là chuỗi) → boolean. */
export function settingToBoolean(value: string | null | undefined): boolean {
  return /^(true|1|yes)$/i.test((value ?? '').trim());
}

/** Giá trị ban đầu của form. Cập nhật: ô không bí mật lấy từ publicSettings; ô bí mật luôn trống. */
export function initialCredentialValues(
  fields: IPaymentProviderField[],
  mode: ConnectionFormMode,
  publicSettings?: Record<string, string> | null
): CredentialValues {
  const values: CredentialValues = {};
  fields.forEach((f) => {
    const saved = mode === 'update' && !f.secret ? publicSettings?.[f.key] : undefined;
    if (f.type === 'boolean') {
      values[f.key] = saved !== undefined ? settingToBoolean(saved) : false;
    } else if (f.secret) {
      values[f.key] = '';
    } else if (saved !== undefined) {
      values[f.key] = saved;
    } else if (mode === 'create' && f.type === 'select' && f.required) {
      values[f.key] = f.options?.[0] ?? '';
    } else {
      values[f.key] = '';
    }
  });
  return values;
}

const text = (value: string | boolean | undefined) =>
  typeof value === 'string' ? value.trim() : '';

/** Ô bắt buộc còn trống — chỉ chặn lúc tạo (cập nhật: ô trống = giữ nguyên). */
export function missingRequiredFields(
  fields: IPaymentProviderField[],
  values: CredentialValues,
  mode: ConnectionFormMode
): IPaymentProviderField[] {
  if (mode === 'update') return [];
  return fields.filter((f) => f.required && f.type !== 'boolean' && !text(values[f.key]));
}

/** credentials của POST: chuỗi đã cắt khoảng trắng (bỏ ô trống), boolean gửi nguyên. */
export function buildCreateCredentials(
  fields: IPaymentProviderField[],
  values: CredentialValues
): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  fields.forEach((f) => {
    const value = values[f.key];
    if (f.type === 'boolean') {
      out[f.key] = !!value;
      return;
    }
    const trimmed = text(value);
    if (trimmed) out[f.key] = trimmed;
  });
  return out;
}

/**
 * credentials của PUT: chỉ ô đã đổi so với lúc mở form. Ô chữ để trống = giữ nguyên (không gửi). Không có gì đổi →
 * undefined (bỏ hẳn key credentials).
 */
export function buildUpdateCredentials(
  fields: IPaymentProviderField[],
  values: CredentialValues,
  initial: CredentialValues
): Record<string, string | boolean> | undefined {
  const out: Record<string, string | boolean> = {};
  fields.forEach((f) => {
    const value = values[f.key];
    if (f.type === 'boolean') {
      if (!!value !== !!initial[f.key]) out[f.key] = !!value;
      return;
    }
    const trimmed = text(value);
    if (trimmed && trimmed !== text(initial[f.key])) out[f.key] = trimmed;
  });
  return Object.keys(out).length ? out : undefined;
}

/** Nhãn dễ đọc cho giá trị của ô chọn (danh mục chỉ trả mã). */
export const SELECT_OPTION_LABEL: Readonly<Record<string, string>> = {
  hmac: 'HMAC (chữ ký) — khuyên dùng',
  apikey: 'API key',
  basic: 'Basic auth (username / password)',
};

export function selectOptionLabel(value: string): string {
  return SELECT_OPTION_LABEL[value] ?? value;
}

export const CONNECTION_KIND_LABEL: Readonly<Record<string, string>> = {
  bank_direct: 'Ngân hàng trực tiếp',
  bank_feed: 'Biến động số dư',
  gateway: 'Cổng thanh toán',
};

export function connectionKindLabel(kind: PaymentConnectionKind | null | undefined): string {
  if (!kind) return '';
  return CONNECTION_KIND_LABEL[kind] ?? kind;
}

export function findProvider(
  providers: IPaymentProviderInfo[],
  key: PaymentProvider | null | undefined
): IPaymentProviderInfo | undefined {
  return key ? providers.find((p) => p.key === key) : undefined;
}

/** Nhãn của một khoá credentials (generatedSecrets, missingSettings) theo danh mục; không có thì hiện khoá. */
export function credentialLabel(provider: IPaymentProviderInfo | undefined, key: string): string {
  return provider?.fields.find((f) => f.key === key)?.label ?? key;
}

export type WebhookUrlEntry = { key: string; label: string; url: string };

/** Mọi URL webhook của kết nối (webhookUrls; BE cũ chỉ có webhookUrl). */
export function webhookUrlEntries(
  connection: Pick<IPaymentConnection, 'webhookUrl' | 'webhookUrls'>
): WebhookUrlEntry[] {
  const urls = connection.webhookUrls ?? {};
  const entries = Object.entries(urls).filter(([, url]) => !!url);
  const list = entries.length
    ? entries
    : connection.webhookUrl
      ? [['default', connection.webhookUrl]]
      : [];
  return list.map(([key, url]) => ({
    key,
    url,
    label: key === 'default' || list.length === 1 ? 'Webhook URL' : `Webhook URL · ${key}`,
  }));
}

export function hasGeneratedSecrets(
  connection: Pick<IPaymentConnection, 'generatedSecrets'> | null | undefined
): boolean {
  return !!connection?.generatedSecrets && Object.keys(connection.generatedSecrets).length > 0;
}

/** Kéo giao dịch ngay chỉ có ở nguồn đọc biến động số dư (SePay / Casso). */
export const canSync = (c: Pick<IPaymentConnection, 'kind' | 'provider'>) =>
  c.kind === 'bank_feed' || (!c.kind && (c.provider === 'sepay' || c.provider === 'casso'));

/** Kiểm tra kết nối / tạo lại khoá webhook chỉ có ở ngân hàng trực tiếp. */
export const isBankDirect = (c: Pick<IPaymentConnection, 'kind'>) => c.kind === 'bank_direct';

// ---------------------------------------------------------------------- Hạn mức gói ApiPay

/** Chỉ ApiPay có hạn mức giao dịch theo gói (tính cho cả tài khoản ApiPay). */
export const hasQuota = (c: Pick<IPaymentConnection, 'provider'>) => c.provider === 'apipay';

/** "2026-10-15" → "15/10" (đọc thẳng chuỗi, không qua múi giờ trình duyệt). */
export function cycleDayMonth(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  return m ? `${m[3]}/${m[2]}` : date;
}

export type QuotaUsageView = {
  /** "Đã dùng 49 / 60 GD · chu kỳ 15/10 → 15/11 · còn 11" */
  summary: string;
  /** 0–100 cho thanh tiến độ (vượt thì 100) */
  percent: number;
  color: 'primary' | 'warning' | 'error';
  /** Cảnh báo khi sắp hết / đã vượt */
  warning: string | null;
  /** Ghi chú: ước tính + kết nối dùng chung */
  note: string;
};

const OVERAGE_FEE = 'trừ phí vượt (350đ/GD hoặc theo giá gói) vào số dư trả trước';

export function quotaUsageView(u: IPaymentQuotaUsage): QuotaUsageView {
  const over = Math.max(0, u.used - u.quota);
  const percent = u.quota > 0 ? Math.min(100, Math.round((u.used * 100) / u.quota)) : 100;
  const tail = over > 0 ? `vượt ${over}` : `còn ${u.remaining}`;
  const shared =
    u.connections > 1 ? ` Cộng chung ${u.connections} kết nối dùng cùng tài khoản ApiPay.` : '';
  return {
    summary: `Đã dùng ${u.used} / ${u.quota} GD · chu kỳ ${cycleDayMonth(u.cycleStart)} → ${cycleDayMonth(u.cycleEnd)} · ${tail}`,
    percent,
    color: u.status === 'exceeded' ? 'error' : u.status === 'warning' ? 'warning' : 'primary',
    warning:
      u.status === 'exceeded'
        ? `Đã vượt hạn mức gói — ApiPay vẫn báo tiền về bình thường, nhưng ${OVERAGE_FEE} trên my.apipay.vn. Nạp số dư hoặc nâng gói nếu cần.`
        : u.status === 'warning'
          ? `Sắp hết hạn mức gói — vượt thì ApiPay vẫn chạy nhưng ${OVERAGE_FEE}.`
          : null,
    note: `Ước tính từ giao dịch đã ghi nhận — số chính xác xem my.apipay.vn → Tổng quan.${shared}`,
  };
}
