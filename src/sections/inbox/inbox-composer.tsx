'use client';

import type { QuickReply, SendMessageInput } from 'src/lib/inbox';

import { useRef, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';

import { uploadConversationImage } from 'src/api/inbox';
import {
  windowState,
  applyQuickReply,
  parseSlashQuery,
  MESSAGE_MAX_IMAGES,
  MESSAGE_MAX_LENGTH,
  filterQuickReplies,
} from 'src/lib/inbox';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Ô gõ: Enter gửi, Shift+Enter xuống dòng; gõ "/" gọi mẫu trả lời nhanh (↑ ↓ chọn, Enter / Tab chèn, Esc đóng); đính ảnh
// (JPEG / PNG, ≤ 10); công tắc Ghi chú nội bộ. Không trả lời được (canReply false) → vẫn ghi chú nội bộ được.
// Cửa sổ 24 giờ của Meta còn dưới 3 giờ → cảnh báo.
// ----------------------------------------------------------------------

type Props = {
  canReply: boolean;
  reason: string | null;
  windowEndsAt: string | null;
  quickReplies: QuickReply[];
  /** Ném lỗi = giữ nguyên nội dung để người dùng sửa / gửi lại. */
  onSend: (input: SendMessageInput) => Promise<void>;
  /** Có quyền conversation.reply. */
  allowed: boolean;
  /** Đổi hội thoại → xoá nháp. */
  conversationId: string;
};

const PICKER_LIMIT = 8;

export default function InboxComposer({
  canReply,
  reason,
  windowEndsAt,
  quickReplies,
  onSend,
  allowed,
  conversationId,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [note, setNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [pickerClosed, setPickerClosed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setText('');
    setImages([]);
    setNote(false);
  }, [conversationId]);

  // Cửa sổ 24 giờ: tính lại mỗi phút.
  useEffect(() => {
    if (!windowEndsAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [windowEndsAt]);

  const win = windowState(windowEndsAt, now);
  const slash = parseSlashQuery(text);
  const slashQuery = slash?.query ?? null;
  const slashStart = slash?.start ?? null;
  const matches = useMemo(
    () => (slashQuery !== null ? filterQuickReplies(quickReplies, slashQuery).slice(0, PICKER_LIMIT) : []),
    [slashQuery, quickReplies]
  );
  const pickerOpen = !!slash && !pickerClosed && matches.length > 0;

  useEffect(() => {
    setPickerIndex(0);
    setPickerClosed(false);
  }, [slashQuery, slashStart]);

  const blocked = !allowed || (!canReply && !note);
  const tooLong = text.length > MESSAGE_MAX_LENGTH;
  const empty = !text.trim() && images.length === 0;

  const insertReply = (reply: QuickReply) => {
    if (!slash) return;
    setText(applyQuickReply(text, slash, reply));
    if (reply.imageUrls.length) {
      setImages((prev) => Array.from(new Set([...prev, ...reply.imageUrls])).slice(0, MESSAGE_MAX_IMAGES));
    }
    setPickerClosed(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSend = async () => {
    if (blocked || empty || tooLong || sending || uploading) return;
    setSending(true);
    try {
      await onSend({
        text: text.trim() || undefined,
        imageUrls: images.length ? images : undefined,
        internalNote: note || undefined,
      });
      setText('');
      setImages([]);
    } catch {
      // Lỗi đã báo ở nơi gọi; giữ nội dung.
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (pickerOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPickerIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPickerIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertReply(matches[pickerIndex] ?? matches[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setPickerClosed(true);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type === 'image/jpeg' || f.type === 'image/png');
    if (list.length < files.length) enqueueSnackbar('Chỉ gửi được ảnh JPEG / PNG', { variant: 'warning' });
    const room = MESSAGE_MAX_IMAGES - images.length;
    if (room <= 0) {
      enqueueSnackbar(`Tối đa ${MESSAGE_MAX_IMAGES} ảnh mỗi tin`, { variant: 'warning' });
      return;
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const file of list.slice(0, room)) {
        // eslint-disable-next-line no-await-in-loop
        urls.push(await uploadConversationImage(file));
      }
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Tải ảnh lên thất bại'), { variant: 'error' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Box sx={{ borderTop: (theme) => `solid 1px ${theme.palette.divider}`, position: 'relative' }}>
      {!allowed && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          Bạn chỉ có quyền xem hộp thư (cần quyền “Trả lời khách”).
        </Alert>
      )}
      {allowed && !canReply && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          {reason || 'Hiện không gửi được tin cho khách.'} Bạn vẫn có thể ghi chú nội bộ.
        </Alert>
      )}
      {allowed && canReply && win.kind === 'open' && win.warn && (
        <Alert severity="warning" icon={<Iconify icon="solar:clock-circle-bold" />} sx={{ borderRadius: 0, py: 0 }}>
          {win.text}
        </Alert>
      )}

      {pickerOpen && (
        <Paper
          elevation={8}
          sx={{ position: 'absolute', bottom: '100%', left: 8, right: 8, mb: 1, zIndex: 10, maxHeight: 320, overflow: 'auto' }}
        >
          <Typography variant="caption" sx={{ display: 'block', px: 2, pt: 1, color: 'text.disabled' }}>
            Mẫu trả lời nhanh — ↑ ↓ chọn, Enter chèn, Esc đóng
          </Typography>
          <List dense disablePadding>
            {matches.map((r, i) => (
              <ListItemButton
                key={r.id}
                selected={i === pickerIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertReply(r)}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
                        /{r.shortcut}
                      </Typography>
                      <Typography variant="body2" noWrap>
                        {r.title}
                      </Typography>
                      {r.imageUrls.length > 0 && (
                        <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: 'text.disabled' }}>
                          <Iconify icon="solar:gallery-bold" width={14} />
                          <Typography variant="caption">{r.imageUrls.length}</Typography>
                        </Stack>
                      )}
                    </Stack>
                  }
                  secondary={r.text}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      )}

      {images.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ px: 2, pt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
          {images.map((url) => (
            <Box key={url} sx={{ position: 'relative', width: 64, height: 64 }}>
              <Box
                component="img"
                src={url}
                alt="Ảnh đính kèm"
                sx={{ width: 1, height: 1, objectFit: 'cover', borderRadius: 1 }}
              />
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
        </Stack>
      )}

      <Box
        sx={{
          px: 2,
          pt: 1.5,
          ...(note && { bgcolor: 'warning.lighter' }),
        }}
      >
        <InputBase
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={8}
          value={text}
          disabled={!allowed}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            note
              ? 'Ghi chú nội bộ — khách không thấy…'
              : 'Nhập tin trả lời… (gõ / để chọn mẫu trả lời nhanh)'
          }
          sx={{ typography: 'body2', ...(note && { color: 'grey.800' }) }}
        />
      </Box>

      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1, py: 1, ...(note && { bgcolor: 'warning.lighter' }) }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Tooltip title="Đính ảnh (JPEG / PNG)">
          <span>
            <IconButton
              onClick={() => fileRef.current?.click()}
              disabled={!allowed || uploading || images.length >= MESSAGE_MAX_IMAGES}
            >
              <Iconify icon={uploading ? 'svg-spinners:8-dots-rotate' : 'solar:gallery-add-bold'} />
            </IconButton>
          </span>
        </Tooltip>

        <FormControlLabel
          control={<Switch size="small" color="warning" checked={note} onChange={(_, v) => setNote(v)} />}
          label={<Typography variant="body2">Ghi chú nội bộ</Typography>}
          disabled={!allowed}
          sx={{ mx: 0 }}
        />

        <Box sx={{ flex: 1 }} />

        {text.length > MESSAGE_MAX_LENGTH * 0.8 && (
          <Typography variant="caption" sx={{ color: tooLong ? 'error.main' : 'text.disabled' }}>
            {text.length}/{MESSAGE_MAX_LENGTH}
          </Typography>
        )}

        <LoadingButton
          variant="contained"
          color={note ? 'warning' : 'primary'}
          loading={sending}
          disabled={blocked || empty || tooLong || uploading}
          onClick={handleSend}
          endIcon={<Iconify icon={note ? 'solar:notes-bold' : 'solar:plain-2-bold'} />}
        >
          {note ? 'Ghi chú' : 'Gửi'}
        </LoadingButton>
      </Stack>
    </Box>
  );
}
