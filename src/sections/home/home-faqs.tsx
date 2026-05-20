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
      'Bạn có thể đặt hàng qua nhiều kênh: nhắn tin trực tiếp qua Facebook Messenger / Zalo của shop, hoặc inbox fanpage CiCi Accessories. Đội ngũ tư vấn sẽ hỗ trợ bạn chọn sản phẩm và chốt đơn trong vài phút. Chúng tôi đang phát triển thêm tính năng đặt hàng online.',
  },
  {
    question: 'Shop có giao hàng toàn quốc không?',
    answer:
      'Có! CiCi Accessories giao hàng toàn quốc qua các đơn vị vận chuyển uy tín. Đặt hàng trước 12h00 tại TP.HCM nhận hàng trong ngày. Các tỉnh thành khác từ 1–3 ngày làm việc tùy khu vực. Phí ship từ 15,000đ – 35,000đ.',
  },
  {
    question: 'Chính sách đổi trả như thế nào?',
    answer:
      'CiCi hỗ trợ đổi trả miễn phí trong 7 ngày kể từ ngày nhận hàng nếu sản phẩm bị lỗi kỹ thuật hoặc khác với mô tả. Sản phẩm cần còn nguyên vẹn, chưa qua sử dụng và có đầy đủ hộp/túi đựng. Liên hệ qua Messenger để được xử lý nhanh nhất.',
  },
  {
    question: 'Có thể xem hàng trực tiếp không?',
    answer:
      'Shop hiện hoạt động chủ yếu online. Bạn có thể nhắn tin yêu cầu video/ảnh thực tế sản phẩm, shop sẽ quay và gửi ngay. Chúng tôi cam kết hình ảnh trung thực, không photoshop quá mức.',
  },
  {
    question: 'Phương thức thanh toán nào được chấp nhận?',
    answer:
      'Shop chấp nhận: chuyển khoản ngân hàng (Vietcombank, MB Bank, Techcombank...), ví điện tử MoMo / ZaloPay / VNPay, và thanh toán khi nhận hàng (COD) áp dụng trong TP.HCM và một số tỉnh thành lớn.',
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
