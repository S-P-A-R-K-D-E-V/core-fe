import type { Metadata } from 'next';
import { headers } from 'next/headers';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { isAuthHost, tenantCodeFromHost } from 'src/auth/utils/saas-host';
import { accountDeletionContent } from 'src/sections/legal/account-deletion-content';
import { SAAS_PRODUCT_NAME, SAAS_SUPPORT_EMAIL } from 'src/sections/legal/saas-privacy-content';

// ----------------------------------------------------------------------
// Trang công khai "Yêu cầu xoá tài khoản" (không cần đăng nhập) — Google Play bắt buộc có đường link web để
// người dùng yêu cầu xoá tài khoản và dữ liệu; cũng dùng cho App Store. Tên miền nền tảng cửa hàng
// (auth.devbyspark.com, <mã>.store.devbyspark.com) hiện tên app Spark Store; cici21chualang.vn hiện CiCi.
// ----------------------------------------------------------------------

const CICI_SUPPORT_EMAIL = 'support@cici21chualang.vn';

function brand(): { product: string; supportEmail: string } {
  const host = (headers().get('host') ?? '').split(':')[0].toLowerCase();
  return isAuthHost(host) || tenantCodeFromHost(host) !== null
    ? { product: SAAS_PRODUCT_NAME, supportEmail: SAAS_SUPPORT_EMAIL }
    : { product: 'CiCi', supportEmail: CICI_SUPPORT_EMAIL };
}

export async function generateMetadata(): Promise<Metadata> {
  const { product } = brand();
  return {
    title: { absolute: `${product} — Delete your account` },
    description: `How to delete your ${product} account and data`,
  };
}

export default function AccountDeletionPage() {
  const { product, supportEmail } = brand();
  const languages = accountDeletionContent(product, supportEmail);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Box sx={{ mb: 5, textAlign: 'center' }}>
          <Typography variant="overline" sx={{ color: 'primary.main' }}>
            {product}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1.5 }}>
            Delete your account
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            <a href="#en">English</a> · <a href="#vi">Tiếng Việt</a>
          </Typography>
        </Box>

        {languages.map((language, languageIndex) => (
          <Box key={language.lang} id={language.lang} lang={language.lang} sx={{ scrollMarginTop: 24 }}>
            {languageIndex > 0 && <Divider sx={{ my: 6 }} />}
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
              {language.heading}
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, lineHeight: 1.8 }}>
              {language.intro}
            </Typography>
            {language.sections.map((section) => (
              <Box key={section.title} sx={{ mb: 3.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                  {section.title}
                </Typography>
                {section.content.map((line, i) => (
                  <Typography
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    variant="body1"
                    sx={{ color: 'text.secondary', mb: 1, lineHeight: 1.8 }}
                  >
                    {line}
                  </Typography>
                ))}
              </Box>
            ))}
          </Box>
        ))}

        <Divider sx={{ my: 5 }} />
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          {supportEmail}
        </Typography>
      </Container>
    </Box>
  );
}
