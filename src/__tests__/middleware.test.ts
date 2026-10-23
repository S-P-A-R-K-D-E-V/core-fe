// @vitest-environment node
import { NextRequest } from 'next/server';
import { it, expect, describe } from 'vitest';

import { middleware } from 'src/middleware';

// ----------------------------------------------------------------------

const request = (url: string, headers: Record<string, string>, method = 'GET') =>
  new NextRequest(url, { method, headers });

describe('middleware', () => {
  it('sends www.<domain> permanently to the bare domain, keeping path and query', () => {
    const res = middleware(
      request('http://www.cici21chualang.vn/product/?q=1', {
        host: 'www.cici21chualang.vn',
        'x-forwarded-proto': 'https',
      })
    );

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://cici21chualang.vn/product/?q=1');
  });

  it('does not redirect non-GET requests on www', () => {
    const res = middleware(request('http://www.cici21chualang.vn/x', { host: 'www.cici21chualang.vn' }, 'POST'));

    expect(res.headers.get('location')).toBeNull();
  });

  it('passes the tenant host on for the bare domain', () => {
    const res = middleware(request('http://cici21chualang.vn/', { host: 'cici21chualang.vn' }));

    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-request-x-tenant-domain')).toBe('cici21chualang.vn');
  });
});
