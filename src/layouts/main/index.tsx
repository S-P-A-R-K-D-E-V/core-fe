import Box from '@mui/material/Box';

import { usePathname } from 'src/routes/hooks';

import { ChatbotWidget } from 'src/components/chatbot';

import Footer from './footer';
import Header from './header';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
  hasProducts?: boolean;
};

export default function MainLayout({ children, hasProducts }: Props) {
  const pathname = usePathname();

  const homePage = pathname === '/';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 1 }}>
      <Header hasProducts={hasProducts} />

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

      <Footer />

      <ChatbotWidget />
    </Box>
  );
}
