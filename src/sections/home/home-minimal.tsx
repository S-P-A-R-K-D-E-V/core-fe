'use client';

import type { BoxProps } from '@mui/material/Box';

import { useState } from 'react';
import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import SvgColor from 'src/components/svg-color';
import Iconify from 'src/components/iconify';
import { varFade, MotionViewport } from 'src/components/animate';

import { CICI_TENANT } from 'src/lib/store-seo';
import { storeIndustry } from 'src/lib/store-industry';
import type { TenantBranding, StorefrontProduct } from 'src/lib/tenant-branding';

import { SectionTitle } from './components/section-title';
import { CircleSvg, FloatLine, FloatPlusIcon } from './components/svg-elements';

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

type Props = BoxProps & {
  products?: StorefrontProduct[];
  productTotal?: number;
  categories?: string[];
  branding?: TenantBranding | null;
  /** Mô tả đã dựng cho thẻ meta (app/page.tsx) — câu giới thiệu khi chủ cửa hàng chưa viết mô tả ngắn. */
  description?: string;
};

export default function HomeMinimal({
  sx,
  products = [],
  productTotal = 0,
  categories = [],
  branding,
  description,
  ...other
}: Props) {
  const [imageError, setImageError] = useState(false);
  const featuredImage = products.find((p) => !!p.imageUrl);
  const storeName = branding?.storeName ?? 'CiCi Accessories';
  const industry = storeIndustry(branding);
  const { words } = industry;
  const isCiCi = !branding || branding.tenantCode === CICI_TENANT;
  const chat = branding?.messengerLink || branding?.zaloLink;

  // Chỉ nêu điều có thật từ dữ liệu cửa hàng: số mặt hàng / nhóm hàng đang bán, địa chỉ, cách liên hệ.
  const items = [
    ...(productTotal > 0
      ? [
          {
            icon: `/assets/icons/home/ic_make_brand.svg`,
            title: `${productTotal} ${words.item} đang bán`,
            description: categories.length
              ? `Gồm ${categories.slice(0, 4).join(', ')}${categories.length > 4 ? '…' : ''}. Xem giá ngay trên trang.`
              : `${words.cta} và giá ngay trên trang.`,
          },
        ]
      : []),
    ...(isCiCi
      ? [
          {
            icon: `/assets/icons/home/ic_design.svg`,
            title: 'Chất lượng đảm bảo',
            description:
              'Sản phẩm được tuyển chọn kỹ lưỡng, chất liệu an toàn, bền đẹp. Đội ngũ kiểm định kỹ trước khi đến tay khách hàng.',
          },
        ]
      : []),
    ...(branding?.address
      ? [
          {
            icon: `/assets/icons/home/ic_development.svg`,
            title: 'Ghé thăm cửa hàng',
            description: `Ghé thăm trực tiếp tại ${branding.address} để xem và chọn ${words.item}.`,
          },
        ]
      : []),
    ...(branding?.phone || chat
      ? [
          {
            icon: `/assets/icons/home/ic_design.svg`,
            title: `Liên hệ ${words.order}`,
            description: branding?.phone
              ? `Gọi ${branding.phone}${chat ? ' hoặc nhắn tin qua Messenger / Zalo' : ''}.`
              : 'Nhắn tin qua Messenger / Zalo để được tư vấn.',
          },
        ]
      : []),
  ];

  const renderDescription = () => (
    <>
      <SectionTitle
        caption="Về chúng tôi"
        title={storeName}
        txtGradient=""
        description={
          branding?.shortDescription ??
          (branding && description
            ? description
            : `${storeName} ra đời với mong muốn mang đến trải nghiệm mua sắm tốt nhất — sản phẩm chọn lọc kỹ, cập nhật liên tục, giá cả hợp lý.`)
        }
        sx={{ mb: { xs: 5, md: 8 }, textAlign: { xs: 'center', md: 'left' } }}
      />

      <Stack spacing={6} sx={{ maxWidth: { sm: 560, md: 400 }, mx: { xs: 'auto', md: 'unset' } }}>
        {items.map((item) => (
          <Box
            component={m.div}
            variants={varFade('inUp', { distance: 24 })}
            key={item.title}
            sx={[{ gap: 3, display: 'flex' }]}
          >
            <SvgColor src={item.icon} sx={{ width: 40, height: 40, flexShrink: 0, color: 'primary.main' }} />
            <Stack spacing={1}>
              <Typography variant="h5" component="h3">
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
            height: 480,
            borderRadius: 2,
            position: 'absolute',
            bgcolor: 'background.default',
            boxShadow: `-40px 40px 80px 0px ${alpha(theme.palette.grey[500], 0.16)}`,
            overflow: 'hidden',
          }),
        ]}
      >
        {featuredImage && !imageError ? (
          <Box
            component="img"
            alt={featuredImage.name}
            src={featuredImage.imageUrl!}
            loading="lazy"
            onError={() => setImageError(true)}
            sx={{ width: 1, height: 1, borderRadius: 2, objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              width: 1,
              height: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: (theme) =>
                `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.24)}, ${alpha(theme.palette.secondary.light, 0.24)})`,
            }}
          >
            <Iconify
              icon={industry.icon}
              width={96}
              sx={{ color: 'primary.main', opacity: 0.5 }}
            />
          </Box>
        )}
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
