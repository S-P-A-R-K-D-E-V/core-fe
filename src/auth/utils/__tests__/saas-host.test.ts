import { vi, describe, expect, it } from 'vitest';

import { sha256Hex, randomToken, isAuthHost, safeReturnPath, tenantCodeFromHost } from '../saas-host';

describe('tenantCodeFromHost', () => {
  it.each([
    ['shopabc.devbyspark.com', 'shopabc'],
    ['SHOPABC.devbyspark.com', 'shopabc'],
    ['demo.devbyspark.com:443', 'demo'],
    ['tiem-toc-2.devbyspark.com', 'tiem-toc-2'],
    ['ducna.store.devbyspark.com', 'ducna'],
    ['DEMO.store.devbyspark.com:443', 'demo'],
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
    'store.devbyspark.com',
    'a.b.store.devbyspark.com',
    'ducna.finance.devbyspark.com',
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

describe('beginCentralLogin', () => {
  it('nhớ state và deep link app trên tên miền cửa hàng rồi chuyển sang auth host', async () => {
    const { beginCentralLogin, takeCentralLoginState, takeCentralLoginMobileRedirect } = await import('../saas-host');
    const assign = vi.fn();
    vi.stubGlobal('location', { host: 'shop1.devbyspark.com', assign } as any);

    beginCentralLogin('google', '/dashboard/pos', 'sparkstore://auth/callback');

    const target = new URL(assign.mock.calls[0][0]);
    expect(target.host).toBe('auth.devbyspark.com');
    expect(target.searchParams.get('tenant')).toBe('shop1');
    expect(target.searchParams.get('host')).toBe('shop1.devbyspark.com');
    expect(target.searchParams.get('returnTo')).toBe('/dashboard/pos');
    expect(target.searchParams.get('state')).toBe(takeCentralLoginState());
    expect(takeCentralLoginMobileRedirect()).toBe('sparkstore://auth/callback');
    expect(takeCentralLoginMobileRedirect()).toBeNull();

    vi.unstubAllGlobals();
  });
});
