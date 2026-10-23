import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import Logo from 'src/components/logo';
import { useStoreBrand } from 'src/components/branding';

import type { TenantBranding } from 'src/lib/tenant-branding';

// ----------------------------------------------------------------------
// Chân trang công khai của cửa hàng: tên, địa chỉ, số điện thoại của chính cửa hàng đang mở và các trang chính sách
// (thay chân trang mẫu của template — "Minimal", "support@minimals.cc", link minimals.cc — cửa hàng nào cũng giống nhau).
// ----------------------------------------------------------------------

type Props = {
  /** Có ở trang chủ (app/page.tsx đọc sẵn) — thêm địa chỉ, số điện thoại. Trang khác chỉ có tên + logo. */
  branding?: TenantBranding | null;
};

export default function Footer({ branding }: Props) {
  const { brandName, logoUrl, isCiCi } = useStoreBrand();
  const storeName = branding?.storeName ?? (isCiCi ? 'CiCi Accessories' : brandName);
  const year = new Date().getFullYear();

  const links = [
    { name: 'Sản phẩm', href: paths.product.root },
    { name: 'Hỗ trợ', href: '/support' },
    { name: 'Chính sách quyền riêng tư', href: '/privacy-policy' },
  ];

  return (
    <Box component="footer" sx={{ position: 'relative', bgcolor: 'background.default' }}>
      <Divider />

      <Container sx={{ py: 5, textAlign: 'center' }}>
        <Logo logoSrc={branding?.logoUrl ?? logoUrl} sx={{ mb: 1.5, mx: 'auto' }} />

        <Typography variant="subtitle1" component="p">
          {storeName}
        </Typography>

        {(branding?.address || branding?.phone) && (
          <Typography variant="body2" component="address" sx={{ mt: 0.5, color: 'text.secondary', fontStyle: 'normal' }}>
            {[branding?.address, branding?.phone].filter(Boolean).join(' · ')}
          </Typography>
        )}

        <Stack
          component="nav"
          direction="row"
          flexWrap="wrap"
          justifyContent="center"
          sx={{ mt: 2, columnGap: 3, rowGap: 1 }}
        >
          {links.map((link) => (
            <Link key={link.href} component={RouterLink} href={link.href} color="inherit" variant="body2">
              {link.name}
            </Link>
          ))}
        </Stack>

        <Typography variant="caption" component="div" sx={{ mt: 2, color: 'text.disabled' }}>
          © {year} {storeName}
        </Typography>
      </Container>
    </Box>
  );
}
