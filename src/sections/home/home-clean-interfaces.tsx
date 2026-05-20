'use client';

import type { BoxProps } from '@mui/material/Box';

import { m } from 'framer-motion';
import { alpha } from '@mui/material/styles';


import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { varFade, MotionViewport } from 'src/components/animate';
import Iconify from 'src/components/iconify';

import { SectionTitle } from './components/section-title';
import { FloatLine, FloatPlusIcon } from './components/svg-elements';

// ----------------------------------------------------------------------

const REASONS = [
  {
    icon: 'solar:shield-check-bold-duotone',
    title: 'Chất lượng đảm bảo',
    desc: 'Kiểm định kỹ từng sản phẩm trước khi đến tay khách — chỉ bán hàng đạt chuẩn, chắc chắn về mẫu mã và chất liệu.',
    color: '#EC4899',
  },
  {
    icon: 'solar:map-point-bold-duotone',
    title: 'Dễ tìm, dễ ghé',
    desc: 'Cửa hàng duy nhất tại 21 Chùa Láng, Hà Nội. Ghé xem hàng thực tế, được tư vấn trực tiếp miễn phí.',
    color: '#8B5CF6',
  },
  {
    icon: 'solar:heart-bold-duotone',
    title: 'Chăm sóc tận tình',
    desc: 'Tư vấn phụ kiện miễn phí qua Messenger. Đội ngũ nhiệt tình, phản hồi trong vòng 30 phút.',
    color: '#F59E0B',
  },
  {
    icon: 'solar:tag-price-bold-duotone',
    title: 'Giá hợp lý',
    desc: 'Cam kết giá tốt nhất thị trường. Khách hàng thân thiết hưởng ưu đãi tích điểm đặc biệt.',
    color: '#10B981',
  },
];

// ----------------------------------------------------------------------

const renderLines = () => (
  <>
    <FloatPlusIcon sx={{ top: 72, right: 72 }} />
    <FloatLine sx={{ top: 80, left: 0 }} />
    <FloatLine vertical sx={{ top: 0, right: 80 }} />
  </>
);

export default function HomeCleanInterfaces({ sx, ...other }: BoxProps) {
  return (
    <Box
      component="section"
      sx={[
        { overflow: 'hidden', position: 'relative', py: { xs: 10, md: 20 } },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <MotionViewport>
        {renderLines()}

        <Container sx={{ position: 'relative' }}>
          <SectionTitle
            caption="Tại sao chọn CiCi"
            title="Cam kết"
            txtGradient="từ chúng tôi"
            sx={{ mb: { xs: 6, md: 10 }, textAlign: 'center', alignItems: 'center' }}
          />

          <Grid container spacing={3}>
            {REASONS.map((item, index) => (
              <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                <Box
                  component={m.div}
                  variants={varFade('inUp', { distance: 24 })}
                  sx={[
                    (theme) => ({
                      p: 4,
                      height: 1,
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      bgcolor: alpha(theme.palette.grey[500], 0.04),
                      border: `1px solid ${alpha(theme.palette.grey[500], 0.08)}`,
                      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                      '&:hover': {
                        transform: 'translateY(-6px)',
                        boxShadow: `0 20px 40px ${alpha(item.color, 0.12)}`,
                        bgcolor: alpha(theme.palette.grey[500], 0.07),
                      },
                    }),
                  ]}
                >
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2.5,
                      bgcolor: `${item.color}18`,
                    }}
                  >
                    <Iconify icon={item.icon} width={32} sx={{ color: item.color }} />
                  </Box>

                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {item.desc}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </MotionViewport>
    </Box>
  );
}
