'use client';

import { useRef, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import imageCompression from 'browser-image-compression';

import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Lightbox, { useLightBox } from 'src/components/lightbox';

import { getStorageUrl } from 'src/utils/storage';

import type { CleaningTaskStatus, ICleaningTaskInstance } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export const MAX_PHOTOS = 5;
// Nén ảnh vượt ngưỡng này trước khi upload để đỡ tốn băng thông/thời gian tải — không phải giới hạn
// cứng của backend (ảnh/video giờ PUT thẳng lên R2 qua presigned URL, không còn giới hạn dung
// lượng ở API). Video không bị nén (imageCompression lỗi im lặng, giữ nguyên file gốc — xem catch
// bên dưới).
export const MAX_PHOTO_SIZE_MB = 3.5;

export const BLOCK_LABEL: Record<string, string> = { Morning: 'Sáng', Afternoon: 'Chiều', Evening: 'Tối' };

export const STATUS_LABEL: Record<CleaningTaskStatus, { label: string; color: 'default' | 'info' | 'success' | 'error' }> = {
  Pending: { label: 'Chưa làm', color: 'default' },
  Done: { label: 'Chờ chấm', color: 'info' },
  Passed: { label: 'Đạt', color: 'success' },
  Failed: { label: 'Không đạt', color: 'error' },
};

export function TaskPhotoThumbnails({ objectKeys }: { objectKeys: string[] }) {
  const slides = objectKeys.map((key) => ({ src: getStorageUrl(key) }));
  const lightbox = useLightBox(slides);

  if (objectKeys.length === 0) return null;

  return (
    <>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
        {objectKeys.map((key) => (
          <Box
            key={key}
            component="img"
            src={getStorageUrl(key)}
            onClick={() => lightbox.onOpen(getStorageUrl(key))}
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1,
              objectFit: 'cover',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
        ))}
      </Stack>
      <Lightbox index={lightbox.selected} slides={slides} open={lightbox.open} close={lightbox.onClose} />
    </>
  );
}

export function TaskRow({
  task,
  currentUserId,
  onComplete,
  busy,
}: {
  task: ICleaningTaskInstance;
  currentUserId?: string;
  onComplete: (taskId: string, files: File[]) => void;
  busy: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [compressing, setCompressing] = useState(false);
  const canComplete = task.status === 'Pending' || task.status === 'Done';
  const myPenalties = task.penalties.filter((p) => !p.voidedAt && p.userId === currentUserId);

  const handlePick = () => fileInputRef.current?.click();

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (files.length > MAX_PHOTOS) {
      // eslint-disable-next-line no-alert
      alert(`Chỉ chọn tối đa ${MAX_PHOTOS} ảnh`);
      return;
    }
    // Guard bằng ref (đồng bộ) chứ không chỉ dựa vào state compressing/busy: 2 sự kiện onChange bắn
    // liên tiếp trong cùng 1 tick (một số webview di động lặp change event) đều đọc state cũ là false
    // trước khi React kịp re-render nút disabled -> gửi trùng request hoàn thành, gây race ở BE (xem
    // CompleteCleaningTaskCommandHandler).
    if (submittingRef.current) return;
    submittingRef.current = true;
    setCompressing(true);
    try {
      const compressed = await Promise.all(
        files.map(async (file) => {
          if (file.size <= MAX_PHOTO_SIZE_MB * 1024 * 1024) return file;
          try {
            return await imageCompression(file, {
              maxSizeMB: MAX_PHOTO_SIZE_MB,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            });
          } catch {
            return file;
          }
        })
      );
      onComplete(task.id, compressed);
    } finally {
      setCompressing(false);
      submittingRef.current = false;
    }
  };

  return (
    <Box sx={{ py: 1.5 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="subtitle2">{task.name}</Typography>
          {task.area && (
            <Typography variant="caption" color="text.secondary">
              {task.area}
            </Typography>
          )}
        </Box>
        <Label color={STATUS_LABEL[task.status]?.color || 'default'}>
          {STATUS_LABEL[task.status]?.label || task.status}
        </Label>
      </Stack>

      {task.status === 'Done' && (
        <Typography variant="caption" color="info.main" sx={{ display: 'block', mt: 0.5 }}>
          Đã gửi ảnh, đang chờ Quản lý chấm điểm.
        </Typography>
      )}
      {task.status === 'Failed' && task.reviewNote && (
        <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
          Ghi chú: {task.reviewNote}
        </Typography>
      )}
      {myPenalties.map((p) => (
        <Typography key={p.id} variant="caption" color="error.main" sx={{ display: 'block', fontWeight: 600 }}>
          Bị phạt {p.amount.toLocaleString('vi-VN')}đ{p.reason ? ` — ${p.reason}` : ''}
        </Typography>
      ))}

      <TaskPhotoThumbnails objectKeys={task.photoObjectKeys} />

      {canComplete && (
        <Box sx={{ mt: 1 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={handleFilesSelected}
          />
          <Button
            size="small"
            variant={task.status === 'Done' ? 'outlined' : 'contained'}
            startIcon={<Iconify icon="solar:camera-bold" />}
            loading={busy || compressing}
            disabled={busy || compressing}
            onClick={handlePick}
          >
            {compressing
              ? 'Đang xử lý ảnh...'
              : task.status === 'Done'
                ? 'Chụp lại ảnh'
                : `Chọn ảnh & hoàn thành (tối đa ${MAX_PHOTOS})`}
          </Button>
        </Box>
      )}
    </Box>
  );
}
