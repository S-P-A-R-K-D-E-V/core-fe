import { m, useScroll } from 'framer-motion';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import { alpha, styled, useTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useResponsive } from 'src/hooks/use-responsive';

import { HEADER } from 'src/layouts/config-layout';
import { bgBlur, bgGradient, textGradient } from 'src/theme/css';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import { varFade, MotionContainer } from 'src/components/animate';

import type { IProductListItem } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #F8C8DC 0%, #F4A0C0 100%)',
  'linear-gradient(135deg, #EED6C4 0%, #DBAAA0 100%)',
  'linear-gradient(135deg, #FFC8D5 0%, #E891A8 100%)',
  'linear-gradient(135deg, #F5E6D3 0%, #EEC8A0 100%)',
];

// ----------------------------------------------------------------------

const StyledRoot = styled('div')(({ theme }) => ({
  ...bgGradient({
    color: 'rgba(255, 240, 245, 0.92)',
    imgUrl: '/assets/background/overlay_3.jpg',
  }),
  width: '100%',
  height: '100vh',
  position: 'relative',
  [theme.breakpoints.up('md')]: {
    top: 0,
    left: 0,
    position: 'fixed',
  },
}));

const StyledWrapper = styled('div')(({ theme }) => ({
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
  [theme.breakpoints.up('md')]: {
    marginTop: HEADER.H_DESKTOP_OFFSET,
  },
}));

const StyledTextGradient = styled(m.h1)(({ theme }) => ({
  ...textGradient(
    `300deg,
    #F8C8DC 0%,
    #F4B6C2 25%,
    #EED6C4 50%,
    #F4B6C2 75%,
    #F8C8DC 100%`
  ),
  padding: 0,
  marginTop: 8,
  lineHeight: 1,
  fontWeight: 900,
  marginBottom: 24,
  letterSpacing: 6,
  textAlign: 'center',
  backgroundSize: '400%',
  fontSize: `${64 / 16}rem`,
}));

const StyledEllipseTop = styled('div')(({ theme }) => ({
  top: -80,
  width: 480,
  right: -80,
  height: 480,
  borderRadius: '50%',
  position: 'absolute',
  filter: 'blur(100px)',
  WebkitFilter: 'blur(100px)',
  backgroundColor: 'rgba(248, 200, 220, 0.25)',
}));

const StyledEllipseBottom = styled('div')(({ theme }) => ({
  height: 400,
  bottom: -200,
  left: '10%',
  right: '10%',
  borderRadius: '50%',
  position: 'absolute',
  filter: 'blur(100px)',
  WebkitFilter: 'blur(100px)',
  backgroundColor: alpha(theme.palette.primary.darker, 0.12),
}));

type StyledPolygonProps = {
  opacity?: number;
  anchor?: 'left' | 'right';
};

const StyledPolygon = styled('div')<StyledPolygonProps>(
  ({ opacity = 1, anchor = 'left', theme }) => ({
    ...bgBlur({
      opacity,
      color: theme.palette.background.default,
    }),
    zIndex: 9,
    bottom: 0,
    height: 80,
    width: '50%',
    position: 'absolute',
    clipPath: 'polygon(0% 0%, 100% 100%, 0% 100%)',
    ...(anchor === 'left' && {
      left: 0,
      ...(theme.direction === 'rtl' && {
        transform: 'scale(-1, 1)',
      }),
    }),
    ...(anchor === 'right' && {
      right: 0,
      transform: 'scaleX(-1)',
      ...(theme.direction === 'rtl' && {
        transform: 'scaleX(1)',
      }),
    }),
  })
);

// ----------------------------------------------------------------------

type ProductMiniCardProps = {
  product?: IProductListItem;
  index: number;
  loading?: boolean;
};

function ProductMiniCard({ product, index, loading }: ProductMiniCardProps) {
  if (loading) {
    return (
      <Skeleton
        variant="rectangular"
        sx={{ borderRadius: 2, width: '100%', height: 190 }}
        animation="wave"
      />
    );
  }

  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const price = product?.sellingPrice ?? product?.basePrice ?? 0;

  return (
    <m.div variants={varFade().inUp} style={{ width: '100%' }}>
      <Card
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
          '&:hover': {
            transform: 'translateY(-6px)',
            boxShadow: (theme) =>
              `0 20px 40px ${alpha(theme.palette.primary.main, 0.25)}`,
          },
        }}
      >
        {/* Image / gradient banner */}
        <Box
          sx={{
            height: 120,
            background: gradient,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {product?.imageUrl ? (
            <Box
              component="img"
              src={product.imageUrl}
              alt={product.name}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                position: 'absolute',
                inset: 0,
              }}
            />
          ) : (
            <Iconify
              icon="solar:tag-price-bold-duotone"
              width={44}
              sx={{ color: 'rgba(255,255,255,0.55)' }}
            />
          )}

          {product?.categoryName && (
            <Chip
              label={product.categoryName}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                bgcolor: 'rgba(255,255,255,0.88)',
                fontSize: '0.6rem',
                height: 18,
                fontWeight: 600,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Box>

        {/* Info */}
        <Box sx={{ p: 1.25, bgcolor: 'background.paper' }}>
          <Typography
            variant="caption"
            fontWeight={700}
            noWrap
            display="block"
            sx={{ mb: 0.25 }}
          >
            {product?.name ?? '—'}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'primary.main', fontWeight: 700 }}
          >
            {price > 0 ? fCurrency(price) : 'Liên hệ'}
          </Typography>
        </Box>
      </Card>
    </m.div>
  );
}

// ----------------------------------------------------------------------

type Props = {
  products?: IProductListItem[];
  productsLoading?: boolean;
};

export default function HomeHero({ products = [], productsLoading = true }: Props) {
  const mdUp = useResponsive('up', 'md');

  const theme = useTheme();

  const heroRef = useRef<HTMLDivElement | null>(null);

  const { scrollY } = useScroll();

  const [percent, setPercent] = useState(0);

  const getScroll = useCallback(() => {
    let heroHeight = 0;

    if (heroRef.current) {
      heroHeight = heroRef.current.offsetHeight;
    }

    scrollY.on('change', (scrollHeight) => {
      const scrollPercent = (scrollHeight * 100) / heroHeight;
      setPercent(Math.floor(scrollPercent));
    });
  }, [scrollY]);

  useEffect(() => {
    getScroll();
  }, [getScroll]);

  const opacity = 1 - percent / 100;
  const hide = percent > 120;

  // Determine card items: skeleton × 4 while loading, real products, or gradient placeholders
  const cardItems: Array<IProductListItem | null> = productsLoading
    ? [null, null, null, null]
    : products.length > 0
      ? [...products.slice(0, 4), ...Array(Math.max(0, 4 - products.length)).fill(null)]
      : [null, null, null, null];

  // ----------------------------------------------------------------------

  const renderDescription = (
    <Stack
      alignItems="center"
      justifyContent="center"
      sx={{
        height: 1,
        mx: 'auto',
        maxWidth: 520,
        opacity: opacity > 0 ? opacity : 0,
        mt: {
          md: `-${HEADER.H_DESKTOP + percent * 2.5}px`,
        },
      }}
    >
      <m.div variants={varFade().in}>
        <Typography
          variant="h2"
          sx={{ textAlign: 'center', fontWeight: 700 }}
        >
          Cici Accessories
        </Typography>
      </m.div>

      <m.div variants={varFade().in}>
        <StyledTextGradient
          animate={{ backgroundPosition: '200% center' }}
          transition={{
            repeatType: 'reverse',
            ease: 'linear',
            duration: 20,
            repeat: Infinity,
          }}
        >
          Màu mè
        </StyledTextGradient>
      </m.div>

      <m.div variants={varFade().in}>
        <Typography
          variant="body1"
          sx={{ textAlign: 'center', color: 'text.secondary' }}
        >
          Nền tảng quản lý nội bộ dành cho hệ thống cửa hàng Cici Accessories.
          Quản lý ca làm việc, chấm công, kiểm tiền ca, lương và phê duyệt yêu cầu
          một cách tập trung, minh bạch và hiệu quả.
        </Typography>
      </m.div>

      <m.div variants={varFade().in}>
        <Stack
          spacing={1.5}
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ my: 5 }}
        >
          <Button
            component={RouterLink}
            href={paths.dashboard.root}
            color="primary"
            size="large"
            variant="contained"
            startIcon={<Iconify icon="eva:log-in-outline" width={24} />}
          >
            Vào hệ thống
          </Button>

          <Button
            component={RouterLink}
            href={paths.dashboard.shift.root}
            color="inherit"
            size="large"
            variant="outlined"
            startIcon={<Iconify icon="eva:calendar-outline" width={24} />}
          >
            Quản lý ca & lương
          </Button>
        </Stack>
      </m.div>
    </Stack>
  );

  // ----------------------------------------------------------------------

  const renderProductCards = (
    <Stack
      alignItems="center"
      justifyContent="center"
      sx={{
        height: 1,
        opacity: opacity > 0 ? opacity : 0,
        transform: `skew(${-8 - percent / 32}deg, ${2 - percent / 24}deg)`,
        ...(theme.direction === 'rtl' && {
          transform: `skew(${8 + percent / 32}deg, ${2 + percent / 24}deg)`,
        }),
      }}
    >
      <m.div variants={varFade().inDown}>
        <Typography
          variant="overline"
          sx={{
            display: 'block',
            textAlign: 'center',
            color: 'text.disabled',
            mb: 2,
            letterSpacing: 2,
          }}
        >
          Sản phẩm nổi bật
        </Typography>
      </m.div>

      <Grid
        container
        spacing={1.5}
        sx={{ maxWidth: 340 }}
      >
        {cardItems.map((product, index) => (
          <Grid key={product?.id ?? `placeholder-${index}`} size={{ xs: 6 }}>
            <ProductMiniCard
              product={product ?? undefined}
              index={index}
              loading={productsLoading}
            />
          </Grid>
        ))}
      </Grid>

      {!productsLoading && products.length === 0 && (
        <m.div variants={varFade().in}>
          <Typography
            variant="caption"
            sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 1.5 }}
          >
            Đăng nhập để xem sản phẩm
          </Typography>
        </m.div>
      )}
    </Stack>
  );

  // ----------------------------------------------------------------------

  const renderPolygons = (
    <>
      <StyledPolygon />
      <StyledPolygon anchor="right" opacity={0.48} />
      <StyledPolygon anchor="right" opacity={0.48} sx={{ height: 48, zIndex: 10 }} />
      <StyledPolygon anchor="right" sx={{ zIndex: 11, height: 24 }} />
    </>
  );

  const renderEllipses = (
    <>
      {mdUp && <StyledEllipseTop />}
      <StyledEllipseBottom />
    </>
  );

  return (
    <>
      <StyledRoot
        ref={heroRef}
        sx={{
          ...(hide && { opacity: 0 }),
        }}
      >
        <StyledWrapper>
          <Container component={MotionContainer} sx={{ height: 1 }}>
            <Grid container columnSpacing={{ md: 6 }} sx={{ height: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                {renderDescription}
              </Grid>

              {mdUp && (
                <Grid size={{ md: 6 }}>
                  {renderProductCards}
                </Grid>
              )}
            </Grid>
          </Container>

          {renderEllipses}
        </StyledWrapper>
      </StyledRoot>

      {mdUp && renderPolygons}

      <Box sx={{ height: { md: '100vh' } }} />
    </>
  );
}
