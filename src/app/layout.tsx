/* eslint-disable perfectionist/sort-imports */
import 'src/global.css';

// i18n
import 'src/locales/i18n';

// ----------------------------------------------------------------------

import type { Metadata, Viewport } from 'next';

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
// import { AuthProvider } from 'src/auth/context/auth0';
// import { AuthProvider } from 'src/auth/context/amplify';
// import { AuthProvider } from 'src/auth/context/firebase';
// import { AuthProvider } from 'src/auth/context/supabase';

// ----------------------------------------------------------------------

export const viewport: Viewport = {
  themeColor: '#00A76F', // CiCi primary brand color
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    template: '%s | CiCi Accessories',
    default: 'CiCi Accessories — Phụ kiện thời trang nữ',
  },
  description:
    'CiCi Accessories chuyên cung cấp phụ kiện thời trang nữ: trang sức, kẹp tóc, túi mini, ví da. Hàng trăm mẫu mới, giao hàng toàn quốc, đổi trả miễn phí 7 ngày.',
  keywords: 'cici accessories,phụ kiện thời trang,trang sức nữ,kẹp tóc,túi mini,ví da,đồ trang sức,vòng tay,nhẫn bạc',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'CiCi Accessories',
    title: 'CiCi Accessories — Phụ kiện thời trang nữ',
    description:
      'Hàng trăm mẫu trang sức, kẹp tóc, túi mini. Giao hàng toàn quốc — đổi trả miễn phí 7 ngày.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CiCi Accessories — Phụ kiện thời trang nữ',
    description: 'Hàng trăm mẫu trang sức, kẹp tóc, túi mini. Giao hàng toàn quốc.',
  },
  icons: [
    { rel: 'icon', url: '/favicon/favicon.ico' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', url: '/favicon/favicon-16x16.png' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', url: '/favicon/favicon-32x32.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', url: '/favicon/apple-touch-icon.png' },
  ],
};

type Props = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: Props) {
  return (
    <html
      lang="vi"
      className={`${primaryFont.className} ${interFont.variable} ${dmSansFont.variable} ${nunitoSansFont.variable}`}
      suppressHydrationWarning
    >
      <body>
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
      </body>
    </html>
  );
}
