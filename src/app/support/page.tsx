import type { Metadata } from 'next';
import { headers } from 'next/headers';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { isAuthHost, tenantCodeFromHost } from 'src/auth/utils/saas-host';
import { supportContent } from 'src/sections/legal/support-content';
import { SAAS_PRODUCT_NAME, SAAS_SUPPORT_EMAIL } from 'src/sections/legal/saas-privacy-content';

// ----------------------------------------------------------------------
// Trang công khai "Hỗ trợ" (không cần đăng nhập) — Support URL khai với App Store Connect / Google Play. Tên miền
// nền tảng cửa hàng (auth.devbyspark.com, <mã>.store.devbyspark.com) hiện Spark Store; cici21chualang.vn hiện CiCi.
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
    title: { absolute: `${product} — Support` },
    description: `Help and contact for ${product}`,
  };
}

export default function SupportPage() {
  const { product, supportEmail } = brand();
  const languages = supportContent(product, supportEmail);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Box sx={{ mb: 5, textAlign: 'center' }}>
          <Typography variant="overline" sx={{ color: 'primary.main' }}>
            {product}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1.5 }}>
            Support
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
            <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
              {language.intro}
            </Typography>

            <Box
              sx={{
                bgcolor: 'primary.lighter',
                borderRadius: 2,
                p: 3,
                mb: 4,
                borderLeft: '4px solid',
                borderColor: 'primary.main',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                {language.contactLabel}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, wordBreak: 'break-all' }}>
                <a href={`mailto:${supportEmail}`} style={{ color: 'inherit' }}>
                  {supportEmail}
                </a>
              </Typography>
            </Box>

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

            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <a href="/privacy-policy/">Privacy Policy</a> · <a href="/account-deletion/">Delete your account</a>
            </Typography>
          </Box>
        ))}
      </Container>
    </Box>
  );
}
