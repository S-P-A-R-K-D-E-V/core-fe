'use client';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------
// Ô nhắn trợ lý của lần nhập: câu tự do + ảnh sản phẩm (chọn / dán / kéo thả, tối đa `maxPhotos`). Enter gửi, Shift+Enter
// xuống dòng. Trạng thái (chữ, ảnh) do drawer giữ để nút "Thêm ảnh" ở cột ảnh và câu mẫu điền được vào đây.
// ----------------------------------------------------------------------

export type ComposerPhoto = { file: File; preview: string };

type Props = {
  draft: string;
  onDraftChange: (text: string) => void;
  photos: ComposerPhoto[];
  maxPhotos: number;
  onAddFiles: (files: File[]) => void;
  onRemovePhoto: (index: number) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  sending: boolean;
  disabled: boolean;
  error: string | null;
  onDismissError: () => void;
  onSend: () => void;
};

export default function PurchaseImportComposer({
  draft,
  onDraftChange,
  photos,
  maxPhotos,
  onAddFiles,
  onRemovePhoto,
  fileRef,
  sending,
  disabled,
  error,
  onDismissError,
  onSend,
}: Props) {
  return (
    <Box
      sx={{ px: 2, py: 1.25, borderTop: (theme) => `1px solid ${theme.palette.divider}` }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onAddFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={onDismissError}>
          {error}
        </Alert>
      )}
      {photos.length > 0 && (
        <Stack direction="row" spacing={0.75} sx={{ mb: 1 }}>
          {photos.map((photo, index) => (
            <Box key={photo.preview} sx={{ position: 'relative' }}>
              <Box
                component="img"
                src={photo.preview}
                alt=""
                sx={{ width: 52, height: 52, borderRadius: 1, objectFit: 'cover' }}
              />
              <IconButton
                size="small"
                aria-label="Bỏ ảnh"
                onClick={() => onRemovePhoto(index)}
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  p: 0.25,
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                }}
              >
                <Iconify icon="mingcute:close-line" width={12} />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <Tooltip title={`Gửi ảnh sản phẩm (tối đa ${maxPhotos})`}>
          <span>
            <IconButton
              disabled={sending || disabled || photos.length >= maxPhotos}
              onClick={() => fileRef.current?.click()}
            >
              <Badge badgeContent={photos.length} color="primary">
                <Iconify icon="solar:camera-add-linear" width={22} />
              </Badge>
            </IconButton>
          </span>
        </Tooltip>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          size="small"
          value={draft}
          disabled={disabled}
          placeholder="Nhắn trợ lý về hoá đơn này: «dòng 3 là máy sấy cute», «đơn này nhập rồi, đối chiếu lại»…"
          onChange={(event) => onDraftChange(event.target.value)}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (files.some((f) => f.type.startsWith('image/'))) {
              event.preventDefault();
              onAddFiles(files);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <LoadingButton
          variant="contained"
          loading={sending}
          disabled={disabled || (!draft.trim() && photos.length === 0)}
          onClick={onSend}
          sx={{ minWidth: 0, px: 1.5 }}
          aria-label="Gửi"
        >
          <Iconify icon="iconamoon:send-fill" width={20} />
        </LoadingButton>
      </Stack>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          onAddFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </Box>
  );
}
