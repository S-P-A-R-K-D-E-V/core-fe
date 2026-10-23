import { it, expect, describe } from 'vitest';

import type { TenantBranding } from 'src/lib/tenant-branding';

import {
  clip,
  isIndexable,
  firstClause,
  jsonLdString,
  storeJsonLd,
  topCategories,
  storeHomeTitle,
  displayCategory,
  storeHomeDescription,
} from 'src/lib/store-seo';

// ----------------------------------------------------------------------

function brand(overrides: Partial<TenantBranding> = {}): TenantBranding {
  return {
    tenantCode: 'huangcf',
    storeName: 'Huang coffee',
    logoUrl: null,
    primaryColor: null,
    shortDescription: null,
    address: null,
    messengerLink: null,
    zaloLink: null,
    contactInfoJson: null,
    ...overrides,
  };
}

describe('store-seo', () => {
  describe('storeHomeTitle', () => {
    it('uses the title the store owner set', () => {
      expect(storeHomeTitle(brand({ seoTitle: '  Huang Coffee — Cà phê muối Cầu Giấy ' }), ['Cà phê'])).toBe(
        'Huang Coffee — Cà phê muối Cầu Giấy'
      );
    });

    it('builds "name — first clause of the description" instead of a fixed suffix', () => {
      const cici = brand({
        tenantCode: 'cici68',
        storeName: 'CiCi 21 Chùa Láng',
        shortDescription: 'Phụ kiện thời trang nữ — trang sức, kẹp tóc, túi mini và hơn thế nữa. Phong cách.',
      });
      expect(storeHomeTitle(cici)).toBe('CiCi 21 Chùa Láng — Phụ kiện thời trang nữ');
    });

    it('falls back to real categories, then the address, then the name alone', () => {
      expect(storeHomeTitle(brand(), ['Cà phê', 'Trà', 'Bánh ngọt', 'Nước ép'])).toBe(
        'Huang coffee — Cà phê, Trà, Bánh ngọt'
      );
      expect(storeHomeTitle(brand({ address: '12 Cầu Giấy, Hà Nội' }))).toBe('Huang coffee — 12 Cầu Giấy, Hà Nội');
      expect(storeHomeTitle(brand())).toBe('Huang coffee');
    });

    it('never says "Hệ thống quản lý nội bộ" and stays short', () => {
      const long = storeHomeTitle(brand({ shortDescription: 'Một câu mô tả rất dài '.repeat(10) }));
      expect(long).not.toContain('Hệ thống quản lý nội bộ');
      expect(long.length).toBeLessThanOrEqual(65);
      expect(long.endsWith('…')).toBe(true);
    });

    it('two stores never share a title', () => {
      const a = storeHomeTitle(brand({ tenantCode: 'a', storeName: 'Tiệm A' }));
      const b = storeHomeTitle(brand({ tenantCode: 'b', storeName: 'Tiệm B' }));
      expect(a).not.toBe(b);
    });
  });

  describe('storeHomeDescription', () => {
    it('prefers the SEO description, then the short description', () => {
      expect(storeHomeDescription(brand({ seoDescription: 'Mô tả SEO', shortDescription: 'Mô tả ngắn' }))).toBe(
        'Mô tả SEO'
      );
      expect(storeHomeDescription(brand({ shortDescription: 'Mô tả ngắn' }))).toBe('Mô tả ngắn');
    });

    it('builds a sentence from the store data — menu words for F&B', () => {
      const text = storeHomeDescription(
        brand({ businessType: 'fnb', address: '12 Cầu Giấy', phone: '0901 234 567' }),
        ['Cà phê', 'Trà'],
        18
      );
      expect(text).toBe(
        'Huang coffee tại 12 Cầu Giấy: thực đơn gồm Cà phê, Trà. Xem 18 món đang bán kèm giá. Liên hệ 0901 234 567.'
      );
    });

    it('a store with no products, address or description still gets a sentence without repeating its name', () => {
      expect(storeHomeDescription(brand())).toBe('Huang coffee. Xem sản phẩm, giá và thông tin liên hệ.');
    });

    it('uses product words for retail and stays within 160 characters', () => {
      const text = storeHomeDescription(
        brand({ storeName: 'Tiệm A', address: 'Số 1 đường rất dài '.repeat(8) }),
        ['Kẹp tóc', 'Trang sức'],
        76
      );
      expect(text.startsWith('Tiệm A tại')).toBe(true);
      expect(text.length).toBeLessThanOrEqual(160);
    });
  });

  describe('helpers', () => {
    it('picks the most common categories and fixes ALL-CAPS names', () => {
      const products = [
        { categoryName: 'PHỤ KIỆN TÓC' },
        { categoryName: 'Trang sức' },
        { categoryName: 'phụ kiện tóc' },
        { categoryName: null },
        { categoryName: 'VĂN PHÒNG PHẨM' },
      ];
      expect(topCategories(products, 2)).toEqual(['Phụ kiện tóc', 'Trang sức']);
      expect(displayCategory('Cà phê')).toBe('Cà phê');
    });

    it('clips on a word boundary', () => {
      expect(clip('một hai ba bốn năm', 11)).toBe('một hai ba…');
      expect(clip('ngắn', 10)).toBe('ngắn');
      expect(firstClause('Cà phê muối, bánh ngọt. Mở cửa 7h')).toBe('Cà phê muối');
    });

    it('does not index the central login host or the demo store', () => {
      expect(isIndexable({ isAuthHost: true, tenantCode: null })).toBe(false);
      expect(isIndexable({ isAuthHost: false, tenantCode: 'demo' })).toBe(false);
      expect(isIndexable({ isAuthHost: false, tenantCode: 'huangcf' })).toBe(true);
    });
  });

  describe('structured data', () => {
    it('describes a coffee shop as FoodEstablishment with its real contact data', () => {
      const data = storeJsonLd({
        branding: brand({
          businessType: 'fnb',
          logoUrl: '/media/branding/logo.png',
          phone: '0901 234 567',
          address: '12 Cầu Giấy',
          zaloLink: 'https://zalo.me/123',
        }),
        origin: 'https://huangcf.store.devbyspark.com',
        description: 'Cà phê muối',
      });
      const store = data['@graph'][1] as Record<string, unknown>;

      expect(store['@type']).toBe('FoodEstablishment');
      expect(store.logo).toBe('https://huangcf.store.devbyspark.com/media/branding/logo.png');
      expect(store.telephone).toBe('0901 234 567');
      expect(store.address).toEqual({ '@type': 'PostalAddress', streetAddress: '12 Cầu Giấy', addressCountry: 'VN' });
      expect(store.sameAs).toEqual(['https://zalo.me/123']);
    });

    it('is a Store for retail and omits empty fields', () => {
      const store = storeJsonLd({ branding: brand(), origin: 'https://a.store.devbyspark.com', description: 'x' })[
        '@graph'
      ][1] as Record<string, unknown>;
      expect(store['@type']).toBe('Store');
      expect(store).not.toHaveProperty('telephone');
      expect(store).not.toHaveProperty('address');
      expect(store).not.toHaveProperty('sameAs');
    });

    it('cannot break out of the script tag with a crafted store name', () => {
      const json = jsonLdString({ name: '</script><script>alert(1)</script>' });
      expect(json).not.toContain('</script>');
      expect(JSON.parse(json).name).toBe('</script><script>alert(1)</script>');
    });
  });
});
