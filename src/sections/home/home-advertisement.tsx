'use client';

import type { BoxProps } from '@mui/material/Box';

import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useDecorativeMotion } from 'src/hooks/use-decorative-motion';

import { bgGradient } from 'src/theme/css';

import Iconify from 'src/components/iconify';
import { varFade, MotionViewport } from 'src/components/animate';

import { storeIndustry } from 'src/lib/store-industry';
import type { TenantBranding } from 'src/lib/tenant-branding';

import { useSeason } from './components/season-context';

// ----------------------------------------------------------------------

type Props = BoxProps & {
  branding?: TenantBranding | null;
  productTotal?: number;
};

export default function HomeAdvertisement({ sx, branding, productTotal = 0, ...other }: Props) {
  const theme = useTheme();
  const motion = useDecorativeMotion();
  const storeName = branding?.storeName ?? 'CiCi Accessories';
  const contactLink = branding?.messengerLink ?? branding?.zaloLink ?? null;
  const industry = storeIndustry(branding);
  const { words } = industry;
  // Mùa lễ: lời chào và nền của mùa (Giáng Sinh an lành…) thay câu kết theo ngành.
  const season = useSeason();
  const [outroLine1, outroLine2] = season
    ? season.outro.lines(storeName)
    : industry.outro(storeName);
  // Số mặt hàng thật thay cho "Hàng trăm mẫu sản phẩm mới" cố định.
  const lead = productTotal > 0 ? `${productTotal} ${words.item} đang bán.` : '';
  const contact = contactLink || branding?.phone ? ' hoặc liên hệ để được tư vấn' : '';

  const renderImg = (
    <Stack component={m.div} variants={varFade('inUp', { distance: 24 })} alignItems="center">
      {season ? (
        <Box
          component={m.div}
          aria-hidden
          animate={motion ? { y: [-12, 0, -12], rotate: [-4, 4, -4] } : undefined}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          sx={{
            lineHeight: 1,
            py: { xs: 4, md: 6 },
            px: { md: 6 },
            fontSize: { xs: 120, md: 180 },
          }}
        >
          {season.emoji}
        </Box>
      ) : (
        <Box
          component={m.img}
          animate={motion ? { y: [-16, 0, -16] } : undefined}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          alt=""
          src="/assets/images/home/rocket.webp"
          sx={{ maxWidth: { xs: 260, md: 380 } }}
        />
      )}
    </Stack>
  );

  const renderDescription = (
    <Box
      sx={{
        textAlign: { xs: 'center', md: 'left' },
        px: { xs: 3, md: 0 },
        pr: { md: 5 },
        pb: { xs: 5, md: 0 },
      }}
    >
      <Box
        component={m.div}
        variants={varFade('inDown', { distance: 24 })}
        sx={{ color: 'common.white', mb: 2, typography: 'h2' }}
      >
        {outroLine1}
        <br />
        {outroLine2}
      </Box>

      <Box
        component={m.div}
        variants={varFade('inDown', { distance: 24 })}
        sx={{ color: 'rgba(255,255,255,0.72)', mb: 5, typography: 'body1' }}
      >
        {branding?.address
          ? `${lead} Ghé thăm cửa hàng tại ${branding.address}${contact}.`.trim()
          : productTotal > 0 || !branding
            ? `${lead} ${words.cta} và giá ngay trên trang${contact}.`.trim()
            : `Liên hệ ${storeName} để được tư vấn.`}
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent={{ xs: 'center', md: 'flex-start' }}
        spacing={2}
        sx={{ mb: 4 }}
      >
        {(productTotal > 0 || !branding) && (
          <m.div variants={varFade('inRight', { distance: 24 })}>
            <Button
              component={RouterLink}
              href={paths.product.root}
              color="inherit"
              size="large"
              variant="contained"
              startIcon={<Iconify icon={industry.icon} width={20} />}
              sx={{
                color: 'grey.800',
                bgcolor: 'common.white',
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              {words.cta}
            </Button>
          </m.div>
        )}

        {contactLink && (
          <m.div variants={varFade('inRight', { distance: 24 })}>
            <Button
              color="inherit"
              size="large"
              variant="outlined"
              href={contactLink}
              target="_blank"
              rel="noopener"
              startIcon={
                <Iconify
                  icon={branding?.messengerLink ? 'logos:messenger' : 'simple-icons:zalo'}
                  width={20}
                />
              }
              sx={{
                color: 'common.white',
                borderColor: 'rgba(255,255,255,0.48)',
                '&:hover': { borderColor: 'common.white', bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              Nhắn tin đặt hàng
            </Button>
          </m.div>
        )}
      </Stack>

      {/* Discreet staff login link */}
      <m.div variants={varFade('in')}>
        <Link
          component={RouterLink}
          href={paths.auth.jwt.login}
          sx={{
            color: 'rgba(255,255,255,0.38)',
            typography: 'caption',
            textDecoration: 'none',
            '&:hover': { color: 'rgba(255,255,255,0.6)', textDecoration: 'underline' },
          }}
        >
          Nhân viên đăng nhập →
        </Link>
      </m.div>
    </Box>
  );

  return (
    <Box
      component="section"
      sx={[{ py: { xs: 5, md: 10 } }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <Container component={MotionViewport}>
        <Stack
          alignItems="center"
          direction={{ xs: 'column', md: 'row' }}
          sx={{
            ...bgGradient({
              direction: '135deg',
              startColor: season?.outro.from ?? theme.palette.primary.main,
              endColor: season?.outro.to ?? theme.palette.primary.dark,
            }),
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          {renderImg}

          {renderDescription}
        </Stack>
      </Container>
    </Box>
  );
}
