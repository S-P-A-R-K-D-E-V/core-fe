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

import { bgGradient } from 'src/theme/css';

import Iconify from 'src/components/iconify';
import { varFade, MotionViewport } from 'src/components/animate';

// ----------------------------------------------------------------------

export default function HomeAdvertisement({ sx, ...other }: BoxProps) {
  const theme = useTheme();

  const renderImg = (
    <Stack component={m.div} variants={varFade('inUp', { distance: 24 })} alignItems="center">
      <Box
        component={m.img}
        animate={{ y: [-16, 0, -16] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        alt="shopping bag"
        src="/assets/images/home/rocket.webp"
        sx={{ maxWidth: { xs: 260, md: 380 } }}
      />
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
        Bắt đầu mua sắm
        <br />
        tại CiCi Accessories
      </Box>

      <Box
        component={m.div}
        variants={varFade('inDown', { distance: 24 })}
        sx={{ color: 'rgba(255,255,255,0.72)', mb: 5, typography: 'body1' }}
      >
        Hàng trăm mẫu phụ kiện thời trang nữ — trang sức, kẹp tóc, túi mini. Ghé thăm cửa hàng
        tại 21 Chùa Láng, Hà Nội hoặc nhắn tin để được tư vấn.
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent={{ xs: 'center', md: 'flex-start' }}
        spacing={2}
        sx={{ mb: 4 }}
      >
        <m.div variants={varFade('inRight', { distance: 24 })}>
          <Button
            component="a"
            href="#san-pham"
            color="inherit"
            size="large"
            variant="contained"
            startIcon={<Iconify icon="solar:bag-smile-bold" width={20} />}
            sx={{
              color: 'grey.800',
              bgcolor: 'common.white',
              '&:hover': { bgcolor: 'grey.100' },
            }}
          >
            Xem sản phẩm
          </Button>
        </m.div>

        <m.div variants={varFade('inRight', { distance: 24 })}>
          <Button
            color="inherit"
            size="large"
            variant="outlined"
            href="https://m.me/ciciaccessories"
            target="_blank"
            rel="noopener"
            startIcon={<Iconify icon="logos:messenger" width={20} />}
            sx={{
              color: 'common.white',
              borderColor: 'rgba(255,255,255,0.48)',
              '&:hover': { borderColor: 'common.white', bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            Nhắn tin đặt hàng
          </Button>
        </m.div>
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
    <Box component="section" sx={[{ py: { xs: 5, md: 10 } }, ...(Array.isArray(sx) ? sx : [sx])]} {...other}>
      <Container component={MotionViewport}>
        <Stack
          alignItems="center"
          direction={{ xs: 'column', md: 'row' }}
          sx={{
            ...bgGradient({
              direction: '135deg',
              startColor: theme.palette.primary.main,
              endColor: theme.palette.primary.dark,
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
