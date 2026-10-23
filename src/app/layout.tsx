/* eslint-disable perfectionist/sort-imports */
import 'src/global.css';

// i18n
import 'src/locales/i18n';

// ----------------------------------------------------------------------

import type { Metadata, Viewport } from 'next';

import { headers } from 'next/headers';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';

import ThemeProvider from 'src/theme';
import { LocalizationProvider } from 'src/locales';
import { primaryFont, interFont, dmSansFont, nunitoSansFont } from 'src/theme/typography';

import ProgressBar from 'src/components/progress-bar';
import { MotionLazy } from 'src/components/animate/motion-lazy';
import SnackbarProvider from 'src/components/snackbar/snackbar-provider';
import { SettingsDrawer, SettingsProvider } from 'src/components/settings';

import { CheckoutProvider } from 'src/sections/checkout/context';

import { AuthProvider } from 'src/auth/context/jwt';
import { BrandingProvider } from 'src/components/branding';
import { isAuthHost, tenantCodeFromHost } from 'src/auth/utils/saas-host';
import { SAAS_PRODUCT_NAME } from 'src/sections/legal/saas-privacy-content';
import { getRequestHost, getRequestOrigin, getTenantBranding } from 'src/lib/tenant-branding';
import {
  CICI_TENANT,
  absoluteUrl,
  isIndexable,
  storeHomeTitle,
  storeDisplayName,
  storeHomeDescription,
} from 'src/lib/store-seo';
// import { AuthProvider } from 'src/auth/context/auth0';
// import { AuthProvider } from 'src/auth/context/amplify';
// import { AuthProvider } from 'src/auth/context/firebase';
// import { AuthProvider } from 'src/auth/context/supabase';

// ----------------------------------------------------------------------

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Màu thanh địa chỉ trên điện thoại theo màu thương hiệu của cửa hàng; CiCi (và mặc định) giữ màu CiCi như trước.
export async function generateViewport(): Promise<Viewport> {
  const branding = await getTenantBranding();
  const color =
    branding?.tenantCode !== CICI_TENANT && branding?.primaryColor && HEX_COLOR.test(branding.primaryColor)
      ? branding.primaryColor
      : '#00A76F';
  // Trang công khai cho người dùng phóng to (Lighthouse / WCAG); màn hình quản trị, quầy, kiosk giữ khoá zoom như ứng dụng.
  const path = headers().get('x-pathname') ?? '';
  const appScreen = /^\/(dashboard|counter|customer-display|kiosk-checkin|auth|sso)(\/|$)/.test(path);
  return {
    themeColor: color,
    width: 'device-width',
    initialScale: 1,
    ...(appScreen && { maximumScale: 1 }),
  };
}

const DEFAULT_ICONS: Metadata['icons'] = [
  { rel: 'icon', url: '/favicon/favicon.ico' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', url: '/favicon/favicon-16x16.png' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', url: '/favicon/favicon-32x32.png' },
  { rel: 'apple-touch-icon', sizes: '180x180', url: '/favicon/apple-touch-icon.png' },
];

// Chỉ dùng khi không đọc được branding trên tên miền CiCi / máy dev (core-api lỗi) — như trước đây.
const CICI_METADATA: Metadata = {
  title: {
    template: '%s | CiCi Accessories',
    default: 'CiCi Accessories — Phụ kiện thời trang nữ',
  },
  description:
    'CiCi Accessories chuyên cung cấp phụ kiện thời trang nữ: trang sức, kẹp tóc, túi mini, ví da. Hàng trăm mẫu mới, giao hàng toàn quốc, đổi trả miễn phí 7 ngày.',
  keywords: 'cici accessories,phụ kiện thời trang,trang sức nữ,kẹp tóc,túi mini,ví da,đồ trang sức,vòng tay,nhẫn bạc',
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'CiCi Accessories',
    title: 'CiCi Accessories — Phụ kiện thời trang nữ',
    description:
      'Hàng trăm mẫu trang sức, kẹp tóc, túi mini. Giao hàng toàn quốc — đổi trả miễn phí 7 ngày.',
  },
  icons: DEFAULT_ICONS,
};

/**
 * Thẻ meta mặc định theo cửa hàng của tên miền đang mở (trang con tự đặt tiêu đề → "Trang | Tên cửa hàng").
 * Tiêu đề / mô tả dựng từ dữ liệu của chính cửa hàng (src/lib/store-seo.ts), không còn câu chữ cố định dùng chung.
 * Trang đăng nhập tập trung và cửa hàng mẫu: noindex.
 */
export async function generateMetadata(): Promise<Metadata> {
  const host = getRequestHost();
  const origin = getRequestOrigin();
  const branding = await getTenantBranding();
  const onAuthHost = isAuthHost(host);
  const robots = isIndexable({ isAuthHost: onAuthHost, tenantCode: branding?.tenantCode })
    ? undefined
    : { index: false, follow: false };
  const metadataBase = new URL(origin);

  if (!branding) {
    if (!onAuthHost && !tenantCodeFromHost(host)) return { ...CICI_METADATA, metadataBase };
    return {
      metadataBase,
      title: { template: `%s | ${SAAS_PRODUCT_NAME}`, default: SAAS_PRODUCT_NAME },
      description: `${SAAS_PRODUCT_NAME} — bán hàng, kho, ca làm, chấm công và lương cho cửa hàng.`,
      manifest: '/manifest.webmanifest',
      icons: DEFAULT_ICONS,
      robots: { index: false, follow: false },
    };
  }

  const name = storeDisplayName(branding);
  const title = storeHomeTitle(branding);
  const description = storeHomeDescription(branding);
  const logo = absoluteUrl(branding.logoUrl, origin);
  // CiCi giữ bộ favicon tĩnh như trước; cửa hàng khác dùng logo của mình làm biểu tượng tab.
  const icons =
    branding.tenantCode !== CICI_TENANT && branding.logoUrl
      ? [
          { rel: 'icon', url: branding.logoUrl },
          { rel: 'apple-touch-icon', url: branding.logoUrl },
        ]
      : DEFAULT_ICONS;

  return {
    metadataBase,
    applicationName: name,
    title: { template: `%s | ${name}`, default: title },
    description,
    manifest: '/manifest.webmanifest',
    openGraph: {
      type: 'website',
      locale: 'vi_VN',
      siteName: name,
      title,
      description,
      ...(logo && { images: [{ url: logo, alt: name }] }),
    },
    twitter: { card: 'summary', title, description, ...(logo && { images: [logo] }) },
    icons,
    robots,
  };
}

type Props = {
  children: React.ReactNode;
};

export default async function RootLayout({ children }: Props) {
  const branding = await getTenantBranding();
  const brand = branding
    ? {
        tenantCode: branding.tenantCode,
        storeName: branding.storeName,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
      }
    : null;

  return (
    <html
      lang="vi"
      className={`${primaryFont.className} ${interFont.variable} ${dmSansFont.variable} ${nunitoSansFont.variable}`}
      suppressHydrationWarning
    >
      <body>
        <BrandingProvider value={brand}>
        <AuthProvider>
          <LocalizationProvider>
            <SettingsProvider
              defaultSettings={{
                themeMode: 'light', // 'light' | 'dark'
                themeDirection: 'ltr', //  'rtl' | 'ltr'
                themeContrast: 'default', // 'default' | 'bold'
                themeLayout: 'vertical', // 'vertical' | 'horizontal' | 'mini'
                themeColorPresets: 'default', // 'default' | 'cyan' | 'purple' | 'blue' | 'orange' | 'red'
                themeStretch: false,
                themeFont: 'Public Sans', // v6.3.0: font family selector
                themeFontSize: 16, // v6.3.0: base font size (12-20px)
              }}
            >
              <AppRouterCacheProvider options={{ key: 'css' }}>
                <ThemeProvider>
                  <MotionLazy>
                    <SnackbarProvider>
                      <CheckoutProvider>
                        <SettingsDrawer />
                        <ProgressBar />
                        {children}
                      </CheckoutProvider>
                    </SnackbarProvider>
                  </MotionLazy>
                </ThemeProvider>
              </AppRouterCacheProvider>
            </SettingsProvider>
          </LocalizationProvider>
        </AuthProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
