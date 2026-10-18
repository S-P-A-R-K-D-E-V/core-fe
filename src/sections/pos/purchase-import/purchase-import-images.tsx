'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { getStorageUrl } from 'src/utils/storage';

import Iconify from 'src/components/iconify';
import Lightbox from 'src/components/lightbox';

// ----------------------------------------------------------------------
// Ảnh hoá đơn bên cạnh bảng dòng: người duyệt đối chiếu chữ viết tay với số đã đọc. Bấm ảnh để phóng to.
// ----------------------------------------------------------------------

type Props = { images: string[] };

export default function PurchaseImportImages({ images }: Props) {
  const urls = useMemo(() => images.map(getStorageUrl), [images]);
  const slides = useMemo(() => urls.map((src) => ({ src })), [urls]);
  const [selected, setSelected] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  if (urls.length === 0) return null;
  const current = Math.min(selected, urls.length - 1);

  return (
    <Card sx={{ p: 1.5, position: { md: 'sticky' }, top: { md: 88 } }}>
      <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', bgcolor: 'background.neutral' }}>
        <Box
          component="img"
          src={urls[current]}
          alt={`Tờ ${current + 1}`}
          onClick={() => setZoomOpen(true)}
          sx={{
            width: 1,
            display: 'block',
            cursor: 'zoom-in',
            objectFit: 'contain',
            maxHeight: { xs: 420, md: 'calc(100vh - 220px)' },
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 0.2s',
          }}
        />
        <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 8, right: 8 }}>
          <Tooltip title="Xoay ảnh">
            <IconButton
              size="small"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}
            >
              <Iconify icon="solar:restart-bold" width={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Phóng to">
            <IconButton
              size="small"
              onClick={() => setZoomOpen(true)}
              sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}
            >
              <Iconify icon="solar:magnifer-zoom-in-bold" width={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {urls.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          {urls.map((src, index) => (
            <Box
              key={src}
              component="img"
              src={src}
              alt={`Tờ ${index + 1}`}
              onClick={() => {
                setSelected(index);
                setRotation(0);
              }}
              sx={{
                width: 56,
                height: 72,
                cursor: 'pointer',
                borderRadius: 0.75,
                objectFit: 'cover',
                border: (theme) => `2px solid ${index === current ? theme.palette.primary.main : 'transparent'}`,
              }}
            />
          ))}
        </Stack>
      )}

      <Lightbox index={current} slides={slides} open={zoomOpen} close={() => setZoomOpen(false)} disabledSlideshow />
    </Card>
  );
}
