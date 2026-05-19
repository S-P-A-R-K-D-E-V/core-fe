import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useTheme, alpha } from '@mui/material/styles';

import Iconify from 'src/components/iconify';
import { varFade, MotionViewport } from 'src/components/animate';

// ----------------------------------------------------------------------

const FEATURES = [
  {
    icon: 'solar:shop-bold-duotone',
    title: 'Bán hàng POS',
    description:
      'Hệ thống bán hàng tích hợp KiotViet. Quản lý đơn hàng, thanh toán nhanh chóng, đối soát doanh thu theo ca.',
    color: '#00B8D9',
  },
  {
    icon: 'solar:box-bold-duotone',
    title: 'Quản lý kho hàng',
    description:
      'Theo dõi tồn kho theo thời gian thực, quản lý nhập xuất, cảnh báo hàng sắp hết. Đồng bộ với KiotViet.',
    color: '#FFAB00',
  },
  {
    icon: 'solar:wallet-money-bold-duotone',
    title: 'Lương & Phụ cấp',
    description:
      'Tính lương tự động theo ca làm việc, phụ cấp, thưởng và các khoản trừ. Xuất bảng lương PDF nhanh chóng.',
    color: '#36B37E',
  },
  {
    icon: 'solar:users-group-two-rounded-bold-duotone',
    title: 'Quản lý nhân sự',
    description:
      'Quản lý hồ sơ nhân viên, phân quyền theo vai trò, theo dõi hiệu suất và lịch sử làm việc toàn diện.',
    color: '#7635DC',
  },
  {
    icon: 'solar:chart-square-bold-duotone',
    title: 'Báo cáo & Thống kê',
    description:
      'Dashboard tổng quan doanh thu, chi phí nhân sự, hiệu suất cửa hàng. Báo cáo xuất Excel, PDF theo kỳ.',
    color: '#FF5630',
  },
  {
    icon: 'solar:bell-bing-bold-duotone',
    title: 'Thông báo & Phê duyệt',
    description:
      'Hệ thống thông báo realtime, phê duyệt đổi ca, nghỉ phép và yêu cầu tăng ca trực tiếp trên ứng dụng.',
    color: '#F2994A',
  },
];

// ----------------------------------------------------------------------

export default function HomeFeatures() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        py: { xs: 10, md: 15 },
        bgcolor: theme.palette.grey[900],
      }}
    >
      <Container component={MotionViewport}>
        <Stack
          spacing={3}
          sx={{
            textAlign: 'center',
            mb: { xs: 5, md: 10 },
          }}
        >
          <m.div variants={varFade().inUp}>
            <Typography
              component="div"
              variant="overline"
              sx={{ color: alpha(theme.palette.common.white, 0.48) }}
            >
              Tính năng nổi bật
            </Typography>
          </m.div>

          <m.div variants={varFade().inDown}>
            <Typography variant="h2" sx={{ color: 'common.white' }}>
              Toàn bộ công cụ <br /> vận hành cửa hàng
            </Typography>
          </m.div>

          <m.div variants={varFade().inUp}>
            <Typography
              variant="body1"
              sx={{ color: alpha(theme.palette.common.white, 0.64), maxWidth: 560, mx: 'auto' }}
            >
              Từ bán hàng, kho hàng đến nhân sự và kế toán — tất cả trong một nền tảng duy nhất
              dành riêng cho CiCi Accessories.
            </Typography>
          </m.div>
        </Stack>

        <Box
          gap={3}
          display="grid"
          gridTemplateColumns={{
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          }}
        >
          {FEATURES.map((feature) => (
            <m.div variants={varFade().inUp} key={feature.title}>
              <Stack
                spacing={2}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.common.white, 0.04),
                  border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.common.white, 0.08),
                    borderColor: alpha(feature.color, 0.48),
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1.5,
                    bgcolor: alpha(feature.color, 0.16),
                  }}
                >
                  <Iconify icon={feature.icon} width={28} sx={{ color: feature.color }} />
                </Box>

                <Typography variant="h6" sx={{ color: 'common.white' }}>
                  {feature.title}
                </Typography>

                <Typography variant="body2" sx={{ color: alpha(theme.palette.common.white, 0.64) }}>
                  {feature.description}
                </Typography>
              </Stack>
            </m.div>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
