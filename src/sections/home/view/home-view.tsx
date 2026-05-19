'use client';

import { useScroll } from 'framer-motion';

import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';

import MainLayout from 'src/layouts/main';

import ScrollProgress from 'src/components/scroll-progress';
import Iconify from 'src/components/iconify';

import HomeHero from '../home-hero';
import HomeMinimal from '../home-minimal';
import HomeFeatures from '../home-features';
import HomeCleanInterfaces from '../home-clean-interfaces';
import HomeAdvertisement from '../home-advertisement';

// ----------------------------------------------------------------------

export default function HomeView() {
  const { scrollYProgress } = useScroll();

  return (
    <MainLayout>
      <ScrollProgress scrollYProgress={scrollYProgress} />

      <HomeHero />

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

        <HomeAdvertisement />
      </Box>

      <Fab
        size="small"
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
    </MainLayout>
  );
}
