import { memo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';

import type {
  ChatbotUiLink,
  ChatbotUiBlock,
  ChatbotUiImage,
  ChatbotUiAction,
  ChatbotUiToolAction,
} from './chatbot-blocks';

// ----------------------------------------------------------------------
// Phần có cấu trúc dưới câu trả lời đã xong (đã qua normalizeChatbotBlocks): ảnh, thẻ link, nút.
// Gợi ý câu hỏi tiếp theo (suggestions) KHÔNG vẽ ở đây — nằm ở hàng chip phía trên ô nhập.
// ----------------------------------------------------------------------

function ImageGrid({ images }: { images: ChatbotUiImage[] }) {
  // Ảnh hỏng / hết hạn → ẩn ô, không để khung trống.
  const [failed, setFailed] = useState<string[]>([]);
  const visible = images.filter((img) => !failed.includes(img.src));
  if (visible.length === 0) return null;
  const single = visible.length === 1;

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 0.75,
        gridTemplateColumns: single ? '1fr' : 'repeat(2, minmax(0, 1fr))',
        maxWidth: single ? 320 : 360,
      }}
    >
      {visible.map((img) => (
        <Box key={img.src} component="figure" sx={{ m: 0, minWidth: 0 }}>
          <Box
            component="a"
            href={img.src}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={img.alt ? `Mở ảnh: ${img.alt}` : 'Mở ảnh trong tab mới'}
            sx={{
              display: 'block',
              overflow: 'hidden',
              borderRadius: 1,
              bgcolor: 'action.hover',
              aspectRatio: single ? '16 / 10' : '1 / 1',
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
            }}
          >
            <Box
              component="img"
              src={img.src}
              alt={img.alt ?? ''}
              loading="lazy"
              onError={() => setFailed((prev) => [...prev, img.src])}
              sx={{ width: 1, height: 1, objectFit: 'cover', display: 'block' }}
            />
          </Box>
          {/* Chú thích (tên sản phẩm / nhân viên / việc vệ sinh): nhiều ảnh mà không có chữ thì không biết ảnh nào là gì. */}
          {img.alt && (
            <Typography
              component="figcaption"
              variant="caption"
              title={img.alt}
              sx={{
                mt: 0.25,
                display: '-webkit-box',
                overflow: 'hidden',
                color: 'text.secondary',
                lineHeight: 1.3,
                wordBreak: 'break-word',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {img.alt}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

function LinkCard({ link }: { link: ChatbotUiLink }) {
  return (
    <Stack
      component="a"
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        px: 1,
        py: 0.75,
        minWidth: 0,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
        textDecoration: 'none',
        transition: (theme) => theme.transitions.create('background-color'),
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
      }}
    >
      <Iconify icon="solar:link-bold" width={18} sx={{ color: 'primary.main', flexShrink: 0 }} />
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {link.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {link.host}
        </Typography>
      </Box>
      <Iconify
        icon="eva:external-link-fill"
        width={16}
        sx={{ color: 'text.disabled', flexShrink: 0 }}
      />
    </Stack>
  );
}

type Props = {
  blocks: ChatbotUiBlock[];
  /** Đang có câu trả lời chạy → tạm khoá nút, tránh chồng lệnh. */
  busy: boolean;
  onNavigate: (href: string) => void;
  /** Nút thao tác: KHÔNG chạy gì — chỉ mở hộp xác nhận (xem chatbot-messages). */
  onRequestTool: (action: ChatbotUiToolAction) => void;
};

function ChatbotMessageBlocks({ blocks, busy, onNavigate, onRequestTool }: Props) {
  const images = blocks.filter((b): b is ChatbotUiImage => b.type === 'image');
  const links = blocks.filter((b): b is ChatbotUiLink => b.type === 'link');
  const actions = blocks.filter((b): b is ChatbotUiAction => b.type === 'action');
  if (!images.length && !links.length && !actions.length) return null;

  return (
    <Stack spacing={1} sx={{ mt: 1, minWidth: 0 }}>
      {images.length > 0 && <ImageGrid images={images} />}

      {links.map((link) => (
        <LinkCard key={link.url} link={link} />
      ))}

      {actions.length > 0 && (
        <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.75 }}>
          {actions.map((action, index) => (
            <Button
              // id do server cấp; tin cũ có thể trùng → kèm vị trí cho key không đụng nhau.
              key={`${action.id}-${index}`}
              size="small"
              variant="outlined"
              color="primary"
              disabled={busy}
              onClick={() =>
                action.kind === 'navigate' ? onNavigate(action.href) : onRequestTool(action)
              }
              startIcon={
                <Iconify
                  icon={
                    action.kind === 'navigate'
                      ? 'eva:diagonal-arrow-right-up-fill'
                      : 'solar:bolt-bold'
                  }
                  width={16}
                />
              }
              sx={{ maxWidth: '100%', textTransform: 'none' }}
            >
              <Box
                component="span"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {action.label}
              </Box>
            </Button>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default memo(ChatbotMessageBlocks);
