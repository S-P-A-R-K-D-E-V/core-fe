'use client';

import type { QuickReply, QuickReplyInput } from 'src/lib/inbox';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';

import { apiErrorMessage } from 'src/utils/api-error';

import { uploadConversationImage } from 'src/api/inbox';
import {
  isValidShortcut,
  normalizeShortcut,
  MESSAGE_MAX_IMAGES,
  MESSAGE_MAX_LENGTH,
  SHORTCUT_MAX_LENGTH,
} from 'src/lib/inbox';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Thêm / sửa một mẫu trả lời nhanh: shortcut (gõ "/shortcut" trong ô trả lời), tiêu đề, nội dung, ảnh kèm, thứ tự.

type Props = {
  open: boolean;
  reply: QuickReply | null;
  /** Thứ tự mặc định cho mẫu mới. */
  nextSortOrder: number;
  onClose: VoidFunction;
  onSave: (input: QuickReplyInput) => Promise<void>;
};

export default function InboxQuickReplyDialog({ open, reply, nextSortOrder, onClose, onSave }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);

  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState('0');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShortcut(reply?.shortcut ?? '');
    setTitle(reply?.title ?? '');
    setText(reply?.text ?? '');
    setImages(reply?.imageUrls ?? []);
    setSortOrder(String(reply?.sortOrder ?? nextSortOrder));
    setTouched(false);
  }, [open, reply, nextSortOrder]);

  const normalized = normalizeShortcut(shortcut);
  const shortcutError = touched && !isValidShortcut(normalized);
  const valid = isValidShortcut(normalized) && !!title.trim() && (!!text.trim() || images.length > 0) && text.length <= MESSAGE_MAX_LENGTH;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const list = Array.from(files)
        .filter((f) => f.type === 'image/jpeg' || f.type === 'image/png')
        .slice(0, MESSAGE_MAX_IMAGES - images.length);
      const urls = await Promise.all(list.map((f) => uploadConversationImage(f)));
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Tải ảnh lên thất bại'), { variant: 'error' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      await onSave({
        shortcut: normalized,
        title: title.trim(),
        text: text.trim(),
        imageUrls: images,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
      });
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được mẫu'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{reply ? 'Sửa mẫu trả lời nhanh' : 'Thêm mẫu trả lời nhanh'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Phím tắt"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              onBlur={() => setTouched(true)}
              error={shortcutError}
              helperText={
                shortcutError
                  ? `Chữ thường không dấu, số, gạch ngang; ≤ ${SHORTCUT_MAX_LENGTH} ký tự`
                  : 'Gõ "/" + phím tắt trong ô trả lời'
              }
              inputProps={{ maxLength: SHORTCUT_MAX_LENGTH + 1 }}
              InputProps={{ startAdornment: <InputAdornment position="start">/</InputAdornment> }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Thứ tự"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              sx={{ width: { xs: 1, sm: 120 } }}
            />
          </Stack>
          <TextField
            label="Tiêu đề"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="vd: Báo giá + phí ship"
          />
          <TextField
            label="Nội dung gửi khách"
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            minRows={4}
            maxRows={12}
            error={text.length > MESSAGE_MAX_LENGTH}
            helperText={`${text.length}/${MESSAGE_MAX_LENGTH}`}
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Ảnh kèm ({images.length}/{MESSAGE_MAX_IMAGES})
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              {images.map((url) => (
                <Box key={url} sx={{ position: 'relative', width: 72, height: 72 }}>
                  <Box component="img" src={url} alt="Ảnh mẫu" sx={{ width: 1, height: 1, objectFit: 'cover', borderRadius: 1 }} />
                  <IconButton
                    size="small"
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      p: 0.25,
                      bgcolor: 'grey.800',
                      color: 'common.white',
                      '&:hover': { bgcolor: 'grey.700' },
                    }}
                    aria-label="Bỏ ảnh"
                  >
                    <Iconify icon="mingcute:close-line" width={14} />
                  </IconButton>
                </Box>
              ))}
              {images.length < MESSAGE_MAX_IMAGES && (
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  sx={{ width: 72, height: 72, minWidth: 0 }}
                >
                  <Iconify icon={uploading ? 'svg-spinners:8-dots-rotate' : 'solar:gallery-add-bold'} />
                </Button>
              )}
            </Stack>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={uploading || (touched && !valid)} onClick={handleSave}>
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
