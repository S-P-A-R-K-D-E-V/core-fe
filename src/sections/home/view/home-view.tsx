'use client';

import { useState, useEffect } from 'react';
import { useScroll } from 'framer-motion';

import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';

import MainLayout from 'src/layouts/main';

import ScrollProgress from 'src/components/scroll-progress';
import Iconify from 'src/components/iconify';

import { getAllProducts } from 'src/api/products';
import type { IProductListItem } from 'src/types/corecms-api';

import HomeHero from '../home-hero';
import HomeMinimal from '../home-minimal';
import HomeFeatures from '../home-features';
import HomeCleanInterfaces from '../home-clean-interfaces';
import HomeTestimonials from '../home-testimonials';
import HomeFAQs from '../home-faqs';
import HomeAdvertisement from '../home-advertisement';

// ----------------------------------------------------------------------

export default function HomeView() {
  const { scrollYProgress } = useScroll();

  const [showBackToTop, setShowBackToTop] = useState(false);
  const [products, setProducts] = useState<IProductListItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    getAllProducts({ page: 1, pageSize: 4, isActive: true })
      .then((res) => setProducts(res.items.slice(0, 4)))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, []);

  return (
    <MainLayout>
      <ScrollProgress scrollYProgress={scrollYProgress} />

      <HomeHero products={products} productsLoading={productsLoading} />

      <Box
        sx={{
          overflow: 'hidden',
          position: 'relative',
          bgcolor: 'background.default',
        }}
      >
        <HomeMinimal />

        <HomeFeatures />

        <HomeCleanInterfaces />

        <HomeTestimonials />

        <HomeFAQs />

        <HomeAdvertisement />
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
    </MainLayout>
  );
}
