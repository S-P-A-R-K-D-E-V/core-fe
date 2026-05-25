'use client';

import type { BoxProps } from '@mui/material/Box';
import type { Breakpoint } from '@mui/material/styles';
import type { MotionProps, MotionValue, SpringOptions } from 'framer-motion';

import { useRef, useState, useCallback } from 'react';
import { m, useScroll, useSpring, useTransform, useMotionValueEvent } from 'framer-motion';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

import { bgGradient, textGradient } from 'src/theme/css';
import Iconify from 'src/components/iconify';
import { varFade, MotionContainer } from 'src/components/animate';

import type { IProductListItem } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

const smKey: Breakpoint = 'sm';
const mdKey: Breakpoint = 'md';
const lgKey: Breakpoint = 'lg';

const motionProps: MotionProps = {
  variants: varFade('inUp', { distance: 24 }),
};

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #FADADD 0%, #F4A0C0 100%)',
  'linear-gradient(135deg, #FDE8D8 0%, #FBBFA0 100%)',
  'linear-gradient(135deg, #E8D5F5 0%, #C4A0E8 100%)',
  'linear-gradient(135deg, #D4F0E8 0%, #A0D4C4 100%)',
];

// ----------------------------------------------------------------------

function HeroBg() {
  return (
    <Box
      sx={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        position: 'absolute',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={() => ({
          ...bgGradient({
            color: 'rgba(255, 245, 248, 0.94)',
            imgUrl: '/assets/background/overlay_3.jpg',
          }),
          width: '100%',
          height: '100%',
          position: 'absolute',
        })}
      />

      {/* Subtle grid pattern */}
      <Box
        component="svg"
        sx={{ top: 0, left: 0, width: '100%', height: '100%', position: 'absolute', opacity: 0.05 }}
      >
        <defs>
          <pattern id="shopGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F472B6" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#shopGrid)" />
      </Box>

      {/* Blur glow top-right — animates slowly */}
      <Box
        component={m.div}
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.5, 0.35] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        sx={{
          top: -100,
          right: -100,
          width: 500,
          height: 500,
          borderRadius: '50%',
          position: 'absolute',
          filter: 'blur(120px)',
          backgroundColor: 'rgba(248, 200, 220, 0.35)',
        }}
      />
      {/* Blur glow bottom-left — animates offset */}
      <Box
        component={m.div}
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        sx={{
          bottom: -150,
          left: '5%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          position: 'absolute',
          filter: 'blur(100px)',
          backgroundColor: 'rgba(200, 220, 255, 0.2)',
        }}
      />
    </Box>
  );
}

// ----------------------------------------------------------------------

type ProductCardProps = {
  product?: IProductListItem;
  index: number;
  loading?: boolean;
};

function ProductCard({ product, index, loading }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const handleImgError = useCallback(() => setImgError(true), []);

  if (loading) {
    return (
      <Skeleton
        variant="rectangular"
        animation="wave"
        sx={{ borderRadius: 2, width: '100%', height: 200 }}
      />
    );
  }

  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const price = product?.sellingPrice ?? product?.basePrice ?? 0;
  const showImage = !!product?.imageUrl && !imgError;

  return (
    <m.div variants={varFade('inUp', { distance: 16 })} style={{ width: '100%' }}>
      <Card
        sx={{
          borderRadius: 2.5,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
          '&:hover': {
            transform: 'translateY(-8px) scale(1.02)',
            boxShadow: (theme) => `0 24px 48px ${alpha(theme.palette.primary.main, 0.25)}`,
          },
        }}
      >
        {/* Image / gradient banner */}
        <Box
          sx={{
            height: 130,
            background: gradient,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {showImage ? (
            <Box
              component="img"
              src={product!.imageUrl}
              alt={product!.name}
              onError={handleImgError}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
            />
          ) : (
            <m.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Iconify
                icon="solar:bag-heart-bold-duotone"
                width={48}
                sx={{ color: 'rgba(255,255,255,0.6)' }}
              />
            </m.div>
          )}

          {product?.categoryName && (
            <Chip
              label={product.categoryName}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                bgcolor: 'rgba(255,255,255,0.9)',
                fontSize: '0.6rem',
                height: 18,
                fontWeight: 700,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}

          {/* New badge */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'error.main',
              color: 'white',
              borderRadius: 1,
              px: 0.75,
              py: 0.25,
              fontSize: '0.6rem',
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            MỚI
          </Box>
        </Box>

        {/* Info */}
        <Box sx={{ p: 1.5, bgcolor: 'background.paper' }}>
          <Typography variant="caption" fontWeight={700} noWrap display="block" sx={{ mb: 0.5 }}>
            {product?.name ?? 'Sản phẩm nổi bật'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
            {price > 0 ? fCurrency(price) : 'Liên hệ'}
          </Typography>
        </Box>
      </Card>
    </m.div>
  );
}

// ----------------------------------------------------------------------

type Props = BoxProps & {
  products?: IProductListItem[];
  productsLoading?: boolean;
};

export default function HomeHero({ sx, products = [], productsLoading = true, ...other }: Props) {
  const scrollProgress = useScrollPercent();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up(mdKey));

  const distance = mdUp ? scrollProgress.percent : 0;

  const y1 = useTransformY(scrollProgress.scrollY, distance * -7);
  const y2 = useTransformY(scrollProgress.scrollY, distance * -6);
  const y3 = useTransformY(scrollProgress.scrollY, distance * -5);
  const y4 = useTransformY(scrollProgress.scrollY, distance * -4);
  const y5 = useTransformY(scrollProgress.scrollY, distance * -3);

  const opacity: MotionValue<number> = useTransform(
    scrollProgress.scrollY,
    [0, 1],
    [1, mdUp ? Number((1 - scrollProgress.percent / 100).toFixed(1)) : 1]
  );

  // Card slots: 4 items
  const cardSlots: Array<IProductListItem | null> = productsLoading
    ? [null, null, null, null]
    : products.length > 0
      ? [...products.slice(0, 4), ...Array(Math.max(0, 4 - products.length)).fill(null)]
      : [null, null, null, null];

  // ----------------------------------------------------------------------

  const renderHeading = () => (
    <m.div {...motionProps}>
      <Box
        component="h1"
        sx={{
          my: 0,
          mx: 'auto',
          maxWidth: 680,
          display: 'flex',
          flexWrap: 'wrap',
          typography: 'h2',
          justifyContent: 'center',
          [theme.breakpoints.up(lgKey)]: {
            fontSize: theme.typography.pxToRem(64),
            lineHeight: '80px',
          },
        }}
      >
        <Box component="span" sx={{ width: 1, opacity: 0.45, textAlign: 'center' }}>
          Khám phá thế giới
        </Box>
        <Box
          component={m.span}
          animate={{ backgroundPosition: '200% center' }}
          transition={{ duration: 20, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
          sx={{
            ...textGradient(`300deg, #F43F5E 0%, #EC4899 30%, #A855F7 60%, #EC4899 80%, #F43F5E 100%`),
            backgroundSize: '400%',
            ml: { xs: 0.5, md: 1 },
          }}
        >
          CiCi Accessories
        </Box>
      </Box>
    </m.div>
  );

  const renderText = () => (
    <m.div {...motionProps}>
      <Typography
        variant="body1"
        sx={{
          mx: 'auto',
          maxWidth: 560,
          textAlign: 'center',
          color: 'text.secondary',
          [theme.breakpoints.up(lgKey)]: { fontSize: 18, lineHeight: '32px' },
        }}
      >
        Phụ kiện thời trang nữ — trang sức, kẹp tóc, túi mini và hơn thế nữa.
        {' '}Phong cách, cá tính, giá cả hợp lý.
      </Typography>
    </m.div>
  );

  const renderBadges = () => (
    <m.div {...motionProps}>
      <Stack
        direction="row"
        spacing={1.5}
        flexWrap="wrap"
        justifyContent="center"
        sx={{ gap: 1 }}
      >
        {[
          { icon: 'solar:star-bold-duotone', label: '2,000+ khách hàng' },
          { icon: 'solar:map-point-bold-duotone', label: '21 Chùa Láng, Hà Nội' },
          { icon: 'solar:chat-round-bold-duotone', label: 'Tư vấn miễn phí' },
        ].map((b) => (
          <Chip
            key={b.label}
            icon={<Iconify icon={b.icon} width={16} />}
            label={b.label}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: 'text.primary',
              fontWeight: 600,
              '& .MuiChip-icon': { color: 'primary.main' },
            }}
          />
        ))}
      </Stack>
    </m.div>
  );

  const renderButtons = () => (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: { xs: 1.5, sm: 2 },
      }}
    >
      <m.div {...motionProps}>
        <Button
          component={RouterLink}
          href="#san-pham"
          color="primary"
          size="large"
          variant="contained"
          startIcon={<Iconify width={20} icon="solar:bag-smile-bold-duotone" />}
        >
          Xem bộ sưu tập
        </Button>
      </m.div>

      <m.div {...motionProps}>
        <Button
          size="large"
          color="inherit"
          variant="outlined"
          href="https://m.me/ciciaccessories"
          target="_blank"
          rel="noopener"
          startIcon={<Iconify width={20} icon="logos:messenger" />}
        >
          Nhắn tin đặt hàng
        </Button>
      </m.div>
    </Box>
  );

  const renderLoginButton = () => (
    <m.div {...motionProps}>
      <Button
        component={RouterLink}
        href={paths.auth.jwt.login}
        size="medium"
        variant="soft"
        color="inherit"
        startIcon={<Iconify icon="solar:lock-keyhole-minimalistic-bold-duotone" width={18} />}
        sx={{
          color: 'text.secondary',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.25s ease',
          '&:hover': {
            bgcolor: 'background.paper',
            borderColor: 'primary.main',
            color: 'primary.main',
            transform: 'translateY(-2px)',
            boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.18)}`,
          },
        }}
      >
        Đăng nhập nhân viên
      </Button>
    </m.div>
  );

  // Right column: product cards
  const renderProductGrid = () => (
    <Stack
      alignItems="center"
      justifyContent="center"
      sx={{
        height: 1,
        opacity: Number((1 - scrollProgress.percent / 100).toFixed(2)),
        transform: `skew(${-6 - scrollProgress.percent / 40}deg, ${1.5 - scrollProgress.percent / 28}deg)`,
      }}
    >
      <m.div variants={varFade('inDown', { distance: 16 })}>
        <Typography
          variant="overline"
          sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mb: 2, letterSpacing: 2 }}
        >
          Sản phẩm nổi bật
        </Typography>
      </m.div>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1.5,
          width: '100%',
          maxWidth: 340,
        }}
      >
        {cardSlots.map((product, idx) => (
          <ProductCard
            key={product?.id ?? `slot-${idx}`}
            product={product ?? undefined}
            index={idx}
            loading={productsLoading}
          />
        ))}
      </Box>

      {!productsLoading && products.length === 0 && (
        <m.div variants={varFade('in')}>
          <Typography variant="caption" sx={{ color: 'text.disabled', mt: 1.5, display: 'block', textAlign: 'center' }}>
            Đang cập nhật sản phẩm...
          </Typography>
        </m.div>
      )}
    </Stack>
  );

  // ----------------------------------------------------------------------

  return (
    <Box
      ref={scrollProgress.elementRef}
      component="section"
      sx={[
        {
          overflow: 'hidden',
          position: 'relative',
          [theme.breakpoints.up(mdKey)]: {
            minHeight: 760,
            height: '100vh',
            maxHeight: 1440,
            display: 'block',
            willChange: 'opacity',
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box
        component={m.div}
        style={{ opacity }}
        sx={{
          width: 1,
          display: 'flex',
          position: 'relative',
          flexDirection: 'column',
          [theme.breakpoints.up(mdKey)]: {
            height: 1,
            position: 'fixed',
            maxHeight: 'inherit',
          },
        }}
      >
        {/* Background */}
        <HeroBg />

        <Container
          component={MotionContainer}
          sx={{
            py: 3,
            zIndex: 9,
            position: 'relative',
            display: 'flex',
            [theme.breakpoints.up(mdKey)]: {
              flex: '1 1 auto',
              alignItems: 'center',
              py: 'var(--layout-header-desktop-height, 80px)',
            },
          }}
        >
          <Box
            sx={{
              width: 1,
              display: 'flex',
              gap: 5,
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
            }}
          >
            {/* Left: text content */}
            <Stack
              spacing={4}
              alignItems="center"
              sx={{ flex: 1, minWidth: 0 }}
            >
              <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center' }}>
                <m.div style={{ y: y1 }}>{renderHeading()}</m.div>
                <m.div style={{ y: y2 }}>{renderText()}</m.div>
              </Stack>

              <m.div style={{ y: y3 }}>{renderBadges()}</m.div>
              <m.div style={{ y: y4 }}>{renderButtons()}</m.div>
              <m.div style={{ y: y5 }}>{renderLoginButton()}</m.div>
            </Stack>

            {/* Right: product cards (desktop only) */}
            {mdUp && (
              <Box sx={{ flexShrink: 0, width: 360, height: '100%' }}>
                {renderProductGrid()}
              </Box>
            )}
          </Box>
        </Container>
      </Box>

      {/* Spacer to push content below fixed hero */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, height: '100vh' }} />
    </Box>
  );
}

// ----------------------------------------------------------------------

function useTransformY(value: MotionValue<number>, distance: number) {
  const physics: SpringOptions = {
    mass: 0.1,
    damping: 20,
    stiffness: 300,
    restDelta: 0.001,
  };
  return useSpring(useTransform(value, [0, 1], [0, distance]), physics);
}

function useScrollPercent() {
  const elementRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [percent, setPercent] = useState(0);

  useMotionValueEvent(scrollY, 'change', (scrollHeight) => {
    let heroHeight = 0;
    if (elementRef.current) {
      heroHeight = elementRef.current.offsetHeight;
    }
    const scrollPercent = Math.floor((scrollHeight / heroHeight) * 100);
    setPercent(scrollPercent >= 100 ? 100 : scrollPercent);
  });

  return { elementRef, percent, scrollY };
}
