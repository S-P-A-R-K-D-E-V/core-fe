import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { varFade, MotionViewport } from 'src/components/animate';

// ----------------------------------------------------------------------

const CARDS = [
  {
    icon: ' /assets/icons/home/ic_make_brand.svg',
    title: 'Quản lý ca làm việc',
    description: 'Sắp xếp ca làm việc linh hoạt, theo dõi lịch trình nhân viên dễ dàng, tối ưu hóa nhân lực cho cửa hàng.',
  },
  {
    icon: ' /assets/icons/home/ic_design.svg',
    title: 'Chấm công & Lương',
    description:
      'Hệ thống chấm công tự động với GPS, tính lương chính xác theo ca làm việc, phụ cấp và thưởng. Minh bạch và công bằng.',
  },
  {
    icon: ' /assets/icons/home/ic_development.svg',
    title: 'Kiểm tiền ca',
    description: 'Quản lý tiền mặt quầy, đối chiếu doanh thu KiotViet, chốt ca nhanh chóng. Hạn chế sai sót và thất thoát.',
  },
];

// ----------------------------------------------------------------------

export default function HomeMinimal() {
  return (
    <Container
      component={MotionViewport}
      sx={{
        py: { xs: 10, md: 15 },
      }}
    >
      <Stack
        spacing={3}
        sx={{
          textAlign: 'center',
          mb: { xs: 5, md: 10 },
        }}
      >
        <m.div variants={varFade().inUp}>
          <Typography component="div" variant="overline" sx={{ color: 'text.disabled' }}>
            CiCi Accessories
          </Typography>
        </m.div>

        <m.div variants={varFade().inDown}>
          <Typography variant="h2">
            Công cụ nội bộ <br /> giúp bạn điều gì?
          </Typography>
        </m.div>
      </Stack>

      <Box
        gap={{ xs: 3, lg: 10 }}
        display="grid"
        alignItems="center"
        gridTemplateColumns={{
          xs: 'repeat(1, 1fr)',
          md: 'repeat(3, 1fr)',
        }}
      >
        {CARDS.map((card, index) => (
          <m.div variants={varFade().inUp} key={card.title}>
            <Card
              sx={{
                textAlign: 'center',
                boxShadow: { md: 'none' },
                bgcolor: 'background.default',
                p: (theme) => theme.spacing(10, 5),
                ...(index === 1 && {
                  boxShadow: (theme) => ({
                    md: `-40px 40px 80px ${
                      theme.palette.mode === 'light'
                        ? alpha(theme.palette.grey[500], 0.16)
                        : alpha(theme.palette.common.black, 0.4)
                    }`,
                  }),
                }),
              }}
            >
              <Box
                component="img"
                src={card.icon}
                alt={card.title}
                sx={{ mx: 'auto', width: 48, height: 48 }}
              />

              <Typography variant="h5" sx={{ mt: 8, mb: 2 }}>
                {card.title}
              </Typography>

              <Typography sx={{ color: 'text.secondary' }}>{card.description}</Typography>
            </Card>
          </m.div>
        ))}
      </Box>
    </Container>
  );
}
