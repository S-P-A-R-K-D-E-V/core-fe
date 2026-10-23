import { it, expect, describe } from 'vitest';

import { storeJsonLd, storeHomeDescription } from 'src/lib/store-seo';
import { INDUSTRY_KEYS, storeIndustry, isIndustryKey, INDUSTRY_OPTIONS } from 'src/lib/store-industry';

// ----------------------------------------------------------------------

describe('store-industry', () => {
  it('has the same industry keys as core-be StoreIndustries', () => {
    expect(INDUSTRY_KEYS).toEqual([
      'fashion',
      'beauty',
      'grocery',
      'electronics',
      'household',
      'cafe',
      'restaurant',
      'service',
      'other',
    ]);
    expect(INDUSTRY_OPTIONS.map((o) => o.value)).toEqual([...INDUSTRY_KEYS]);
    expect(isIndustryKey('cafe')).toBe(true);
    expect(isIndustryKey('Cafe')).toBe(false);
  });

  it('uses the chosen industry, else CiCi stays fashion and other stores fall back to a neutral set by business type', () => {
    expect(storeIndustry({ tenantCode: 'ketoan-ai', industry: 'service', businessType: 'retail' }).key).toBe('service');
    expect(storeIndustry({ tenantCode: 'cici68', industry: null }).key).toBe('fashion');
    expect(storeIndustry(null).key).toBe('fashion');
    expect(storeIndustry({ tenantCode: 'huangcf', industry: null, businessType: 'fnb' }).key).toBe('fnb');
    expect(storeIndustry({ tenantCode: 'shop-a', industry: 'unknown', businessType: 'retail' }).key).toBe('retail');
  });

  it('every industry has a complete look: 4 card colours, category icons, headline gradient', () => {
    [...INDUSTRY_KEYS, 'retail', 'fnb'].forEach((key) => {
      const preset = storeIndustry({ tenantCode: 'x', industry: key, businessType: key === 'fnb' ? 'fnb' : 'retail' });
      expect(preset.palette.cards).toHaveLength(4);
      expect(preset.categoryIcons.length).toBeGreaterThanOrEqual(3);
      expect(preset.palette.headline).toHaveLength(3);
      expect(preset.outro('Tiệm A').join(' ')).toContain('Tiệm A');
    });
  });

  it('a service business talks about services, not products or accessories', () => {
    const branding = { tenantCode: 'ketoan-ai', storeName: 'Dịch vụ kế toán', industry: 'service' } as const;
    const preset = storeIndustry(branding);

    expect(preset.words.cta).toBe('Xem dịch vụ');
    expect(preset.heroLead).not.toMatch(/thế giới|mua sắm/);
    expect(
      storeHomeDescription(
        { ...branding, logoUrl: null, primaryColor: null, shortDescription: null, address: null, messengerLink: null, zaloLink: null, contactInfoJson: null },
        ['Kế toán thuế', 'Báo cáo tài chính'],
        5
      )
    ).toBe('Dịch vụ kế toán: dịch vụ gồm Kế toán thuế, Báo cáo tài chính. Xem 5 dịch vụ đang bán kèm giá.');
  });

  it('schema.org type follows the industry', () => {
    const base = {
      tenantCode: 'a',
      storeName: 'A',
      logoUrl: null,
      primaryColor: null,
      shortDescription: null,
      address: null,
      messengerLink: null,
      zaloLink: null,
      contactInfoJson: null,
    };
    const typeOf = (industry: string) =>
      (storeJsonLd({ branding: { ...base, industry }, origin: 'https://a.store.devbyspark.com', description: 'x' })[
        '@graph'
      ][1] as Record<string, unknown>)['@type'];

    expect(typeOf('cafe')).toBe('CafeOrCoffeeShop');
    expect(typeOf('restaurant')).toBe('Restaurant');
    expect(typeOf('fashion')).toBe('ClothingStore');
    expect(typeOf('service')).toBe('ProfessionalService');
    expect(typeOf('grocery')).toBe('GroceryStore');
  });
});
