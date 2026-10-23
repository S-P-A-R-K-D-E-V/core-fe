'use client';

import { useState, useEffect } from 'react';
import { useScroll } from 'framer-motion';

import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';

import MainLayout from 'src/layouts/main';

import ScrollProgress from 'src/components/scroll-progress';
import Iconify from 'src/components/iconify';

import { CICI_TENANT } from 'src/lib/store-seo';
import { SEASONS, type SeasonKey } from 'src/lib/store-season';
import type { TenantBranding, StorefrontProduct } from 'src/lib/tenant-branding';

import HomeHero from '../home-hero';
import HomeMinimal from '../home-minimal';
import HomeFeatures from '../home-features';
import HomeAiAssistant from '../home-ai-assistant';
import HomeCleanInterfaces from '../home-clean-interfaces';
import HomeTestimonials from '../home-testimonials';
import HomeFAQs from '../home-faqs';
import HomeAdvertisement from '../home-advertisement';
import { Snowfall } from '../components/snowfall';
import { SeasonProvider } from '../components/season-context';

// ----------------------------------------------------------------------

type Props = {
  branding: TenantBranding | null;
  /** Sản phẩm đang bán của cửa hàng — app/page.tsx đọc sẵn phía server (HTML đã có tên, giá, nhóm hàng). */
  products: StorefrontProduct[];
  productTotal: number;
  /** Nhóm hàng có nhiều sản phẩm nhất (src/lib/store-seo.ts topCategories). */
  categories: string[];
  /** Mô tả cửa hàng đã dựng cho thẻ meta — dùng lại làm câu giới thiệu khi chủ cửa hàng chưa viết mô tả. */
  description: string;
  /** Mùa lễ đang hiện (src/lib/store-season.ts) — null ngoài mùa hoặc cửa hàng đã tắt. */
  season?: SeasonKey | null;
};

export default function HomeView({
  branding,
  products,
  productTotal,
  categories,
  description,
  season = null,
}: Props) {
  const { scrollYProgress } = useScroll();

  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Đánh giá khách hàng và "Tại sao chọn…" là câu chữ viết riêng cho CiCi — cửa hàng khác không hiện nội dung
  // không phải của mình. Không đọc được branding (máy dev) thì coi như CiCi như trước.
  const isCiCi = !branding || branding.tenantCode === CICI_TENANT;
  // Hero ưu tiên sản phẩm có ảnh.
  const featured = [
    ...products.filter((p) => !!p.imageUrl),
    ...products.filter((p) => !p.imageUrl),
  ].slice(0, 4);

  return (
    <SeasonProvider value={season}>
      <MainLayout hasProducts={products.length > 0} logoUrl={branding?.logoUrl} branding={branding}>
        <ScrollProgress scrollYProgress={scrollYProgress} />

        <HomeHero products={featured} branding={branding} categories={categories} />

        {/* overflow "clip" thay "hidden": vẫn cắt phần tràn ngang nhưng không tạo khung cuộn riêng (không làm hỏng
          position: sticky nếu sau này có mục dùng). */}
        <Box
          sx={{
            overflow: 'clip',
            position: 'relative',
            bgcolor: 'background.default',
          }}
        >
          <HomeAiAssistant branding={branding} />

          <HomeMinimal
            products={products}
            productTotal={productTotal}
            categories={categories}
            branding={branding}
            description={description}
          />

          <HomeFeatures products={products} categories={categories} branding={branding} />

          {isCiCi && <HomeCleanInterfaces branding={branding} />}

          {isCiCi && <HomeTestimonials />}

          <HomeFAQs branding={branding} categories={categories} isCiCi={isCiCi} />

          <HomeAdvertisement branding={branding} productTotal={productTotal} />
        </Box>

        {showBackToTop && (
          <Fab
            size="small"
            color="primary"
            aria-label="Lên đầu trang"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            sx={{
              position: 'fixed',
              bottom: { xs: 24, md: 32 },
              right: { xs: 24, md: 32 },
              zIndex: (theme) => theme.zIndex.speedDial,
            }}
          >
            <Iconify icon="eva:arrow-up-fill" width={20} />
          </Fab>
        )}

        {season && <Snowfall glyphs={SEASONS[season].particles} />}
      </MainLayout>
    </SeasonProvider>
  );
}
