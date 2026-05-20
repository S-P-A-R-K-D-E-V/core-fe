'use client';

import type { BoxProps } from '@mui/material/Box';

import { m } from 'framer-motion';
import { alpha } from '@mui/material/styles';


import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Rating from '@mui/material/Rating';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { fToNow } from 'src/utils/format-time';

import { _mock } from 'src/_mock';

import { varFade, MotionViewport } from 'src/components/animate';

import { SectionTitle } from './components/section-title';
import { FloatLine, FloatTriangleDownIcon } from './components/svg-elements';

// ----------------------------------------------------------------------

const REVIEWS = [
  {
    id: '1',
    name: 'Trần Thị Lan',
    avatar: _mock.image.avatar(1),
    rating: 5,
    category: 'Trang sức',
    content:
      'Mình mua chiếc nhẫn bạc, đẹp hơn hình nhiều! Chất lượng tốt, đóng gói cẩn thận. Shop tư vấn nhiệt tình, sẽ ủng hộ dài dài. Giao hàng nhanh chỉ 1 ngày.',
    postedAt: 'May 10, 2025',
  },
  {
    id: '2',
    name: 'Nguyễn Thùy Linh',
    avatar: _mock.image.avatar(2),
    rating: 5,
    category: 'Kẹp tóc',
    content:
      'Set kẹp bướm xinh quá trời luôn! Màu sắc y chang hình, chất liệu chắc chắn không bị gãy. Giá rẻ mà đẹp không thua hàng xịn. Inbox là ship ngay.',
    postedAt: 'May 18, 2025',
  },
  {
    id: '3',
    name: 'Lê Phương Anh',
    avatar: _mock.image.avatar(3),
    rating: 5,
    category: 'Túi xách',
    content:
      'Chiếc túi crossbody đáng yêu như mơ 😍 Vừa đủ đựng điện thoại, ví, son. Dây đeo chắc, khóa kéo trơn. Được khen nhiều lắm khi đeo đi chơi!',
    postedAt: 'June 2, 2025',
  },
  {
    id: '4',
    name: 'Phạm Minh Châu',
    avatar: _mock.image.avatar(4),
    rating: 5,
    category: 'Vòng tay',
    content:
      'Đặt hàng lúc tối, sáng hôm sau đã có ở nhà rồi. Vòng tay xinh, không bị xỉn màu dù đeo hàng ngày. Sẽ quay lại mua thêm cho cả hội bạn thân.',
    postedAt: 'June 8, 2025',
  },
  {
    id: '5',
    name: 'Hoàng Yến Nhi',
    avatar: _mock.image.avatar(5),
    rating: 5,
    category: 'Phụ kiện',
    content:
      'Shop có nhiều mẫu cute lắm, khó chọn quá 😆 Mua 3 lần rồi lần nào cũng ổn. Chính sách đổi hàng dễ chịu, shop hỗ trợ nhiệt tình.',
    postedAt: 'June 14, 2025',
  },
  {
    id: '6',
    name: 'Võ Khánh Ngân',
    avatar: _mock.image.avatar(6),
    rating: 5,
    category: 'Trang sức',
    content:
      'Mua bông tai cho bạn thân làm quà sinh nhật, bạn ấy thích lắm! Hộp quà đẹp, có chương trình gói quà miễn phí. Sẽ ủng hộ shop cho những dịp tiếp theo.',
    postedAt: 'June 20, 2025',
  },
];

const STATS = [
  { label: 'Khách hàng tin yêu', value: 2000, unit: '+', toFixed: 0 },
  { label: 'Đơn hàng thành công', value: 8.5, unit: 'k+', toFixed: 1 },
  { label: 'Đánh giá 5 sao', value: 98, unit: '%', toFixed: 0 },
];

// ----------------------------------------------------------------------

const renderLines = () => (
  <>
    <Stack
      spacing={8}
      alignItems="center"
      sx={{ top: 64, left: 80, position: 'absolute', transform: 'translateX(-50%)' }}
    >
      <FloatTriangleDownIcon sx={{ position: 'static', opacity: 0.12 }} />
      <FloatTriangleDownIcon sx={{ width: 30, height: 15, opacity: 0.24, position: 'static' }} />
    </Stack>
    <FloatLine vertical sx={{ top: 0, left: 80 }} />
  </>
);

export default function HomeTestimonials({ sx, ...other }: BoxProps) {
  const horizontalDivider = (position: 'top' | 'bottom') => (
    <Divider
      component="div"
      sx={[
        (theme) => ({
          width: 1,
          opacity: 0.16,
          height: '1px',
          border: 'none',
          position: 'absolute',
          background: `linear-gradient(to right, transparent 0%, ${theme.palette.grey[500]} 50%, transparent 100%)`,
          ...(position === 'top' && { top: 0 }),
          ...(position === 'bottom' && { bottom: 0 }),
        }),
      ]}
    />
  );

  const verticalDivider = () => (
    <Divider
      component="div"
      orientation="vertical"
      flexItem
      sx={[
        (theme) => ({
          width: '1px',
          opacity: 0.16,
          border: 'none',
          background: `linear-gradient(to bottom, transparent 0%, ${theme.palette.grey[500]} 50%, transparent 100%)`,
          display: { xs: 'none', md: 'block' },
        }),
      ]}
    />
  );

  return (
    <Box
      component="section"
      sx={[{ py: 10, position: 'relative' }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <MotionViewport>
        {renderLines()}

        <Container>
          <SectionTitle
            caption="Khách hàng nói gì"
            title="Yêu thích từ"
            txtGradient="cộng đồng"
            sx={{ mb: { xs: 5, md: 8 }, textAlign: 'center', alignItems: 'center' }}
          />

          {/* Reviews grid */}
          <Stack sx={{ position: 'relative', py: { xs: 5, md: 8 } }}>
            {horizontalDivider('top')}

            <Grid container spacing={3}>
              {REVIEWS.map((item) => (
                <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <ReviewCard item={item} />
                </Grid>
              ))}
            </Grid>

            {horizontalDivider('bottom')}
          </Stack>

          {/* Stats */}
          <Stack sx={{ py: { xs: 5, md: 8 }, position: 'relative' }}>
            {horizontalDivider('top')}

            <Stack
              divider={verticalDivider()}
              sx={{ gap: 5, flexDirection: { xs: 'column', md: 'row' } }}
            >
              {STATS.map((item) => (
                <Stack key={item.label} spacing={2} sx={{ textAlign: 'center', width: 1 }}>
                  <m.div variants={varFade('inUp', { distance: 24 })}>
                    <Typography
                      sx={(theme) => ({
                        fontWeight: 'bold',
                        fontSize: { xs: 40, md: 64 },
                        lineHeight: { xs: 50 / 40, md: 80 / 64 },
                        fontFamily: theme.typography.fontFamily,
                        color: 'primary.main',
                      })}
                    >
                      {item.toFixed === 0 ? item.value : item.value.toFixed(item.toFixed)}
                      {item.unit}
                    </Typography>
                  </m.div>

                  <m.div variants={varFade('inUp', { distance: 24 })}>
                    <Box component="span" sx={{ opacity: 0.48, typography: 'h6', color: 'text.primary' }}>
                      {item.label}
                    </Box>
                  </m.div>
                </Stack>
              ))}
            </Stack>

            {horizontalDivider('bottom')}
          </Stack>
        </Container>
      </MotionViewport>
    </Box>
  );
}

// ----------------------------------------------------------------------

type ReviewCardProps = { item: (typeof REVIEWS)[number] };

function ReviewCard({ item }: ReviewCardProps) {
  return (
    <Stack
      component={m.div}
      variants={varFade('in')}
      spacing={2}
      sx={[
        (theme) => ({
          p: 3,
          borderRadius: 2,
          height: '100%',
          bgcolor: alpha(theme.palette.grey[500], 0.04),
          border: `1px solid ${alpha(theme.palette.grey[500], 0.12)}`,
          transition: 'transform 0.2s',
          '&:hover': { transform: 'translateY(-4px)' },
        }),
      ]}
    >
      <Stack spacing={0.5}>
        <Rating size="small" name="read-only" value={item.rating} precision={0.5} readOnly />
        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
          {item.category}
        </Typography>
      </Stack>

      <Typography
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {item.content}
      </Typography>

      <Box sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}>
        <Avatar alt={item.name} src={item.avatar} sx={{ width: 40, height: 40 }} />
        <Stack>
          <Typography variant="subtitle2">{item.name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {fToNow(new Date(item.postedAt))}
          </Typography>
        </Stack>
      </Box>
    </Stack>
  );
}
