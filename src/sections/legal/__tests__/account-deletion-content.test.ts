import { it, expect, describe } from 'vitest';

import { accountDeletionContent } from '../account-deletion-content';

describe('account deletion page content', () => {
  const pages = accountDeletionContent('Spark Store', 'help@example.com');

  it('has English and Vietnamese with the same sections', () => {
    expect(pages.map((p) => p.lang)).toEqual(['en', 'vi']);
    expect(pages[0].sections).toHaveLength(pages[1].sections.length);
  });

  it.each(pages)('$lang names the app, the in-app path and the request email', (page) => {
    const text = [page.intro, ...page.sections.flatMap((s) => [s.title, ...s.content])].join('\n');
    expect(text).toContain('Spark Store');
    expect(text).toContain('help@example.com');
    expect(text).toMatch(/Delete account|Xoá tài khoản/);
    // Google Play: phải nói rõ dữ liệu nào giữ lại và trong bao lâu.
    expect(text).toMatch(/90/);
    expect(text).toMatch(/30/);
  });
});
