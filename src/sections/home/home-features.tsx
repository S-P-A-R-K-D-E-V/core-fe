'use client';

import type { CSSProperties } from 'react';
import type { MotionValue } from 'framer-motion';
import type { BoxProps } from '@mui/material/Box';
import type { TenantBranding, StorefrontProduct } from 'src/lib/tenant-branding';

import { useRef, useState } from 'react';
import { m, useScroll, useTransform } from 'framer-motion';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { styled, useTheme, alpha } from '@mui/material/styles';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import Iconify from 'src/components/iconify';
import { varFade, MotionViewport } from 'src/components/animate';
import { GlareHover, SpotlightCard } from 'src/components/react-bits';

import { displayCategory } from 'src/lib/store-seo';
import { storeIndustry, type IndustryPreset } from 'src/lib/store-industry';

import { SectionTitle } from './components/section-title';
import { useDecorativeMotion } from './components/use-decorative-motion';
import { FloatLine, FloatPlusIcon } from './components/svg-elements';

/** Parallax: số px mỗi cột (trái / giữa / phải) trôi lên trong lúc cả mục đi qua màn hình — cột giữa nhanh nhất. */
const PARALLAX_SHIFT = [40, 110, 70];

// ----------------------------------------------------------------------

type CategoryCard = {
  title: string;
  subtitle: string;
  icon: string;
  gradientFrom: string;
  gradientTo: string;
  /** Sản phẩm có ảnh trong nhóm — ảnh minh hoạ của thẻ. */
  product?: StorefrontProduct;
};

/** Thẻ danh mục từ nhóm hàng THẬT của cửa hàng (thay ba danh mục trang sức / kẹp tóc / túi cố định của CiCi). */
function buildCategoryCards(
  categories: string[],
  products: StorefrontProduct[],
  industry: IndustryPreset
): CategoryCard[] {
  const { cards } = industry.palette;
  return categories.slice(0, 6).map((title, i) => {
    const key = title.toLocaleLowerCase('vi');
    const inCategory = products.filter(
      (p) => !!p.categoryName && displayCategory(p.categoryName).toLocaleLowerCase('vi') === key
    );
    const names = inCategory.slice(0, 3).map((p) => p.name);
    const gradient = cards[i % cards.length];
    return {
      title,
      subtitle: names.length ? `${names.join(', ')}${inCategory.length > 3 ? '…' : ''}` : '',
      icon: industry.categoryIcons[i % industry.categoryIcons.length],
      gradientFrom: gradient.from,
      gradientTo: gradient.to,
      product: inCategory.find((p) => !!p.imageUrl),
    };
  });
}

// ----------------------------------------------------------------------

const renderLines = () => (
  <>
    <FloatPlusIcon sx={{ top: 72, left: 72 }} />
    <FloatLine sx={{ top: 80, left: 0 }} />
    <FloatLine vertical sx={{ top: 0, left: 80 }} />
  </>
);

type Props = BoxProps & {
  products?: StorefrontProduct[];
  categories?: string[];
  branding?: TenantBranding | null;
};

export default function HomeFeatures({
  sx,
  products = [],
  categories = [],
  branding,
  ...other
}: Props) {
  const industry = storeIndustry(branding);
  const { words } = industry;
  const cards = buildCategoryCards(categories, products, industry);

  // Parallax theo vị trí của cả mục trên màn hình: 0 khi mép trên mục chạm đáy màn hình, 1 khi mép dưới chạm đỉnh.
  // Chỉ dời transform (không render lại React); tắt trên điện thoại và khi người dùng chọn giảm chuyển động.
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const parallax = useDecorativeMotion();

  // Chưa có nhóm hàng nào → bỏ cả mục, không hiện danh mục mẫu.
  if (cards.length === 0) return null;

  return (
    <Box
      ref={sectionRef}
      component="section"
      id="san-pham"
      sx={[{ position: 'relative', py: { xs: 10, md: 15 } }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <MotionViewport>
        {renderLines()}

        <Container sx={{ position: 'relative' }}>
          <SectionTitle
            caption={industry.key === 'fashion' ? 'Bộ sưu tập' : words.items}
            title="Danh mục"
            txtGradient={words.item}
            gradientColors={industry.palette.headline}
            sx={{
              mb: { xs: 5, md: 8 },
              textAlign: { xs: 'center', md: 'left' },
              alignItems: { xs: 'center', md: 'flex-start' },
            }}
          />

          {/* Điện thoại: một hàng vuốt ngang bằng cuộn gốc của trình duyệt (scroll-snap); màn hình lớn: lưới 3 cột trôi
              parallax. Bỏ kiểu "cuộn dọc thành cuộn ngang" của mẫu cũ — khối sticky cao bằng cả bề ngang dải thẻ để lại
              khoảng trắng dài, chữ trắng nằm trên nền trắng lúc đầu và cuối mục, thẻ cuối bị cắt trên màn hình rộng. */}
          <Box
            component="ul"
            sx={{
              m: 0,
              p: 0,
              listStyle: 'none',
              display: 'grid',
              gap: { xs: 2, md: 3 },
              gridAutoFlow: { xs: 'column', md: 'row' },
              gridAutoColumns: {
                xs: 'min(78%, 320px)',
                sm: 'calc((100% - 16px) / 2.2)',
                md: 'auto',
              },
              gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))' },
              overflowX: { xs: 'auto', md: 'visible' },
              scrollSnapType: { xs: 'x mandatory', md: 'none' },
              // Dải thẻ chạy sát mép màn hình khi vuốt, thẻ đầu vẫn thẳng lề nội dung.
              mx: { xs: -2, sm: -3, md: 0 },
              px: { xs: 2, sm: 3, md: 0 },
              scrollPaddingInline: { xs: '16px', sm: '24px' },
              pt: 1,
              pb: 2,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              '& > li': { scrollSnapAlign: 'start' },
            }}
          >
            {cards.map((item, index) => (
              <m.li key={item.title} variants={varFade('inUp', { distance: 24 })}>
                <CategoryItem
                  item={item}
                  index={index}
                  progress={scrollYProgress}
                  parallax={parallax}
                />
              </m.li>
            ))}
          </Box>
        </Container>
      </MotionViewport>
    </Box>
  );
}

// ----------------------------------------------------------------------

/** Thẻ SpotlightCard (React Bits): quầng sáng màu nhóm hàng theo con trỏ / tiêu điểm bàn phím, không chạy khi đứng yên. */
const CardRoot = styled(SpotlightCard)(({ theme }) => ({
  padding: 0,
  height: '100%',
  borderRadius: Number(theme.shape.borderRadius) * 2.5,
  transition: theme.transitions.create(['transform', 'box-shadow'], {
    duration: theme.transitions.duration.short,
  }),
  '& .category-img, & .category-arrow': {
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.complex,
    }),
  },
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.customShadows.z20,
  },
  '&:hover .category-img': { transform: 'scale(1.06)' },
  '&:hover .category-arrow': { transform: 'translateX(4px)' },
  '@media (prefers-reduced-motion: reduce)': {
    '&, & .category-img, & .category-arrow': { transition: 'none', transform: 'none !important' },
  },
}));

type CategoryItemProps = {
  item: CategoryCard;
  index: number;
  /** scrollYProgress của cả mục (0 → 1). */
  progress: MotionValue<number>;
  parallax: boolean;
};

function CategoryItem({ item, index, progress, parallax }: CategoryItemProps) {
  const theme = useTheme();
  const { product } = item;
  const [imageError, setImageError] = useState(false);
  const showImage = !!product?.imageUrl && !imageError;
  const gradient = `linear-gradient(135deg, ${item.gradientFrom} 0%, ${item.gradientTo} 100%)`;

  // Thẻ trôi theo cột với tốc độ khác nhau; ảnh trong thẻ trôi ngược chiều, chậm hơn khung (cảm giác chiều sâu).
  const shift = PARALLAX_SHIFT[index % PARALLAX_SHIFT.length];
  const cardY = useTransform(progress, [0, 1], [shift, -shift]);
  const imageY = useTransform(progress, [0, 1], ['-8%', '8%']);

  return (
    <m.div style={{ height: '100%', y: parallax ? cardY : 0 }}>
      <CardRoot
        tone={theme.palette.mode}
        spotlightColor={item.gradientFrom}
        spotlightSize={320}
        intensity={1}
        borderGlow={0.9}
        style={
          {
            '--spotlight-card-surface': theme.palette.background.paper,
            '--spotlight-card-border': alpha(theme.palette.grey[500], 0.16),
          } as CSSProperties
        }
      >
        <Box
          component={RouterLink}
          href={paths.product.root}
          sx={{
            height: 1,
            display: 'flex',
            color: 'inherit',
            borderRadius: 'inherit',
            flexDirection: 'column',
            textDecoration: 'none',
            '&:focus-visible': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: -2,
            },
          }}
        >
          {/* Ảnh một sản phẩm thật của nhóm (không có ảnh thì icon trên nền màu nhóm); vệt sáng GlareHover lướt qua khi rê chuột. */}
          <GlareHover
            width="100%"
            borderRadius="0"
            glareOpacity={0.35}
            glareAngle={-35}
            glareSize={40}
          >
            <Box
              sx={{
                width: 1,
                aspectRatio: '4 / 3',
                display: 'flex',
                overflow: 'hidden',
                position: 'relative',
                alignItems: 'center',
                justifyContent: 'center',
                background: gradient,
              }}
            >
              {showImage ? (
                // Khung ảnh cao hơn ô 24% (thừa 12% trên + dưới) để ảnh trôi ±8% mà không lộ mép.
                <Box
                  component={m.div}
                  style={{ y: parallax ? imageY : 0 }}
                  sx={{ position: 'absolute', top: '-12%', bottom: '-12%', left: 0, right: 0 }}
                >
                  <Box
                    component="img"
                    className="category-img"
                    src={product!.imageUrl!}
                    alt={product!.name}
                    loading="lazy"
                    decoding="async"
                    onError={() => setImageError(true)}
                    sx={{ width: 1, height: 1, display: 'block', objectFit: 'cover' }}
                  />
                </Box>
              ) : (
                <Iconify
                  className="category-img"
                  width={64}
                  icon={item.icon}
                  sx={{ color: 'rgba(255,255,255,0.88)' }}
                />
              )}
            </Box>
          </GlareHover>

          <Stack spacing={1} sx={{ p: 2.5, flexGrow: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  display: 'grid',
                  borderRadius: 1.25,
                  placeItems: 'center',
                  background: gradient,
                }}
              >
                <Iconify width={20} icon={item.icon} sx={{ color: 'common.white' }} />
              </Box>
              <Typography component="h3" variant="h6">
                {item.title}
              </Typography>
            </Stack>

            {item.subtitle && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {item.subtitle}
              </Typography>
            )}

            <Box
              sx={{
                mt: 'auto !important',
                pt: 1,
                gap: 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                typography: 'subtitle2',
              }}
            >
              Xem tất cả
              <Iconify className="category-arrow" width={18} icon="eva:arrow-forward-fill" />
            </Box>
          </Stack>
        </Box>
      </CardRoot>
    </m.div>
  );
}
