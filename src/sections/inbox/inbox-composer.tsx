'use client';

import type { QuickReply, SendMessageInput, ConversationKind } from 'src/lib/inbox';

import { useRef, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
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
  appendSlash,
  windowState,
  QUICK_EMOJIS,
  maxImagesFor,
  insertAtCursor,
  applyQuickReply,
  parseSlashQuery,
  MESSAGE_MAX_LENGTH,
  filterQuickReplies,
} from 'src/lib/inbox';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import InboxPrivateReplyDialog from './inbox-private-reply-dialog';

// ----------------------------------------------------------------------
// Ô gõ: Enter gửi, Shift+Enter xuống dòng; gõ "/" gọi mẫu trả lời nhanh (↑ ↓ chọn, Enter / Tab chèn, Esc đóng); đính ảnh
// (JPEG / PNG, ≤ 10); công tắc Ghi chú nội bộ. Không trả lời được (canReply false) → vẫn ghi chú nội bộ được.
// Cửa sổ 24 giờ của Meta còn dưới 3 giờ → cảnh báo.
// Thanh công cụ kiểu Meta Business Suite: đính ảnh, mẫu trả lời nhanh (mở ô chọn "/"), biểu tượng cảm xúc, ô trống thì có
// nút 👍 gửi nhanh.
// Hội thoại bình luận: Gửi = "Trả lời công khai" dưới bình luận gần nhất của khách (tối đa 1 ảnh, không có cửa sổ 24 giờ);
// thêm nút "Nhắn riêng" (Messenger, 1 lần / bình luận).
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
  /** Đổ sẵn nội dung (gợi ý của agent) — mỗi lần đổi `key` là một lần đổ. */
  prefill?: { key: number; text: string; images: string[]; onlyIfEmpty?: boolean } | null;
  /** Loại hội thoại — comment: trả lời công khai, 1 ảnh, có Nhắn riêng. */
  kind?: ConversationKind;
  /** Tên khách (tiêu đề dialog Nhắn riêng). */
  customerName?: string;
  /** Nhắn riêng cho người bình luận (chỉ hội thoại bình luận). Ném lỗi = giữ dialog. */
  onPrivateReply?: (text: string) => Promise<void>;
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
  prefill,
  kind = 'dm',
  customerName = '',
  onPrivateReply,
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
  const [privateOpen, setPrivateOpen] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);

  const comment = kind === 'comment';
  const maxImages = maxImagesFor(kind);
  const imageLimitText = comment
    ? 'Trả lời bình luận chỉ kèm được 1 ảnh'
    : `Tối đa ${maxImages} ảnh mỗi tin`;

  useEffect(() => {
    setText('');
    setImages([]);
    setNote(false);
  }, [conversationId]);

  // Dùng gợi ý của agent: đổ chữ + ảnh vào ô soạn để nhân viên sửa rồi gửi.
  const prefillKey = prefill?.key;
  const draftRef = useRef({ text: '', images: 0 });
  draftRef.current = { text, images: images.length };
  useEffect(() => {
    if (!prefill) return;
    // Gợi ý tự đến: không đè lên nội dung nhân viên đang gõ.
    if (prefill.onlyIfEmpty && (draftRef.current.text.trim() || draftRef.current.images > 0)) return;
    setText(prefill.text);
    setImages(prefill.images.slice(0, maxImages));
    setNote(false);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  // Cửa sổ 24 giờ: tính lại mỗi phút (bình luận không có cửa sổ).
  useEffect(() => {
    if (!windowEndsAt || comment) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [windowEndsAt, comment]);

  const win = windowState(comment ? null : windowEndsAt, now);
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
      const merged = Array.from(new Set([...images, ...reply.imageUrls]));
      if (merged.length > maxImages) enqueueSnackbar(imageLimitText, { variant: 'warning' });
      setImages(merged.slice(0, maxImages));
    }
    setPickerClosed(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSend = async () => {
    if (blocked || empty || tooLong || sending || uploading) return;
    if (images.length > maxImages) {
      enqueueSnackbar(imageLimitText, { variant: 'warning' });
      return;
    }
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

  /** Gửi nhanh 👍 (ô gõ trống). */
  const handleLike = async () => {
    if (blocked || note || sending || uploading) return;
    setSending(true);
    try {
      await onSend({ text: '👍' });
    } catch {
      // Lỗi đã báo ở nơi gọi.
    } finally {
      setSending(false);
    }
  };

  /** Chèn biểu tượng cảm xúc vào chỗ con trỏ. */
  const handleEmoji = (emoji: string) => {
    const el = inputRef.current;
    const next = insertAtCursor(text, emoji, el?.selectionStart, el?.selectionEnd);
    setText(next.text);
    setEmojiAnchor(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };

  /** Nút Mẫu trả lời nhanh: thêm "/" để mở ô chọn mẫu. */
  const handleQuickReplies = () => {
    setText((t) => appendSlash(t));
    setPickerClosed(false);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
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
    const room = maxImages - images.length;
    if (room <= 0) {
      enqueueSnackbar(imageLimitText, { variant: 'warning' });
      return;
    }
    if (list.length > room) enqueueSnackbar(imageLimitText, { variant: 'warning' });
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
              : comment
                ? 'Trả lời công khai dưới bình luận của khách…'
                : 'Trả lời trong Messenger…'
          }
          sx={{ typography: 'body2', ...(note && { color: 'grey.800' }) }}
        />
      </Box>

      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{ px: 1, py: 1, ...(note && { bgcolor: 'warning.lighter' }) }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple={!comment}
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Tooltip
          title={
            images.length >= maxImages
              ? imageLimitText
              : comment
                ? 'Đính 1 ảnh (JPEG / PNG) — bình luận chỉ kèm được 1 ảnh'
                : 'Đính ảnh (JPEG / PNG)'
          }
        >
          <span>
            <IconButton
              onClick={() => fileRef.current?.click()}
              disabled={!allowed || uploading || images.length >= maxImages}
            >
              <Iconify icon={uploading ? 'svg-spinners:8-dots-rotate' : 'solar:gallery-add-bold'} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={quickReplies.length ? 'Mẫu trả lời nhanh (hoặc gõ /)' : 'Chưa có mẫu trả lời nhanh'}>
          <span>
            <IconButton onClick={handleQuickReplies} disabled={!allowed || quickReplies.length === 0}>
              <Iconify icon="solar:bolt-circle-bold" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Biểu tượng cảm xúc">
          <span>
            <IconButton onClick={(e) => setEmojiAnchor(e.currentTarget)} disabled={!allowed}>
              <Iconify icon="solar:smile-circle-bold" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Ghi chú nội bộ — khách không thấy">
          <FormControlLabel
            control={<Switch size="small" color="warning" checked={note} onChange={(_, v) => setNote(v)} />}
            label={
              <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Ghi chú nội bộ
              </Typography>
            }
            disabled={!allowed}
            sx={{ mx: 0, ml: 0.5 }}
          />
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {comment && images.length >= maxImages && (
          <Typography variant="caption" sx={{ color: 'text.disabled', display: { xs: 'none', sm: 'block' } }}>
            Tối đa 1 ảnh
          </Typography>
        )}

        {text.length > MESSAGE_MAX_LENGTH * 0.8 && (
          <Typography variant="caption" sx={{ color: tooLong ? 'error.main' : 'text.disabled' }}>
            {text.length}/{MESSAGE_MAX_LENGTH}
          </Typography>
        )}

        {comment && onPrivateReply && (
          <Tooltip title="Nhắn Messenger riêng cho người bình luận (1 lần / bình luận, trong 7 ngày)">
            <span>
              <Button
                variant="outlined"
                color="inherit"
                disabled={!allowed || !canReply || sending}
                onClick={() => setPrivateOpen(true)}
                startIcon={<Iconify icon="solar:letter-bold" />}
              >
                Nhắn riêng
              </Button>
            </span>
          </Tooltip>
        )}

        {empty && !note ? (
          <Tooltip title="Gửi 👍">
            <span>
              <IconButton
                color="primary"
                aria-label="Gửi biểu tượng thích"
                disabled={blocked || sending || uploading}
                onClick={handleLike}
                sx={{ fontSize: 22, width: 40, height: 40 }}
              >
                {sending ? <Iconify icon="svg-spinners:8-dots-rotate" /> : <span aria-hidden>👍</span>}
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <LoadingButton
            variant="contained"
            color={note ? 'warning' : 'primary'}
            loading={sending}
            disabled={blocked || empty || tooLong || uploading}
            onClick={handleSend}
            endIcon={<Iconify icon={note ? 'solar:notes-bold' : 'solar:plain-2-bold'} />}
          >
            {note ? 'Ghi chú' : comment ? 'Trả lời công khai' : 'Gửi'}
          </LoadingButton>
        )}
      </Stack>

      <Popover
        open={!!emojiAnchor}
        anchorEl={emojiAnchor}
        onClose={() => setEmojiAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 1 } } }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 36px)', gap: 0.25 }}>
          {QUICK_EMOJIS.map((emoji) => (
            <IconButton
              key={emoji}
              onClick={() => handleEmoji(emoji)}
              aria-label={`Chèn ${emoji}`}
              sx={{ width: 36, height: 36, fontSize: 20, borderRadius: 1 }}
            >
              {emoji}
            </IconButton>
          ))}
        </Box>
      </Popover>

      {comment && onPrivateReply && (
        <InboxPrivateReplyDialog
          open={privateOpen}
          customerName={customerName}
          onClose={() => setPrivateOpen(false)}
          onSend={onPrivateReply}
        />
      )}
    </Box>
  );
}
