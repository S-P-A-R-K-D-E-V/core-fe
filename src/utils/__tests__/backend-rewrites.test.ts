import { describe, expect, it } from 'vitest';

import { endpoints } from '../axios';
// eslint-disable-next-line import/no-relative-packages
import nextConfig from '../../../next.config.mjs';

// ----------------------------------------------------------------------
// Trên production trình duyệt gọi đường tương đối (/fnb/areas…) và Next.js proxy sang core-api theo
// BACKEND_API_PREFIXES trong next.config.mjs. Đường nào thiếu tiền tố ở đó thì Next trả trang 404 HTML (đã xảy ra với
// /fnb/* của trang Thiết lập F&B). Test này giữ mọi endpoint của src/utils/axios.ts có tiền tố được proxy.
// ----------------------------------------------------------------------

function collectPaths(node: unknown, out: string[]) {
  if (typeof node === 'string') out.push(node);
  else if (typeof node === 'function') {
    const value = (node as (...args: string[]) => unknown)('x', 'y', 'z');
    if (typeof value === 'string') out.push(value);
  } else if (node && typeof node === 'object') {
    Object.values(node).forEach((child) => collectPaths(child, out));
  }
}

describe('next.config rewrites', () => {
  it('mọi endpoint gọi BE đều có tiền tố được proxy', async () => {
    const rewrites = (await (nextConfig as any).rewrites()) as { source: string }[];
    const proxied = new Set(rewrites.map((r) => r.source.split('/')[1]));

    const paths: string[] = [];
    collectPaths(endpoints, paths);
    const missing = [
      ...new Set(
        paths
          .filter((p) => p.startsWith('/'))
          .map((p) => p.split('?')[0].split('/')[1])
          // /api/* không qua rewrite: /api/app-hub/* đi thẳng ingress sang core-api (giới hạn tần suất theo IP người dùng),
          // phần còn lại là endpoint mẫu của template.
          .filter((prefix) => prefix && prefix !== 'api' && !proxied.has(prefix))
      ),
    ];

    expect(missing).toEqual([]);
  });

  it('F&B được proxy', async () => {
    const rewrites = (await (nextConfig as any).rewrites()) as { source: string }[];
    expect(rewrites.map((r) => r.source)).toContain('/fnb/:path*');
  });
});
