import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildMobileRedirectUrl, parseMobileRedirectUri } from '../mobile-redirect';

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
    expect(parseMobileRedirectUri('exp://192.168.1.5:8081/--/auth/callback')?.protocol).toBe('exp:');
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
