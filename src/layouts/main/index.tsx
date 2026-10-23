import dynamic from 'next/dynamic';

import Box from '@mui/material/Box';

import { usePathname } from 'src/routes/hooks';

import type { TenantBranding } from 'src/lib/tenant-branding';

import Footer from './footer';
import Header from './header';

// Trợ lý chat tải sau khi trang đã hiện (không nằm trong JS ban đầu của trang công khai — đỡ chặn luồng chính).
const ChatbotWidget = dynamic(() => import('src/components/chatbot/chatbot-widget'), { ssr: false });

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
