'use client';

import type { BoxProps } from '@mui/material/Box';

import { useState } from 'react';
import { m } from 'framer-motion';
import { alpha } from '@mui/material/styles';


import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Accordion, { accordionClasses } from '@mui/material/Accordion';
import AccordionDetails, { accordionDetailsClasses } from '@mui/material/AccordionDetails';
import AccordionSummary, { accordionSummaryClasses } from '@mui/material/AccordionSummary';

import Iconify from 'src/components/iconify';
import { varFade, MotionViewport } from 'src/components/animate';

import { SectionTitle } from './components/section-title';
import { FloatLine, FloatPlusIcon, FloatTriangleDownIcon } from './components/svg-elements';

// ----------------------------------------------------------------------

const FAQs = [
  {
    question: 'CiCi Accessories bán những sản phẩm gì?',
    answer:
      'CiCi Accessories chuyên cung cấp phụ kiện thời trang nữ bao gồm: trang sức (nhẫn, bông tai, dây chuyền, vòng tay), phụ kiện tóc (kẹp cua, kẹp bướm, băng đô, nơ tóc), túi xách mini, ví và các phụ kiện thời trang khác. Mẫu mã đa dạng, cập nhật xu hướng liên tục.',
  },
  {
    question: 'Làm thế nào để đặt hàng?',
    answer:
      'Bạn có thể nhắn tin trực tiếp qua Facebook Messenger / Zalo của shop để chọn hàng và hẹn giờ đến nhận tại 21 Chùa Láng, Hà Nội. Hoặc ghé thẳng cửa hàng trong giờ mở cửa 9:00 – 21:00 hàng ngày.',
  },
  {
    question: 'Cửa hàng CiCi Accessories ở đâu?',
    answer:
      'CiCi Accessories có cửa hàng duy nhất tại 21 Chùa Láng, Hà Nội. Bạn có thể ghé trực tiếp để xem hàng thực tế và được tư vấn miễn phí. Ngoài ra bạn cũng có thể đặt hàng qua Messenger / Zalo và đến lấy tại cửa hàng.',
  },
  {
    question: 'Giờ mở cửa của shop như thế nào?',
    answer:
      'CiCi Accessories mở cửa từ 9:00 – 21:00 tất cả các ngày trong tuần, kể cả cuối tuần và ngày lễ. Ngoài giờ mở cửa bạn vẫn có thể nhắn tin đặt hàng qua Messenger / Zalo và đến nhận hàng vào ngày hôm sau.',
  },
  {
    question: 'Có thể xem hàng trực tiếp không?',
    answer:
      'Hoàn toàn có thể! Cửa hàng tại 21 Chùa Láng, Hà Nội mở cửa 9:00 – 21:00 mỗi ngày. Bạn có thể ghé xem hàng thực tế và thử trực tiếp trước khi mua. Nếu chưa tiện đến, nhắn tin để shop gửi video/ảnh thực tế sản phẩm.',
  },
  {
    question: 'Phương thức thanh toán nào được chấp nhận?',
    answer:
      'Shop chấp nhận: tiền mặt tại cửa hàng, chuyển khoản ngân hàng (Vietcombank, MB Bank, Techcombank...) và ví điện tử MoMo / ZaloPay / VNPay.',
  },
];

// ----------------------------------------------------------------------

export default function HomeFAQs({ sx, ...other }: BoxProps) {
  const [expanded, setExpanded] = useState<string | false>(FAQs[0].question);

  const handleChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box component="section" sx={sx} {...other}>
      <MotionViewport sx={{ py: 10, position: 'relative' }}>
        {topLines()}

        <Container>
          <SectionTitle
            caption="Câu hỏi thường gặp"
            title="Bạn cần"
            txtGradient="hỗ trợ?"
            sx={{ textAlign: 'center', alignItems: 'center' }}
          />

          <Stack
            spacing={1}
            sx={{ mt: 8, mx: 'auto', maxWidth: 720, mb: { xs: 5, md: 8 } }}
          >
            {FAQs.map((item, index) => (
              <Accordion
                key={item.question}
                component={m.div}
                variants={varFade('inUp', { distance: 24 })}
                expanded={expanded === item.question}
                onChange={handleChange(item.question)}
                sx={(theme) => ({
                  borderRadius: 2,
                  transition: theme.transitions.create(['background-color'], {
                    duration: theme.transitions.duration.short,
                  }),
                  '&::before': { display: 'none' },
                  '&:hover': { bgcolor: alpha(theme.palette.grey[500], 0.08) },
                  '&:first-of-type, &:last-of-type': { borderRadius: 2 },
                  [`&.${accordionClasses.expanded}`]: {
                    m: 0,
                    borderRadius: 2,
                    boxShadow: 'none',
                    bgcolor: alpha(theme.palette.grey[500], 0.06),
                  },
                  [`& .${accordionSummaryClasses.root}`]: {
                    py: 3,
                    px: 2.5,
                    minHeight: 'auto',
                    [`& .${accordionSummaryClasses.content}`]: {
                      m: 0,
                      [`&.${accordionSummaryClasses.expanded}`]: { m: 0 },
                    },
                  },
                  [`& .${accordionDetailsClasses.root}`]: { px: 2.5, pt: 0, pb: 3 },
                })}
              >
                <AccordionSummary
                  expandIcon={
                    <Iconify
                      width={20}
                      icon={expanded === item.question ? 'mingcute:minimize-line' : 'mingcute:add-line'}
                    />
                  }
                >
                  <Typography variant="h6">{item.question}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ color: 'text.secondary' }}>{item.answer}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Container>

        {/* Contact CTA */}
        <Stack sx={{ position: 'relative' }}>
          {bottomLines()}
          <Box
            sx={[
              (theme) => ({
                px: 3,
                py: 8,
                textAlign: 'center',
                background: `linear-gradient(to left, ${alpha(theme.palette.grey[500], 0.06)}, transparent)`,
              }),
            ]}
          >
            <m.div variants={varFade('in')}>
              <Typography variant="h4">Vẫn còn thắc mắc?</Typography>
            </m.div>

            <m.div variants={varFade('in')}>
              <Typography sx={{ mt: 2, mb: 3, color: 'text.secondary' }}>
                Nhắn tin cho CiCi — đội ngũ sẽ phản hồi trong vòng 30 phút!
              </Typography>
            </m.div>

            <m.div variants={varFade('in')}>
              <Button
                color="primary"
                variant="contained"
                size="large"
                href="https://m.me/ciciaccessories"
                target="_blank"
                rel="noopener"
                startIcon={<Iconify icon="logos:messenger" width={20} />}
              >
                Nhắn tin ngay
              </Button>
            </m.div>
          </Box>
        </Stack>
      </MotionViewport>
    </Box>
  );
}

// ----------------------------------------------------------------------

const topLines = () => (
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

const bottomLines = () => (
  <>
    <FloatLine sx={{ top: 0, left: 0 }} />
    <FloatLine sx={{ bottom: 0, left: 0 }} />
    <FloatPlusIcon sx={{ top: -8, left: 72 }} />
    <FloatPlusIcon sx={{ bottom: -8, left: 72 }} />
  </>
);
