import { describe, expect, it } from 'vitest';

import { sha256Hex, randomToken, isAuthHost, safeReturnPath, tenantCodeFromHost } from '../saas-host';

describe('tenantCodeFromHost', () => {
  it.each([
    ['shopabc.devbyspark.com', 'shopabc'],
    ['SHOPABC.devbyspark.com', 'shopabc'],
    ['demo.devbyspark.com:443', 'demo'],
    ['tiem-toc-2.devbyspark.com', 'tiem-toc-2'],
  ])('%s → %s', (host, code) => {
    expect(tenantCodeFromHost(host)).toBe(code);
  });

  it.each([
    'auth.devbyspark.com',
    'cici21chualang.vn',
    'localhost:3000',
    'devbyspark.com',
    'a.b.devbyspark.com',
    'evil-devbyspark.com',
    'shop.devbyspark.com.evil.example',
  ])('%s không phải cửa hàng SaaS', (host) => {
    expect(tenantCodeFromHost(host)).toBeNull();
  });

  it('nhận diện auth host', () => {
    expect(isAuthHost('auth.devbyspark.com')).toBe(true);
    expect(isAuthHost('shop.devbyspark.com')).toBe(false);
  });
});

describe('safeReturnPath', () => {
  it.each([
    ['/dashboard/pos', '/dashboard/pos'],
    ['/dashboard?tab=1', '/dashboard?tab=1'],
  ])('giữ đường dẫn nội bộ %s', (input, expected) => {
    expect(safeReturnPath(input, '/home')).toBe(expected);
  });

  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'dashboard', '/a\nb'])(
    'bỏ %s',
    (input) => {
      expect(safeReturnPath(input as string | null, '/home')).toBe('/home');
    }
  );
});

describe('random/nonce helpers', () => {
  it('randomToken là base64url, đủ dài cho state', () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(randomToken()).not.toBe(token);
  });

  it('sha256Hex khớp SHA-256 chuẩn', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
