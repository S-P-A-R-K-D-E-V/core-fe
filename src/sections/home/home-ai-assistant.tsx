'use client';

import type { BoxProps } from '@mui/material/Box';

import { m } from 'framer-motion';
import { alpha } from '@mui/material/styles';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { varFade, MotionViewport } from 'src/components/animate';
import Iconify from 'src/components/iconify';
import { OPEN_CHATBOT_EVENT } from 'src/components/chatbot/chatbot-events';

import { storeIndustry } from 'src/lib/store-industry';
import type { TenantBranding } from 'src/lib/tenant-branding';

import { SectionTitle } from './components/section-title';
import { FloatLine, FloatPlusIcon } from './components/svg-elements';

// ----------------------------------------------------------------------

const renderLines = () => (
  <>
    <FloatPlusIcon sx={{ top: 72, left: 72 }} />
    <FloatLine sx={{ top: 80, left: 0 }} />
    <FloatLine vertical sx={{ top: 0, left: 80 }} />
  </>
);

type Props = BoxProps & {
  branding?: TenantBranding | null;
};

export default function HomeAiAssistant({ sx, branding, ...other }: Props) {
  const aiName = `${branding?.storeName ?? 'CiCi'} AI`;
  const { ai, words, palette } = storeIndustry(branding);

  const capabilities = [
    {
      icon: 'solar:magnifer-bold-duotone',
      title: ai.lookupTitle,
      desc: ai.lookup(aiName),
      color: palette.headline[0],
    },
    {
      icon: 'solar:box-bold-duotone',
      title: ai.secondTitle,
      desc: ai.second(aiName),
      color: palette.headline[1],
    },
    {
      icon: 'solar:chat-round-dots-bold-duotone',
      title: 'Hỏi đáp 24/7',
      desc: `Giờ mở cửa, địa chỉ, cách liên hệ... ${aiName} sẵn sàng trả lời mọi lúc, kể cả ngoài giờ hành chính.`,
      color: palette.headline[2],
    },
  ];

  const handleOpenChat = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(OPEN_CHATBOT_EVENT));
    }
  };

  return (
    <Box
      component="section"
      id="ai-tu-van"
      sx={[
        { overflow: 'hidden', position: 'relative', py: { xs: 10, md: 20 } },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {/* Ngay dưới đầu trang trên điện thoại (phần tử LCP): hiện ngay từ HTML, không chờ JS chạy hiệu ứng; giữ cùng một
          kiểu khung ở máy chủ và điện thoại (disableAnimatedMobile đổi sang div thường sau khi tải → React dựng lại cả mục). */}
      <MotionViewport initial={false} disableAnimatedMobile={false}>
        {renderLines()}

        <Container sx={{ position: 'relative' }}>
          <SectionTitle
            caption="Trợ lý AI"
            title="Tư vấn tức thì cùng"
            txtGradient={aiName}
            description={`Không cần chờ nhân viên — hỏi ${aiName} bất cứ lúc nào về ${words.collection}, giá cả hay thông tin cửa hàng. Trả lời ngay trong vài giây, ngay tại góc màn hình.`}
            sx={{ mb: { xs: 6, md: 10 }, textAlign: 'center', alignItems: 'center' }}
          />

          <Grid container spacing={3} sx={{ mb: { xs: 5, md: 8 } }}>
            {capabilities.map((item) => (
              <Grid key={item.title} size={{ xs: 12, sm: 6, md: 4 }}>
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

                  <Typography variant="h6" component="h3" sx={{ mb: 1.5 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {item.desc}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ textAlign: 'center' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleOpenChat}
              startIcon={<Iconify icon="solar:chat-round-dots-bold" />}
            >
              Chat ngay với {aiName}
            </Button>
          </Box>
        </Container>
      </MotionViewport>
    </Box>
  );
}
