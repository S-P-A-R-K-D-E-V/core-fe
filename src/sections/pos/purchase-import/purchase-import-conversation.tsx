'use client';

import { useRef, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';

import { getStorageUrl } from 'src/utils/storage';
import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import ChatbotMarkdown from 'src/components/chatbot/chatbot-markdown';

import type { IPurchaseImportMessage, IPurchaseImportDuplicate } from 'src/types/purchase-import';

// ----------------------------------------------------------------------
// Trao đổi với trợ lý về một lần nhập (tab "Trao đổi" của drawer): tin người dùng (kèm ảnh sản phẩm) bên phải, câu trả
// lời của trợ lý (đã kèm thay đổi đã áp, kết quả đối chiếu) bên trái. Câu hỏi mẫu khi chưa có tin nào.
// ----------------------------------------------------------------------

export const ASSIST_EXAMPLES = [
  'Dòng 3 là máy sấy cute, mã SP000465',
  'Ảnh vừa gửi là hàng của dòng nào?',
  'Đơn này đã từng nhập rồi, đối chiếu lại giúp',
  'Nhận hết các mã gợi ý',
];

type Props = {
  messages: IPurchaseImportMessage[];
  /** Tin vừa gửi đang chờ trợ lý (hiện ngay, trước khi máy chủ trả lời). */
  pending?: { text: string; images: string[] } | null;
  /** Phiếu nhập cũ giống hoá đơn — của câu trả lời mới nhất. */
  duplicates: IPurchaseImportDuplicate[];
  onExample: (text: string) => void;
  onZoomImage: (url: string) => void;
  onNavigate: (href: string) => void;
};

export default function PurchaseImportConversation({
  messages,
  pending,
  duplicates,
  onExample,
  onZoomImage,
  onNavigate,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, pending]);

  if (messages.length === 0 && !pending) {
    return (
      <Stack spacing={1.5} sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Nhắn trợ lý bằng câu bình thường để sửa hoá đơn này — gán mã, sửa số, bỏ dòng, đổi nhà
          cung cấp, gắn ảnh sản phẩm vào dòng, hoặc đối chiếu với các phiếu nhập trước. Gửi kèm ảnh
          sản phẩm để trợ lý nhận ra hàng.
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {ASSIST_EXAMPLES.map((example) => (
            <Chip
              key={example}
              size="small"
              variant="outlined"
              label={example}
              onClick={() => onExample(example)}
            />
          ))}
        </Stack>
      </Stack>
    );
  }

  const lastAssistant = messages.map((m) => m.role).lastIndexOf('assistant');

  return (
    <Stack spacing={1.5} sx={{ py: 1 }}>
      {messages.map((message, index) => (
        <Bubble
          key={`${message.at}-${index}`}
          role={message.role}
          text={message.text}
          images={message.images.map((i) => getStorageUrl(i.url))}
          at={message.at}
          onZoomImage={onZoomImage}
          footer={
            index === lastAssistant && duplicates.length > 0 ? (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {duplicates.map((d) => (
                  <Button
                    key={d.purchaseOrderId}
                    size="small"
                    variant="outlined"
                    color="warning"
                    startIcon={<Iconify icon="solar:document-text-linear" width={16} />}
                    onClick={() =>
                      onNavigate(paths.dashboard.pos.purchaseOrder.details(d.purchaseOrderId))
                    }
                  >
                    {d.orderNumber} · {fCurrency(d.total)}
                  </Button>
                ))}
              </Stack>
            ) : null
          }
        />
      ))}

      {pending && (
        <>
          <Bubble
            role="user"
            text={pending.text}
            images={pending.images}
            onZoomImage={onZoomImage}
          />
          <Box sx={{ maxWidth: 280 }}>
            <Typography variant="caption" color="text.secondary">
              Trợ lý đang xem hoá đơn và ảnh…
            </Typography>
            <LinearProgress sx={{ mt: 0.5 }} />
          </Box>
        </>
      )}
      <div ref={endRef} />
    </Stack>
  );
}

// ----------------------------------------------------------------------

type BubbleProps = {
  role: 'user' | 'assistant';
  text: string;
  images: string[];
  at?: string;
  footer?: React.ReactNode;
  onZoomImage: (url: string) => void;
};

function Bubble({ role, text, images, at, footer, onZoomImage }: BubbleProps) {
  const mine = role === 'user';
  return (
    <Stack alignItems={mine ? 'flex-end' : 'flex-start'}>
      <Box
        sx={{
          px: 1.5,
          py: 1,
          maxWidth: '92%',
          borderRadius: 2,
          ...(mine
            ? { bgcolor: 'primary.main', color: 'primary.contrastText', borderBottomRightRadius: 4 }
            : { bgcolor: 'background.neutral', borderBottomLeftRadius: 4 }),
        }}
      >
        {images.length > 0 && (
          <Stack
            direction="row"
            spacing={0.5}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: text ? 0.75 : 0 }}
          >
            {images.map((src) => (
              <Box
                key={src}
                component="img"
                src={src}
                alt="Ảnh sản phẩm"
                onClick={() => onZoomImage(src)}
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 1,
                  objectFit: 'cover',
                  cursor: 'zoom-in',
                }}
              />
            ))}
          </Stack>
        )}
        {text &&
          (mine ? (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {text}
            </Typography>
          ) : (
            <ChatbotMarkdown text={text} />
          ))}
        {footer}
      </Box>
      {at && (
        <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.25, px: 0.5 }}>
          {fDateTime(at, 'HH:mm dd/MM')}
        </Typography>
      )}
    </Stack>
  );
}
