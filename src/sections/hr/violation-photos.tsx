'use client';

import { useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { getStorageUrl } from 'src/utils/storage';
import { apiErrorMessage } from 'src/utils/api-error';

import { removeViolationPhoto, uploadViolationPhoto } from 'src/api/hr';

import Iconify from 'src/components/iconify';

import type { IViolationPhoto } from 'src/types/hr';

// ----------------------------------------------------------------------
// Ảnh minh chứng vi phạm (web): chọn / kéo thả ảnh, nén ở trình duyệt (cạnh dài ≤ 1600px, JPEG 0,7 — vẽ lại qua canvas nên mất
// EXIF / GPS), tải ngay lên kho riêng tư bằng presigned PUT. Xem ảnh của lần ghi nhận: thumbnail + phóng to; ảnh tự xoá sau
// 90 ngày hiện "đã xoá", điểm trừ không đổi.
// ----------------------------------------------------------------------

export const MAX_VIOLATION_PHOTOS = 5;
const MAX_EDGE = 1600;
const ACCEPT = 'image/jpeg,image/png,image/webp';

/** Thu nhỏ + nén ảnh bằng canvas; trình duyệt không vẽ được (ảnh hỏng) thì trả tệp gốc. */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
    return blob && blob.size > 0 ? blob : file;
  } catch {
    return file;
  }
}

export type DraftViolationPhoto = {
  key: string;
  previewUrl: string;
  status: 'uploading' | 'done' | 'error';
  photoId?: string;
  objectKey?: string;
  error?: string;
};

/** Vùng chọn / kéo thả ảnh + thumbnail có trạng thái tải. `photos` do form giữ để biết key khi ghi nhận. */
export function ViolationPhotoPicker({
  photos,
  onChange,
}: {
  photos: DraftViolationPhoto[];
  onChange: (update: (prev: DraftViolationPhoto[]) => DraftViolationPhoto[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const room = MAX_VIOLATION_PHOTOS - photos.length;

  const add = (files: File[]) => {
    const picked = files.filter((f) => ACCEPT.split(',').includes(f.type)).slice(0, room);
    picked.forEach((file) => {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      onChange((prev) => [...prev, { key, previewUrl: URL.createObjectURL(file), status: 'uploading' }]);
      compressImage(file)
        .then((blob) => uploadViolationPhoto(blob, 'Library'))
        .then((r) => onChange((prev) => prev.map((p) => (p.key === key ? { ...p, status: 'done', ...r } : p))))
        .catch((err) =>
          onChange((prev) =>
            prev.map((p) => (p.key === key ? { ...p, status: 'error', error: apiErrorMessage(err, 'Ảnh chưa tải lên được') } : p))
          )
        );
    });
  };

  const remove = (p: DraftViolationPhoto) => {
    onChange((prev) => prev.filter((x) => x.key !== p.key));
    if (p.photoId) removeViolationPhoto(p.photoId).catch(() => {});
    URL.revokeObjectURL(p.previewUrl);
  };

  return (
    <Stack spacing={1}>
      {photos.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {photos.map((p) => (
            <Box
              key={p.key}
              title={p.error}
              sx={{ position: 'relative', width: 72, height: 72, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover' }}
            >
              <Box component="img" src={p.previewUrl} alt="" sx={{ width: 1, height: 1, objectFit: 'cover' }} />
              {p.status !== 'done' && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,0.45)' }}>
                  {p.status === 'uploading' ? (
                    <CircularProgress size={22} sx={{ color: 'common.white' }} />
                  ) : (
                    <Iconify icon="solar:danger-triangle-bold" sx={{ color: 'common.white' }} />
                  )}
                </Box>
              )}
              <IconButton
                size="small"
                aria-label="Bỏ ảnh"
                onClick={() => remove(p)}
                sx={{ position: 'absolute', top: 2, right: 2, p: 0.25, bgcolor: 'rgba(0,0,0,0.55)', color: 'common.white' }}
              >
                <Iconify icon="mingcute:close-line" width={14} />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
      {room > 0 && (
        <Box
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            add(Array.from(e.dataTransfer.files));
          }}
          sx={{
            p: 2,
            borderRadius: 1,
            cursor: 'pointer',
            textAlign: 'center',
            border: '2px dashed',
            borderColor: dragging ? 'primary.main' : 'divider',
            color: 'text.secondary',
          }}
        >
          <Iconify icon="solar:gallery-add-bold" width={24} />
          <Typography variant="body2">
            Kéo thả ảnh vào đây hoặc bấm để chọn — còn {room} ảnh, tự nén, tự xoá sau 90 ngày
          </Typography>
          <input
            ref={input}
            hidden
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(e) => {
              add(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </Box>
      )}
    </Stack>
  );
}

/** Ảnh của một lần ghi nhận: thumbnail 40px, bấm để phóng to; ảnh đã tự xoá hiện chú thích. */
export function ViolationPhotoThumbs({ photos }: { photos?: IViolationPhoto[] | null }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!photos?.length) return null;
  const live = photos.filter((p) => !p.deleted && p.url);
  const deleted = photos.length - live.length;
  return (
    <Box sx={{ mt: 0.5 }}>
      <Stack direction="row" spacing={0.5}>
        {live.map((p) => (
          <Box
            key={p.id}
            component="img"
            src={getStorageUrl(p.url)}
            alt="Ảnh minh chứng"
            onClick={() => setOpen(getStorageUrl(p.url))}
            title={`Lưu tới ${fDate(p.expiresAt, 'dd/MM/yyyy')}`}
            sx={{ width: 40, height: 40, borderRadius: 0.75, objectFit: 'cover', cursor: 'zoom-in' }}
          />
        ))}
      </Stack>
      {deleted > 0 && (
        <Typography variant="caption" color="text.disabled" display="block">
          Ảnh đã tự xoá sau 90 ngày ({deleted} ảnh)
        </Typography>
      )}
      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="lg">
        {open && <Box component="img" src={open} alt="Ảnh minh chứng" sx={{ display: 'block', maxWidth: 1, maxHeight: '85vh' }} />}
      </Dialog>
    </Box>
  );
}
