import type { MetadataRoute } from 'next';

import { SAAS_PRODUCT_NAME } from 'src/sections/legal/saas-privacy-content';
import { getTenantBranding } from 'src/lib/tenant-branding';
import { CICI_TENANT, storeDisplayName, storeHomeDescription } from 'src/lib/store-seo';

// ----------------------------------------------------------------------
// Web app manifest theo cửa hàng (thay public/manifest.json "Minimal UI" của template): tên, mô tả, màu, biểu tượng.
// ----------------------------------------------------------------------

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getTenantBranding();
  const name = branding ? storeDisplayName(branding) : SAAS_PRODUCT_NAME;

  return {
    name,
    short_name: name.length <= 12 ? name : name.slice(0, 12).trim(),
    description: branding ? storeHomeDescription(branding) : undefined,
    lang: 'vi',
    display: 'standalone',
    start_url: '/',
    theme_color:
      branding?.tenantCode !== CICI_TENANT && branding?.primaryColor && HEX_COLOR.test(branding.primaryColor)
        ? branding.primaryColor
        : '#00A76F',
    background_color: '#ffffff',
    icons: branding?.logoUrl
      ? [{ src: branding.logoUrl, sizes: 'any', purpose: 'any' }]
      : [
          { src: '/favicon/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/favicon/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
  };
}
