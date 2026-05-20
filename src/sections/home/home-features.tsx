'use client';

import type { BoxProps } from '@mui/material/Box';
import type { UseClientRectReturn } from 'minimal-shared/hooks';

import { useRef, useState } from 'react';
import { useClientRect } from 'minimal-shared/hooks';
import { m, useSpring, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import SvgIcon from '@mui/material/SvgIcon';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { styled, useTheme, alpha } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { varFade, MotionViewport } from 'src/components/animate';

import { SectionTitle } from './components/section-title';
import { FloatLine, FloatPlusIcon } from './components/svg-elements';

// ----------------------------------------------------------------------

const CATEGORIES = [
  {
    title: 'Trang sức & Nhẫn',
    subtitle: 'Nhẫn bạc, vòng tay, dây chuyền — tinh tế và sang trọng cho mọi dịp.',
    icon: 'solar:diamond-bold-duotone',
    gradientFrom: '#FADADD',
    gradientTo: '#F9A8D4',
  },
  {
    title: 'Kẹp tóc & Phụ kiện tóc',
    subtitle: 'Kẹp cua, kẹp bướm, băng đô, nơ tóc — từ dịu dàng đến cá tính.',
    icon: 'solar:star-bold-duotone',
    gradientFrom: '#FDE8D8',
    gradientTo: '#FBB99B',
  },
  {
    title: 'Túi & Phụ kiện thời trang',
    subtitle: 'Túi xách mini, ví da, kính mát, thắt lưng — mix match phong cách mọi outfit.',
    icon: 'solar:bag-smile-bold-duotone',
    gradientFrom: '#E8D5F5',
    gradientTo: '#C4A0E8',
  },
];

// ----------------------------------------------------------------------

const renderLines = () => (
  <>
    <FloatPlusIcon sx={{ top: 72, left: 72 }} />
    <FloatLine sx={{ top: 80, left: 0 }} />
    <FloatLine vertical sx={{ top: 0, left: 80 }} />
  </>
);

export default function HomeFeatures({ sx, ...other }: BoxProps) {
  const containerRoot = useClientRect();

  return (
    <Box
      component="section"
      id="san-pham"
      sx={[
        { position: 'relative', pt: { xs: 10, md: 20 } },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <MotionViewport>
        {renderLines()}

        <Container>
          <Stack
            ref={containerRoot.elementRef}
            spacing={5}
            sx={{ textAlign: { xs: 'center', md: 'left' }, alignItems: { xs: 'center', md: 'flex-start' } }}
          >
            <SectionTitle
              caption="Bộ sưu tập"
              title="Danh mục"
              txtGradient="sản phẩm"
            />

            <SvgIcon
              component={m.svg}
              variants={varFade('inDown', { distance: 24 })}
              sx={{ width: 28, height: 28, color: 'grey.500' }}
            >
              <path d="M13.9999 6.75956L7.74031 0.5H20.2594L13.9999 6.75956Z" fill="currentColor" opacity={0.12} />
              <path d="M13.9998 23.8264L2.14021 11.9668H25.8593L13.9998 23.8264Z" fill="currentColor" opacity={0.24} />
            </SvgIcon>
          </Stack>
        </Container>
      </MotionViewport>

      <ScrollableContent containerRoot={containerRoot} />
    </Box>
  );
}

// ----------------------------------------------------------------------

type ScrollContentProps = { containerRoot: UseClientRectReturn };

function ScrollableContent({ containerRoot }: ScrollContentProps) {
  const theme = useTheme();
  const isRtl = theme.direction === 'rtl';

  const containerRef = useRef(null);
  const containeRect = useClientRect(containerRef);

  const scrollRef = useRef(null);
  const scrollRect = useClientRect(scrollRef);

  const { scrollYProgress } = useScroll({ target: containerRef });
  const [startScroll, setStartScroll] = useState(false);

  const physics = { damping: 16, mass: 0.12, stiffness: 80 };
  const scrollRange = (-scrollRect.scrollWidth + containeRect.width / 2) * (isRtl ? -1 : 1);
  const x = useSpring(useTransform(scrollYProgress, [0, 1], [0, scrollRange]), physics);

  const background = useTransform(
    scrollYProgress,
    [0, 0.2, 0.5, 0.8, 1],
    [
      `transparent`,
      `linear-gradient(180deg, ${CATEGORIES[0].gradientFrom}, ${CATEGORIES[0].gradientTo})`,
      `linear-gradient(180deg, ${CATEGORIES[1].gradientFrom}, ${CATEGORIES[1].gradientTo})`,
      `linear-gradient(180deg, ${CATEGORIES[2].gradientFrom}, ${CATEGORIES[2].gradientTo})`,
      `linear-gradient(180deg, ${alpha(theme.palette.background.default, 1)}, ${alpha(theme.palette.background.default, 1)})`,
    ]
  );

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    setStartScroll(latest !== 0 && latest !== 1);
  });

  return (
    <ScrollRoot ref={containerRef} sx={{ height: scrollRect.scrollWidth, minHeight: '100vh' }}>
      <ScrollContainer style={{ background }} data-scrolling={startScroll}>
        <ScrollContent
          ref={scrollRef}
          style={{ x }}
          layout
          sx={{ ml: `${containerRoot.left}px` }}
          transition={{ ease: 'linear', duration: 0.25 }}
        >
          {CATEGORIES.map((item) => (
            <CategoryItem key={item.title} item={item} />
          ))}
        </ScrollContent>
      </ScrollContainer>
    </ScrollRoot>
  );
}

// ----------------------------------------------------------------------

const ScrollRoot = styled(m.div)(({ theme }) => ({
  zIndex: 9,
  position: 'relative',
  paddingTop: theme.spacing(5),
  [theme.breakpoints.up('md')]: { paddingTop: theme.spacing(8) },
}));

const ScrollContainer = styled(m.div)(({ theme }) => ({
  top: 0,
  height: '100vh',
  display: 'flex',
  position: 'sticky',
  overflow: 'hidden',
  flexDirection: 'column',
  alignItems: 'flex-start',
  transition: theme.transitions.create(['background-color']),
  '&[data-scrolling="true"]': { justifyContent: 'center' },
}));

const ScrollContent = styled(m.div)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(5),
  paddingLeft: theme.spacing(3),
  transition: theme.transitions.create(['margin-left']),
  [theme.breakpoints.up('md')]: { gap: theme.spacing(8), paddingLeft: 0 },
}));

// ----------------------------------------------------------------------

type CategoryItemProps = BoxProps & { item: (typeof CATEGORIES)[number] };

function CategoryItem({ item, sx, ...other }: CategoryItemProps) {
  return (
    <Box sx={[{ flexShrink: 0, maxWidth: 440 }, ...(Array.isArray(sx) ? sx : [sx])]} {...other}>
      <Box sx={{ mb: 5, gap: 2.5, display: 'flex', alignItems: 'flex-start' }}>
        <Iconify width={36} icon={item.icon} sx={{ mt: '8px', color: 'rgba(255,255,255,0.9)', flexShrink: 0 }} />
        <Stack spacing={2}>
          <Typography variant="h3" sx={{ color: 'rgba(255,255,255,0.95)' }}>{item.title}</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.72)', maxWidth: 360 }}>{item.subtitle}</Typography>
        </Stack>
      </Box>

      {/* Category showcase placeholder */}
      <Box
        sx={{
          width: { xs: 280, sm: 380, md: 480 },
          height: { xs: 200, md: 280 },
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.15)',
          border: '1.5px solid rgba(255,255,255,0.25)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Iconify width={72} icon={item.icon} sx={{ color: 'rgba(255,255,255,0.3)' }} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', letterSpacing: 2 }}>
          XEM TẤT CẢ
        </Typography>
      </Box>
    </Box>
  );
}
