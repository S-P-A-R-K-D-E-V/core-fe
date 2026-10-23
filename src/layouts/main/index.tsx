import Box from '@mui/material/Box';

import { usePathname } from 'src/routes/hooks';

import { ChatbotWidget } from 'src/components/chatbot';

import type { TenantBranding } from 'src/lib/tenant-branding';

import Footer from './footer';
import Header from './header';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
  hasProducts?: boolean;
  logoUrl?: string | null;
  /** Trang chủ truyền branding đầy đủ để chân trang có địa chỉ / số điện thoại của cửa hàng. */
  branding?: TenantBranding | null;
};

export default function MainLayout({ children, hasProducts, logoUrl, branding }: Props) {
  const pathname = usePathname();

  const homePage = pathname === '/';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 1 }}>
      <Header hasProducts={hasProducts} logoUrl={logoUrl} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ...(!homePage && {
            pt: { xs: 8, md: 10 },
          }),
        }}
      >
        {children}
      </Box>

      <Footer branding={branding} />

      <ChatbotWidget />
    </Box>
  );
}
