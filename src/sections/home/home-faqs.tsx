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

import type { TenantBranding } from 'src/lib/tenant-branding';

import { SectionTitle } from './components/section-title';
import { FloatLine, FloatPlusIcon, FloatTriangleDownIcon } from './components/svg-elements';

// ----------------------------------------------------------------------

type Props = BoxProps & {
  branding?: TenantBranding | null;
};

export default function HomeFAQs({ sx, branding, ...other }: Props) {
  const storeName = branding?.storeName ?? 'CiCi Accessories';
  const contactChannel = branding?.messengerLink
    ? 'Messenger'
    : branding?.zaloLink
      ? 'Zalo'
      : 'Messenger / Zalo';
  const contactLink = branding?.messengerLink ?? branding?.zaloLink ?? null;

  const faqs = [
    {
      question: `${storeName} bán những sản phẩm gì?`,
      answer: `${storeName} luôn cập nhật mẫu mã mới liên tục, đa dạng lựa chọn cho khách hàng. Nhắn tin để được tư vấn chi tiết về sản phẩm hiện có.`,
    },
    {
      question: 'Làm thế nào để đặt hàng?',
      answer: branding?.address
        ? `Bạn có thể nhắn tin trực tiếp qua ${contactChannel} để chọn hàng và hẹn giờ đến nhận tại ${branding.address}. Hoặc ghé thẳng cửa hàng trong giờ mở cửa.`
        : `Bạn có thể nhắn tin trực tiếp qua ${contactChannel} để chọn hàng và được tư vấn giao nhận.`,
    },
    ...(branding?.address
      ? [
          {
            question: `Cửa hàng ${storeName} ở đâu?`,
            answer: `${storeName} có cửa hàng tại ${branding.address}. Bạn có thể ghé trực tiếp để xem hàng thực tế và được tư vấn miễn phí. Ngoài ra bạn cũng có thể đặt hàng qua ${contactChannel} và đến lấy tại cửa hàng.`,
          },
        ]
      : []),
    {
      question: 'Phương thức thanh toán nào được chấp nhận?',
      answer: 'Shop chấp nhận: tiền mặt tại cửa hàng, chuyển khoản ngân hàng và các ví điện tử phổ biến.',
    },
  ];

  const [expanded, setExpanded] = useState<string | false>(faqs[0].question);

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
            {faqs.map((item, index) => (
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
                Nhắn tin cho {storeName} — đội ngũ sẽ phản hồi trong vòng 30 phút!
              </Typography>
            </m.div>

            {contactLink && (
              <m.div variants={varFade('in')}>
                <Button
                  color="primary"
                  variant="contained"
                  size="large"
                  href={contactLink}
                  target="_blank"
                  rel="noopener"
                  startIcon={
                    <Iconify
                      icon={branding?.messengerLink ? 'logos:messenger' : 'simple-icons:zalo'}
                      width={20}
                    />
                  }
                >
                  Nhắn tin ngay
                </Button>
              </m.div>
            )}
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
