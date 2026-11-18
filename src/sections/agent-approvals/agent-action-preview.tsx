'use client';

import type {
  IAgentActionPreview,
  IAgentActionPrevious,
  IAgentSocialPostPreview,
} from 'src/api/agent-actions';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Collapse from '@mui/material/Collapse';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';
import Lightbox, { useLightBox } from 'src/components/lightbox';

import { platformInfo, splitRevisionNote } from './agent-action-utils';

// ----------------------------------------------------------------------
// Bản xem trước dễ đọc của phiếu agent: bài mạng xã hội trông như bài thật (kênh, giờ đăng, caption, ảnh, sản phẩm gắn),
// lệnh khác là bảng "nhãn — giá trị"; bản trước (khi phiếu là bản sửa) để so chữ / ảnh cũ và mới.
// ----------------------------------------------------------------------

export function ParamList({ fields }: { fields: { key: string; value: string }[] }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(120px, max-content) 1fr' },
        columnGap: 2,
        rowGap: { xs: 0, sm: 0.75 },
      }}
    >
      {fields.map((f, i) => (
        <Box key={`${f.key}-${i}`} sx={{ display: 'contents' }}>
          <Typography
            component="dt"
            variant="body2"
            sx={{ color: 'text.secondary', wordBreak: 'break-word' }}
          >
            {f.key}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{ m: 0, mb: { xs: 1, sm: 0 }, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
          >
            {f.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function CodeText({ text, maxHeight = 240 }: { text: string; maxHeight?: number }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        maxHeight,
        overflow: 'auto',
        borderRadius: 1,
        bgcolor: 'background.neutral',
        typography: 'caption',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {text}
    </Box>
  );
}

/** 1.250.000đ */
export function fVnd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

// ----------------------------------------------------------------------

/** Hàng ảnh trượt ngang, bấm ảnh để phóng to. */
export function PreviewImages({ urls, size = 140 }: { urls: string[]; size?: number }) {
  const slides = useMemo(() => urls.map((src) => ({ src })), [urls]);
  const lightbox = useLightBox(slides);

  if (urls.length === 0) return null;

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        sx={{ overflowX: 'auto', pb: 0.5, scrollSnapType: 'x proximity' }}
      >
        {urls.map((url, i) => (
          <ButtonBase
            key={`${url}-${i}`}
            onClick={() => lightbox.setSelected(i)}
            aria-label={`Phóng to ảnh ${i + 1}`}
            sx={{
              flexShrink: 0,
              width: size,
              height: size,
              borderRadius: 1.5,
              overflow: 'hidden',
              scrollSnapAlign: 'start',
              bgcolor: 'background.neutral',
              border: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box
              component="img"
              src={url}
              alt={`Ảnh ${i + 1}`}
              loading="lazy"
              sx={{ width: 1, height: 1, objectFit: 'cover' }}
            />
          </ButtonBase>
        ))}
      </Stack>

      <Lightbox
        index={lightbox.selected}
        slides={slides}
        open={lightbox.open}
        close={lightbox.onClose}
      />
    </>
  );
}

// ----------------------------------------------------------------------

export function SocialPostPreview({ post }: { post: IAgentSocialPostPreview }) {
  const channels = post.channels ?? [];
  const products = post.products ?? [];
  const images = post.imageUrls ?? [];

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 1.5,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          {channels.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
              Chưa chọn kênh đăng
            </Typography>
          )}
          {channels.map((ch) => {
            const p = platformInfo(ch.platform);
            return (
              <Stack
                key={ch.id}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ minWidth: 0 }}
              >
                <Avatar
                  src={ch.avatarUrl ?? undefined}
                  alt={ch.name}
                  sx={{ width: 36, height: 36 }}
                >
                  {ch.name?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {ch.name}
                    {ch.username ? (
                      <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                        {' '}
                        @{ch.username}
                      </Box>
                    ) : null}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    sx={{ color: 'text.secondary' }}
                  >
                    <Iconify icon={p.icon} width={14} />
                    <Typography variant="caption">{p.label}</Typography>
                  </Stack>
                </Box>
              </Stack>
            );
          })}
          <Box sx={{ flex: 1 }} />
          {post.modeLabel && (
            <Chip
              size="small"
              variant="soft"
              color={post.mode === 'now' ? 'warning' : 'info'}
              icon={
                <Iconify
                  icon={post.mode === 'now' ? 'solar:plain-bold' : 'solar:calendar-bold'}
                  width={16}
                />
              }
              label={post.modeLabel}
            />
          )}
        </Stack>

        {post.text ? (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {post.text}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
            (Bài không có chữ)
          </Typography>
        )}

        <PreviewImages urls={images} />

        {products.length > 0 && (
          <Stack spacing={0.75}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Sản phẩm gắn kèm
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {products.map((pr) => (
                <Chip
                  key={pr.id}
                  size="small"
                  variant="outlined"
                  color={pr.inStock ? 'default' : 'error'}
                  avatar={pr.imageUrl ? <Avatar src={pr.imageUrl} alt={pr.name} /> : undefined}
                  label={`${pr.name} · ${fVnd(pr.price)}${pr.inStock ? '' : ' · Hết hàng'}`}
                  title={pr.code ? `Mã ${pr.code}` : undefined}
                />
              ))}
            </Stack>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

// ----------------------------------------------------------------------

/** Xem trước theo loại: bài mạng xã hội hoặc bảng "nhãn — giá trị". Không có gì để hiện → null. */
export function ActionPreview({ preview }: { preview: IAgentActionPreview | null | undefined }) {
  if (!preview) return null;
  if (preview.kind === 'social_post' && preview.socialPost) {
    return <SocialPostPreview post={preview.socialPost} />;
  }
  const fields = preview.fields ?? [];
  if (fields.length === 0) return null;
  return <ParamList fields={fields.map((f) => ({ key: f.label, value: f.value }))} />;
}

// ----------------------------------------------------------------------

/** Khối thu gọn "Bản trước": ai yêu cầu sửa, sửa gì, ảnh cũ cạnh ảnh mới để so. */
export function PreviousVersion({
  previous,
  currentImages,
}: {
  previous: IAgentActionPrevious;
  currentImages: string[];
}) {
  const [open, setOpen] = useState(false);
  const prevPost = previous.preview?.kind === 'social_post' ? previous.preview.socialPost : null;
  const prevImages = prevPost?.imageUrls ?? [];
  const prevFields = previous.preview?.kind !== 'social_post' ? previous.preview : null;
  const { text: noteText, imageUrls: redoImages } = splitRevisionNote(previous.note);

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        bgcolor: 'background.neutral',
        overflow: 'hidden',
      }}
    >
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        sx={{ width: 1, px: 1.5, py: 1, justifyContent: 'flex-start', textAlign: 'left', gap: 1 }}
      >
        <Iconify icon="solar:history-bold" width={18} sx={{ color: 'text.secondary' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2">Bản trước</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap={!open}>
            {previous.decidedByName ?? 'Người duyệt'} yêu cầu sửa
            {noteText ? `: ${noteText}` : ''}
            {!noteText && redoImages.length > 0 ? `: làm lại ${redoImages.length} ảnh` : ''}
          </Typography>
        </Box>
        <Iconify
          icon={open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
          width={18}
        />
      </ButtonBase>

      <Collapse in={open} unmountOnExit>
        <Stack spacing={1.5} sx={{ px: 1.5, pb: 1.5 }}>
          {redoImages.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Ảnh được yêu cầu làm lại
              </Typography>
              <PreviewImages urls={redoImages} size={72} />
            </Box>
          )}

          {prevPost?.text && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Chữ bản trước
              </Typography>
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'text.secondary' }}
              >
                {prevPost.text}
              </Typography>
            </Box>
          )}

          {(prevImages.length > 0 || currentImages.length > 0) && (
            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Ảnh bản trước
                </Typography>
                {prevImages.length > 0 ? (
                  <PreviewImages urls={prevImages} size={96} />
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    Không có ảnh
                  </Typography>
                )}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Ảnh bản này
                </Typography>
                {currentImages.length > 0 ? (
                  <PreviewImages urls={currentImages} size={96} />
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    Không có ảnh
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {prevFields && <ActionPreview preview={prevFields} />}
        </Stack>
      </Collapse>
    </Box>
  );
}
