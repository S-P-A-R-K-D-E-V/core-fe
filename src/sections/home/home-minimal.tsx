'use client';

import type { BoxProps } from '@mui/material/Box';

import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import SvgColor from 'src/components/svg-color';
import { varFade, MotionViewport } from 'src/components/animate';

import { SectionTitle } from './components/section-title';
import { CircleSvg, FloatLine, FloatPlusIcon } from './components/svg-elements';

// ----------------------------------------------------------------------

const ITEMS = [
  {
    icon: `/assets/icons/home/ic-make-brand.svg`,
    title: 'Đa dạng mẫu mã',
    description:
      'Hàng trăm mẫu trang sức, kẹp tóc, túi mini và phụ kiện thời trang mới nhất — cập nhật liên tục theo xu hướng.',
  },
  {
    icon: `/assets/icons/home/ic-design.svg`,
    title: 'Chất lượng đảm bảo',
    description:
      'Sản phẩm được tuyển chọn kỹ lưỡng, chất liệu an toàn, bền đẹp. Đội ngũ kiểm định kỹ trước khi đến tay khách hàng.',
  },
  {
    icon: `/assets/icons/home/ic-development.svg`,
    title: 'Cửa hàng tại Hà Nội',
    description:
      'Ghé thăm trực tiếp tại 21 Chùa Láng, Hà Nội để xem và chọn hàng. Tư vấn phụ kiện miễn phí ngay tại cửa hàng.',
  },
];

// ----------------------------------------------------------------------

const renderLines = () => (
  <>
    <FloatPlusIcon sx={{ top: 72, left: 72 }} />
    <FloatPlusIcon sx={{ bottom: 72, left: 72 }} />
    <FloatLine sx={{ top: 80, left: 0 }} />
    <FloatLine sx={{ bottom: 80, left: 0 }} />
    <FloatLine vertical sx={{ top: 0, left: 80 }} />
  </>
);

export default function HomeMinimal({ sx, ...other }: BoxProps) {
  const renderDescription = () => (
    <>
      <SectionTitle
        caption="Về chúng tôi"
        title="Phụ kiện thời trang"
        txtGradient="chính hãng"
        sx={{ mb: { xs: 5, md: 8 }, textAlign: { xs: 'center', md: 'left' } }}
      />

      <Stack spacing={6} sx={{ maxWidth: { sm: 560, md: 400 }, mx: { xs: 'auto', md: 'unset' } }}>
        {ITEMS.map((item) => (
          <Box
            component={m.div}
            variants={varFade('inUp', { distance: 24 })}
            key={item.title}
            sx={[{ gap: 3, display: 'flex' }]}
          >
            <SvgColor src={item.icon} sx={{ width: 40, height: 40, flexShrink: 0, color: 'primary.main' }} />
            <Stack spacing={1}>
              <Typography variant="h5" component="h6">
                {item.title}
              </Typography>
              <Typography sx={{ color: 'text.secondary' }}>{item.description}</Typography>
            </Stack>
          </Box>
        ))}
      </Stack>
    </>
  );

  const renderImage = () => (
    <Stack
      component={m.div}
      variants={varFade('inRight', { distance: 24 })}
      sx={{ height: 1, alignItems: 'center', position: 'relative', justifyContent: 'center' }}
    >
      <Box
        sx={[
          (theme) => ({
            left: 0,
            width: 720,
            borderRadius: 2,
            position: 'absolute',
            bgcolor: 'background.default',
            boxShadow: `-40px 40px 80px 0px ${alpha(theme.palette.grey[500], 0.16)}`,
          }),
        ]}
      >
        <Box
          component="img"
          alt="Sản phẩm CiCi Accessories"
          src="/assets/images/home/home-chart.webp"
          sx={{ width: 720, borderRadius: 2 }}
        />
      </Box>
    </Stack>
  );

  return (
    <Box
      component="section"
      id="ve-chung-toi"
      sx={[
        { overflow: 'hidden', position: 'relative', py: { xs: 10, md: 20 } },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <MotionViewport>
        {renderLines()}

        <Container sx={{ position: 'relative' }}>
          <Grid container columnSpacing={{ xs: 0, md: 8 }} sx={{ position: 'relative', zIndex: 9 }}>
            <Grid size={{ xs: 12, md: 6, lg: 7 }}>{renderDescription()}</Grid>

            <Grid sx={{ display: { xs: 'none', md: 'block' } }} size={{ md: 6, lg: 5 }}>
              {renderImage()}
            </Grid>
          </Grid>

          <CircleSvg variants={varFade('in')} sx={{ display: { xs: 'none', md: 'block' } }} />
        </Container>
      </MotionViewport>
    </Box>
  );
}
