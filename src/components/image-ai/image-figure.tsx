'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

// ----------------------------------------------------------------------
// Ô ảnh vuông có tiêu đề + lớp "đang chạy" — dùng để so sánh trước / sau (ảnh gốc ↔ ảnh AI).

type Props = {
  title: string;
  url: string | null;
  loading?: boolean;
  loadingText?: string;
};

export function ImageFigure({ title, url, loading, loadingText }: Props) {
  return (
    <Stack spacing={1}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
        {title}
      </Typography>
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '1',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.neutral',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {url && (
          <Box
            component="img"
            src={url}
            alt={title}
            sx={{ width: 1, height: 1, objectFit: 'contain' }}
          />
        )}
        {loading && (
          <Stack
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0.7)' }}
          >
            <CircularProgress size={28} />
            <Typography variant="caption">{loadingText}</Typography>
          </Stack>
        )}
        {!url && !loading && (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            Chưa có
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
