import { describe, expect, it } from 'vitest';

import type { IPaymentProviderInfo, IPaymentProviderField } from 'src/types/payment-service';

import {
  canSync,
  isBankDirect,
  isSecretField,
  credentialLabel,
  settingToBoolean,
  visibleProviders,
  webhookUrlEntries,
  hasGeneratedSecrets,
  missingRequiredFields,
  buildCreateCredentials,
  buildUpdateCredentials,
  initialCredentialValues,
  providerUnavailableReason,
} from '../utils';

// ----------------------------------------------------------------------
// Form kết nối dựng từ danh mục nhà cung cấp (mục 7c): giá trị ban đầu, ô bắt buộc, credentials gửi lên khi tạo và
// phần đã đổi khi cập nhật (ô trống = giữ nguyên).
// ----------------------------------------------------------------------

const field = (
  f: Partial<IPaymentProviderField> & Pick<IPaymentProviderField, 'key'>
): IPaymentProviderField => ({
  label: f.key,
  required: false,
  secret: false,
  type: 'text',
  ...f,
});

const SEPAY_FIELDS: IPaymentProviderField[] = [
  field({ key: 'webhookAuth', required: true, type: 'select', options: ['hmac', 'apikey'] }),
  field({ key: 'webhookSecret', label: 'Secret / API key webhook', required: true, secret: true }),
  field({ key: 'apiToken', secret: true }),
];

const ACB_FIELDS: IPaymentProviderField[] = [
  field({ key: 'baseUrl', placeholder: 'https://sandbox.acb.com.vn/acb/open' }),
  field({ key: 'clientId', required: true }),
  field({ key: 'clientSecret', secret: true }),
  field({ key: 'merchantId' }),
  field({ key: 'webhookAuth', type: 'select', options: ['apikey', 'basic'] }),
  field({ key: 'webhookApiKey', label: 'Webhook API key', secret: true }),
];

const VNPAY_FIELDS: IPaymentProviderField[] = [
  field({ key: 'tmnCode', required: true }),
  field({ key: 'hashSecret', required: true, secret: true }),
  field({ key: 'sandbox', type: 'boolean' }),
];

const provider = (
  p: Partial<IPaymentProviderInfo> & Pick<IPaymentProviderInfo, 'key' | 'kind'>
): IPaymentProviderInfo => ({
  displayName: p.key,
  summary: '',
  free: true,
  portalUrl: null,
  fields: [],
  setupSteps: [],
  hasCertificationSuite: false,
  ...p,
});

describe('visibleProviders', () => {
  it('ẩn ngân hàng giả lập, giữ thứ tự danh mục', () => {
    const list = [
      provider({ key: 'mockbank', kind: 'bank_direct' }),
      provider({ key: 'acb', kind: 'bank_direct' }),
      provider({ key: 'sepay', kind: 'bank_feed' }),
    ];
    expect(visibleProviders(list).map((p) => p.key)).toEqual(['acb', 'sepay']);
  });
});

describe('providerUnavailableReason', () => {
  const acb = provider({ key: 'acb', kind: 'bank_direct' });

  it('ngân hàng trực tiếp chỉ gắn tài khoản cùng ngân hàng (BIN)', () => {
    expect(providerUnavailableReason(acb, '970416')).toBeNull();
    expect(providerUnavailableReason(acb, ' 970416 ')).toBeNull();
    expect(providerUnavailableReason(acb, '970436')).toMatch(/chính ngân hàng/);
  });

  it('không biết BIN / không phải ngân hàng trực tiếp → không chặn', () => {
    expect(providerUnavailableReason(acb, null)).toBeNull();
    expect(
      providerUnavailableReason(provider({ key: 'sepay', kind: 'bank_feed' }), '970436')
    ).toBeNull();
    expect(
      providerUnavailableReason(provider({ key: 'newbank', kind: 'bank_direct' }), '970436')
    ).toBeNull();
  });
});

describe('initialCredentialValues', () => {
  it('tạo: ô chữ trống, select bắt buộc chọn sẵn lựa chọn đầu, boolean tắt', () => {
    expect(initialCredentialValues(SEPAY_FIELDS, 'create')).toEqual({
      webhookAuth: 'hmac',
      webhookSecret: '',
      apiToken: '',
    });
    expect(initialCredentialValues(VNPAY_FIELDS, 'create')).toEqual({
      tmnCode: '',
      hashSecret: '',
      sandbox: false,
    });
    // select không bắt buộc → trống (máy chủ dùng mặc định)
    expect(initialCredentialValues(ACB_FIELDS, 'create').webhookAuth).toBe('');
  });

  it('cập nhật: điền sẵn ô không bí mật từ publicSettings, ô bí mật luôn trống', () => {
    const values = initialCredentialValues(ACB_FIELDS, 'update', {
      clientId: 'abcd…wxyz',
      merchantId: 'MID01',
      webhookAuth: 'basic',
      // máy chủ không bao giờ trả khoá bí mật — nếu có cũng không điền
      clientSecret: 'leaked',
    });
    expect(values).toEqual({
      baseUrl: '',
      clientId: 'abcd…wxyz',
      clientSecret: '',
      merchantId: 'MID01',
      webhookAuth: 'basic',
      webhookApiKey: '',
    });
  });

  it('cập nhật: boolean đọc từ chuỗi "true" / "false"', () => {
    expect(initialCredentialValues(VNPAY_FIELDS, 'update', { sandbox: 'true' }).sandbox).toBe(true);
    expect(initialCredentialValues(VNPAY_FIELDS, 'update', { sandbox: 'False' }).sandbox).toBe(
      false
    );
    expect(initialCredentialValues(VNPAY_FIELDS, 'update', {}).sandbox).toBe(false);
  });
});

describe('missingRequiredFields', () => {
  it('tạo: báo ô bắt buộc còn trống (khoảng trắng = trống), bỏ qua boolean', () => {
    const missing = missingRequiredFields(
      VNPAY_FIELDS,
      { tmnCode: '  ', hashSecret: 'x', sandbox: false },
      'create'
    );
    expect(missing.map((f) => f.key)).toEqual(['tmnCode']);
  });

  it('cập nhật: không ô nào bắt buộc', () => {
    expect(missingRequiredFields(VNPAY_FIELDS, { tmnCode: '', hashSecret: '' }, 'update')).toEqual(
      []
    );
  });
});

describe('buildCreateCredentials', () => {
  it('cắt khoảng trắng, bỏ ô trống, boolean gửi nguyên', () => {
    expect(
      buildCreateCredentials(VNPAY_FIELDS, {
        tmnCode: ' TMN01 ',
        hashSecret: 'secret',
        sandbox: true,
      })
    ).toEqual({ tmnCode: 'TMN01', hashSecret: 'secret', sandbox: true });
    expect(
      buildCreateCredentials(SEPAY_FIELDS, {
        webhookAuth: 'hmac',
        webhookSecret: 's',
        apiToken: '',
      })
    ).toEqual({
      webhookAuth: 'hmac',
      webhookSecret: 's',
    });
  });

  it('boolean chưa bật vẫn gửi false; khoá lạ ngoài danh mục không gửi', () => {
    expect(
      buildCreateCredentials(VNPAY_FIELDS, { tmnCode: 'T', hashSecret: 'H', extra: 'x' })
    ).toEqual({
      tmnCode: 'T',
      hashSecret: 'H',
      sandbox: false,
    });
  });
});

describe('buildUpdateCredentials', () => {
  const initial = initialCredentialValues(ACB_FIELDS, 'update', {
    clientId: 'abcd…wxyz',
    merchantId: 'MID01',
  });

  it('không đổi gì → undefined (bỏ hẳn credentials)', () => {
    expect(buildUpdateCredentials(ACB_FIELDS, { ...initial }, initial)).toBeUndefined();
  });

  it('ô bí mật để trống = giữ nguyên; giá trị che sẵn của clientId không bị gửi ngược', () => {
    const values = { ...initial, clientSecret: '', clientId: 'abcd…wxyz', merchantId: ' MID01 ' };
    expect(buildUpdateCredentials(ACB_FIELDS, values, initial)).toBeUndefined();
  });

  it('chỉ gửi ô đã đổi / đã nhập, đã cắt khoảng trắng', () => {
    const values = {
      ...initial,
      clientSecret: ' new-secret ',
      merchantId: 'MID02',
      vaPrefix: 'ignored',
    };
    expect(buildUpdateCredentials(ACB_FIELDS, values, initial)).toEqual({
      clientSecret: 'new-secret',
      merchantId: 'MID02',
    });
  });

  it('xoá chữ ô không bí mật = giữ nguyên (không gửi chuỗi rỗng)', () => {
    expect(
      buildUpdateCredentials(ACB_FIELDS, { ...initial, merchantId: '' }, initial)
    ).toBeUndefined();
  });

  it('boolean chỉ gửi khi đổi', () => {
    const start = initialCredentialValues(VNPAY_FIELDS, 'update', { sandbox: 'true' });
    expect(buildUpdateCredentials(VNPAY_FIELDS, { ...start }, start)).toBeUndefined();
    expect(buildUpdateCredentials(VNPAY_FIELDS, { ...start, sandbox: false }, start)).toEqual({
      sandbox: false,
    });
  });
});

describe('isSecretField / settingToBoolean', () => {
  it('bí mật hoặc kiểu password → ô mật khẩu; select / boolean không bao giờ', () => {
    expect(isSecretField(field({ key: 'a', secret: true }))).toBe(true);
    expect(isSecretField(field({ key: 'a', type: 'password' }))).toBe(true);
    expect(isSecretField(field({ key: 'a', secret: true, type: 'textarea' }))).toBe(true);
    expect(isSecretField(field({ key: 'a', secret: true, type: 'select' }))).toBe(false);
    expect(isSecretField(field({ key: 'a' }))).toBe(false);
  });

  it('chuỗi publicSettings → boolean', () => {
    expect(settingToBoolean('true')).toBe(true);
    expect(settingToBoolean('1')).toBe(true);
    expect(settingToBoolean('false')).toBe(false);
    expect(settingToBoolean(undefined)).toBe(false);
  });
});

describe('webhookUrlEntries', () => {
  it('một URL (SePay) → nhãn "Webhook URL"', () => {
    expect(
      webhookUrlEntries({
        webhookUrl: 'https://p/webhooks/sepay/t',
        webhookUrls: { default: 'https://p/webhooks/sepay/t' },
      })
    ).toEqual([{ key: 'default', label: 'Webhook URL', url: 'https://p/webhooks/sepay/t' }]);
  });

  it('ngân hàng trực tiếp nhiều nhánh → mỗi nhánh một ô', () => {
    const entries = webhookUrlEntries({
      webhookUrl: 'https://p/webhooks/bank/acb/t/status',
      webhookUrls: {
        status: 'https://p/webhooks/bank/acb/t/status',
        'qr-transaction': 'https://p/webhooks/bank/acb/t/qr-transaction',
      },
    });
    expect(entries.map((e) => e.label)).toEqual([
      'Webhook URL · status',
      'Webhook URL · qr-transaction',
    ]);
  });

  it('BE cũ chỉ có webhookUrl', () => {
    expect(webhookUrlEntries({ webhookUrl: 'https://p/x', webhookUrls: null })).toEqual([
      { key: 'default', label: 'Webhook URL', url: 'https://p/x' },
    ]);
    expect(webhookUrlEntries({ webhookUrl: '', webhookUrls: {} })).toEqual([]);
  });
});

describe('credentialLabel / hasGeneratedSecrets / canSync / isBankDirect', () => {
  const acb = provider({ key: 'acb', kind: 'bank_direct', fields: ACB_FIELDS });

  it('nhãn khoá theo danh mục, không có thì hiện khoá', () => {
    expect(credentialLabel(acb, 'webhookApiKey')).toBe('Webhook API key');
    expect(credentialLabel(acb, 'tokenSecret')).toBe('tokenSecret');
    expect(credentialLabel(undefined, 'x')).toBe('x');
  });

  it('generatedSecrets rỗng / thiếu = không có khoá để hiện', () => {
    expect(hasGeneratedSecrets({ generatedSecrets: { webhookApiKey: 'k' } })).toBe(true);
    expect(hasGeneratedSecrets({ generatedSecrets: {} })).toBe(false);
    expect(hasGeneratedSecrets({ generatedSecrets: null })).toBe(false);
    expect(hasGeneratedSecrets(null)).toBe(false);
  });

  it('đồng bộ chỉ ở nguồn biến động số dư; kiểm tra / tạo lại khoá chỉ ở ngân hàng trực tiếp', () => {
    expect(canSync({ kind: 'bank_feed', provider: 'sepay' })).toBe(true);
    expect(canSync({ kind: 'gateway', provider: 'payos' })).toBe(false);
    expect(canSync({ kind: 'bank_direct', provider: 'acb' })).toBe(false);
    expect(isBankDirect({ kind: 'bank_direct' })).toBe(true);
    expect(isBankDirect({ kind: 'bank_feed' })).toBe(false);
  });
});
