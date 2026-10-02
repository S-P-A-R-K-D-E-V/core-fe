import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildAppLinkResultUrl,
  buildMobileRedirectUrl,
  parseMobileRedirectUri,
} from '../mobile-redirect';

describe('parseMobileRedirectUri', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('chấp nhận deep link của app', () => {
    expect(parseMobileRedirectUri('corecms://auth/callback')?.protocol).toBe('corecms:');
  });

  it.each([
    'https://evil.example/cb',
    'http://cici21chualang.vn/cb',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//evil.example',
    'corecms.evil.example',
    'CORECMS-evil://x',
    '',
    'not a url',
  ])('từ chối %s', (raw) => {
    expect(parseMobileRedirectUri(raw)).toBeNull();
  });

  it('từ chối null và undefined', () => {
    expect(parseMobileRedirectUri(null)).toBeNull();
    expect(parseMobileRedirectUri(undefined)).toBeNull();
  });

  it('chỉ nhận link Expo Go khi bật cờ dev', () => {
    expect(parseMobileRedirectUri('exp://192.168.1.5:8081/--/auth/callback')).toBeNull();

    vi.stubEnv('NEXT_PUBLIC_ALLOW_EXPO_REDIRECT', 'true');
    expect(parseMobileRedirectUri('exp://192.168.1.5:8081/--/auth/callback')?.protocol).toBe(
      'exp:'
    );
  });
});

describe('buildMobileRedirectUrl', () => {
  it('gắn sessionToken vào deep link', () => {
    expect(buildMobileRedirectUrl('corecms://auth/callback', 'abc 123')).toBe(
      'corecms://auth/callback?sessionToken=abc+123'
    );
  });

  it('giữ query string sẵn có', () => {
    expect(buildMobileRedirectUrl('corecms://auth/callback?x=1', 't')).toBe(
      'corecms://auth/callback?x=1&sessionToken=t'
    );
  });

  it('trả null khi redirect_uri không hợp lệ', () => {
    expect(buildMobileRedirectUrl('https://evil.example', 't')).toBeNull();
  });
});

// Hợp đồng với app cửa hàng (core-mobile-saas parseLinkResult): đọc `status` hoặc `result`, kèm
// provider + reason. 409 Auth.ProviderAlreadyLinked → reason=provider_already_linked.
describe('buildAppLinkResultUrl', () => {
  const redirect = new URL('sparkstore://profile/linked');

  it('đã có cùng loại: trả error + provider + reason', () => {
    const url = new URL(
      buildAppLinkResultUrl(redirect, 'error', 'google', 'provider_already_linked')
    );
    expect(url.protocol).toBe('sparkstore:');
    expect(url.searchParams.get('status')).toBe('error');
    expect(url.searchParams.get('result')).toBe('error');
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('reason')).toBe('provider_already_linked');
  });

  it('liên kết xong: linked + provider, không có reason', () => {
    const url = new URL(buildAppLinkResultUrl(redirect, 'linked', 'apple'));
    expect(url.searchParams.get('status')).toBe('linked');
    expect(url.searchParams.get('result')).toBe('linked');
    expect(url.searchParams.get('provider')).toBe('apple');
    expect(url.searchParams.has('reason')).toBe(false);
  });

  it('không để provider / reason có sẵn trong redirect_uri lọt sang kết quả', () => {
    const crafted = new URL(
      'sparkstore://profile/linked?x=1&status=linked&provider=apple&reason=provider_already_linked'
    );
    const url = new URL(buildAppLinkResultUrl(crafted, 'error'));
    expect(url.searchParams.get('x')).toBe('1');
    expect(url.searchParams.get('status')).toBe('error');
    expect(url.searchParams.get('result')).toBe('error');
    expect(url.searchParams.has('provider')).toBe(false);
    expect(url.searchParams.has('reason')).toBe(false);
  });

  it('không sửa URL gốc', () => {
    buildAppLinkResultUrl(redirect, 'error', 'google', 'provider_already_linked');
    expect(redirect.toString()).toBe('sparkstore://profile/linked');
  });
});
