import { it, expect, describe } from 'vitest';

import { supportContent } from '../support-content';

describe('support page content', () => {
  const pages = supportContent('Spark Store', 'help@example.com');

  it('has English and Vietnamese with the same questions', () => {
    expect(pages.map((p) => p.lang)).toEqual(['en', 'vi']);
    expect(pages[0].sections).toHaveLength(pages[1].sections.length);
  });

  it.each(pages)('$lang explains sign-in with the store code and names the app', (page) => {
    const text = [page.intro, ...page.sections.flatMap((s) => [s.title, ...s.content])].join('\n');
    expect(text).toContain('Spark Store');
    expect(text).toMatch(/store code|mã cửa hàng/i);
    expect(text).toMatch(/Sign in with email account|Đăng nhập bằng tài khoản email/);
    expect(text).toMatch(/Delete account|Xoá tài khoản/);
  });
});
