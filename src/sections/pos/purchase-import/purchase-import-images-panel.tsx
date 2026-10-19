'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { getStorageUrl } from 'src/utils/storage';

import Iconify from 'src/components/iconify';

import type { IPurchaseImport } from 'src/types/purchase-import';

// ----------------------------------------------------------------------
// Ảnh của lần nhập (cột trái drawer): tờ hoá đơn đang xem to (xoay, bấm phóng to) + dải tờ H1, H2…, và ảnh sản phẩm
// S1, S2… kèm dòng đã gắn. "Thêm ảnh" mở chọn ảnh của ô nhắn trợ lý (gửi kèm lời nhắn để trợ lý gắn vào dòng).
// ----------------------------------------------------------------------

type Props = {
  item: IPurchaseImport;
  canAddPhotos: boolean;
  onAddPhotos: () => void;
  onZoom: (urls: string[], index: number) => void;
};

export default function PurchaseImportImagesPanel({
  item,
  canAddPhotos,
  onAddPhotos,
  onZoom,
}: Props) {
  const [page, setPage] = useState(0);
  const [rotation, setRotation] = useState(0);
  const invoiceUrls = item.images.map(getStorageUrl);
  const products = item.productImages ?? [];
  const productUrls = products.map((p) => getStorageUrl(p.url));
  const current = Math.min(page, Math.max(invoiceUrls.length - 1, 0));
  const lineOf = (imageId: string) => item.lines.find((l) => l.imageId === imageId)?.lineNo;

  return (
    <Stack spacing={2}>
      <Box>
        <Stack direction="row" alignItems="center">
          <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
            Tờ hoá đơn ({invoiceUrls.length})
          </Typography>
          {invoiceUrls.length > 0 && (
            <Tooltip title="Xoay ảnh">
              <IconButton size="small" onClick={() => setRotation((r) => (r + 90) % 360)}>
                <Iconify icon="solar:restart-bold" width={18} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        {invoiceUrls.length > 0 ? (
          <Box
            sx={{
              mt: 0.5,
              borderRadius: 1.5,
              overflow: 'hidden',
              bgcolor: 'background.neutral',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src={invoiceUrls[current]}
              alt={`Tờ hoá đơn ${current + 1}`}
              onClick={() => onZoom(invoiceUrls, current)}
              sx={{
                width: 1,
                maxHeight: 520,
                objectFit: 'contain',
                cursor: 'zoom-in',
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 200ms',
              }}
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Lần nhập này không có ảnh hoá đơn.
          </Typography>
        )}
        {invoiceUrls.length > 1 && (
          <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, overflowX: 'auto' }}>
            {invoiceUrls.map((src, index) => (
              <Box
                key={src}
                component="img"
                src={src}
                alt={`H${index + 1}`}
                onClick={() => setPage(index)}
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1,
                  objectFit: 'cover',
                  cursor: 'pointer',
                  outline: (theme) =>
                    index === current ? `2px solid ${theme.palette.primary.main}` : 'none',
                }}
              />
            ))}
          </Stack>
        )}
      </Box>

      <Box>
        <Stack direction="row" alignItems="center">
          <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>
            Ảnh sản phẩm ({products.length})
          </Typography>
          {canAddPhotos && (
            <Button
              size="small"
              startIcon={<Iconify icon="solar:gallery-add-linear" width={16} />}
              onClick={onAddPhotos}
            >
              Thêm ảnh
            </Button>
          )}
        </Stack>
        {products.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Gửi ảnh chụp món hàng kèm lời nhắn (vd «ảnh này là dòng 3») để trợ lý gắn vào dòng và
            nhận ra mã.
          </Typography>
        ) : (
          <Box sx={{ mt: 0.75, display: 'grid', gap: 0.75, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {products.map((image, index) => {
              const lineNo = lineOf(image.id);
              return (
                <Box
                  key={image.id}
                  onClick={() => onZoom(productUrls, index)}
                  sx={{
                    position: 'relative',
                    borderRadius: 1.25,
                    overflow: 'hidden',
                    cursor: 'zoom-in',
                    aspectRatio: '1 / 1',
                  }}
                >
                  <Box
                    component="img"
                    src={productUrls[index]}
                    alt={`S${index + 1}`}
                    sx={{ width: 1, height: 1, objectFit: 'cover' }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 4,
                      bottom: 4,
                      px: 0.5,
                      borderRadius: 0.75,
                      typography: 'caption',
                      fontWeight: 600,
                      color: 'common.white',
                      bgcolor: 'rgba(0,0,0,0.55)',
                    }}
                  >
                    S{index + 1}
                    {lineNo ? ` · dòng ${lineNo}` : ''}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Stack>
  );
}
