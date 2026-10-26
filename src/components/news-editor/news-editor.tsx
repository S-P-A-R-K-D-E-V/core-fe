'use client';

import type { Editor } from '@tiptap/react';

import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import { DOMSerializer } from '@tiptap/pm/model';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useEditor, BubbleMenu, EditorContent } from '@tiptap/react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import FormHelperText from '@mui/material/FormHelperText';
import CircularProgress from '@mui/material/CircularProgress';

import Iconify from 'src/components/iconify';

import { newsContentSx } from './news-content-sx';

// ----------------------------------------------------------------------

export type NewsEditorAiAction = { key: string; label: string; icon: string };

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  error?: boolean;
  helperText?: React.ReactNode;
  /** Tải ảnh lên (presigned R2) — trả URL công khai để chèn vào bài. */
  onUploadImage?: (file: File) => Promise<string>;
  /** Trợ lý AI sửa đoạn đang bôi đen (menu nổi trên vùng chọn); không truyền = không có menu. */
  aiActions?: NewsEditorAiAction[];
  onAiRewrite?: (html: string, action: string) => Promise<string>;
  onError?: (message: string) => void;
};

function ToolButton({
  title,
  icon,
  active,
  disabled,
  onClick,
}: {
  title: string;
  icon: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip title={title}>
      <span>
        <ButtonBase
          aria-label={title}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          sx={{
            width: 32,
            height: 32,
            borderRadius: 0.75,
            color: active ? 'primary.main' : 'text.secondary',
            bgcolor: active ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
            '&.Mui-disabled': { opacity: 0.4 },
          }}
        >
          <Iconify icon={icon} width={18} />
        </ButtonBase>
      </span>
    </Tooltip>
  );
}

/** HTML của vùng đang chọn (giữ định dạng) — gửi cho AI viết lại. */
function selectionHtml(editor: Editor): string {
  const { from, to } = editor.state.selection;
  const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(
    editor.state.doc.slice(from, to).content
  );
  const div = document.createElement('div');
  div.appendChild(fragment);
  return div.innerHTML;
}

/**
 * Trình soạn bài tin tức (tiptap — editor của template Minimal v6): tiêu đề mục, chữ đậm / nghiêng / gạch, danh sách,
 * trích dẫn, căn lề, link, ảnh (tải lên R2), hoàn tác; menu AI nổi khi bôi đen đoạn văn; toàn màn hình.
 */
export function NewsEditor({
  value,
  onChange,
  placeholder = 'Viết nội dung bài…',
  error,
  helperText,
  onUploadImage,
  aiActions,
  onAiRewrite,
  onError,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [linkAnchor, setLinkAnchor] = useState<HTMLElement | null>(null);
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, codeBlock: false }),
      Underline,
      Image,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  // Nội dung đổi từ ngoài (tải bài, AI viết nháp) → nạp lại; đang gõ thì giá trị trùng nên không nạp.
  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== (editor.isEmpty ? '' : editor.getHTML())) {
      editor.commands.setContent(value || '', false);
    }
  }, [editor, value]);

  const handleImage = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !editor || !onUploadImage) return;
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        onError?.('Ảnh phải là JPEG, PNG, WebP hoặc GIF');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        onError?.('Ảnh tối đa 5 MB');
        return;
      }
      setUploading(true);
      try {
        const url = await onUploadImage(file);
        editor
          .chain()
          .focus()
          .setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, '') })
          .run();
      } catch {
        onError?.('Tải ảnh lên thất bại');
      } finally {
        setUploading(false);
      }
    },
    [editor, onUploadImage, onError]
  );

  const applyLink = () => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: /^(https?:|mailto:|tel:|\/)/.test(url) ? url : `https://${url}` })
        .run();
    setLinkAnchor(null);
  };

  const runAi = async (action: string) => {
    if (!editor || !onAiRewrite) return;
    const { from, to } = editor.state.selection;
    setAiBusy(action);
    try {
      const html = await onAiRewrite(selectionHtml(editor), action);
      editor.chain().focus().insertContentAt({ from, to }, html).run();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'AI chưa sửa được đoạn này');
    } finally {
      setAiBusy(null);
    }
  };

  if (!editor)
    return <Box sx={{ minHeight: 420, borderRadius: 1, bgcolor: 'background.neutral' }} />;

  const heading = [2, 3, 4].find((level) => editor.isActive('heading', { level }));

  return (
    <Box>
      <Paper
        variant="outlined"
        sx={(theme) => ({
          overflow: 'hidden',
          borderColor: error ? 'error.main' : 'divider',
          ...(fullScreen && {
            inset: 16,
            zIndex: theme.zIndex.modal,
            position: 'fixed',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: theme.customShadows.z24,
          }),
        })}
      >
        {/* Thanh công cụ */}
        <Stack
          direction="row"
          flexWrap="wrap"
          alignItems="center"
          gap={0.5}
          sx={{ p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.neutral' }}
        >
          <Stack direction="row" sx={{ mr: 0.5 }}>
            {[
              { label: 'Đoạn', level: 0 },
              { label: 'H2', level: 2 },
              { label: 'H3', level: 3 },
            ].map((h) => {
              const active = h.level ? heading === h.level : !heading;
              return (
                <ButtonBase
                  key={h.label}
                  onClick={() =>
                    h.level
                      ? editor
                          .chain()
                          .focus()
                          .toggleHeading({ level: h.level as 2 | 3 })
                          .run()
                      : editor.chain().focus().setParagraph().run()
                  }
                  sx={{
                    px: 1,
                    height: 32,
                    borderRadius: 0.75,
                    typography: 'subtitle2',
                    color: active ? 'primary.main' : 'text.secondary',
                    bgcolor: active ? 'action.selected' : 'transparent',
                  }}
                >
                  {h.label}
                </ButtonBase>
              );
            })}
          </Stack>
          <Divider orientation="vertical" flexItem />
          <ToolButton
            title="Đậm"
            icon="solar:text-bold-bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolButton
            title="Nghiêng"
            icon="solar:text-italic-bold"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolButton
            title="Gạch chân"
            icon="solar:text-underline-bold"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <ToolButton
            title="Gạch ngang"
            icon="solar:text-cross-bold"
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <Divider orientation="vertical" flexItem />
          <ToolButton
            title="Danh sách chấm"
            icon="solar:list-bold"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolButton
            title="Danh sách số"
            icon="solar:list-arrow-down-minimalistic-bold"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolButton
            title="Trích dẫn"
            icon="solar:quote-down-bold"
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <Divider orientation="vertical" flexItem />
          <ToolButton
            title="Căn trái"
            icon="solar:align-left-bold"
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          />
          <ToolButton
            title="Căn giữa"
            icon="solar:align-horizontal-center-bold"
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          />
          <ToolButton
            title="Căn phải"
            icon="solar:align-right-bold"
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          />
          <Divider orientation="vertical" flexItem />
          <ToolButton
            title="Chèn link"
            icon="solar:link-bold"
            active={editor.isActive('link')}
            onClick={() => {
              setLinkUrl(editor.getAttributes('link').href ?? '');
              setLinkAnchor(
                document.activeElement instanceof HTMLElement ? document.activeElement : null
              );
            }}
          />
          {onUploadImage && (
            <ToolButton
              title={uploading ? 'Đang tải ảnh…' : 'Chèn ảnh'}
              icon="solar:gallery-add-bold"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            />
          )}
          <ToolButton
            title="Đường kẻ ngang"
            icon="solar:minus-square-bold"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
          <Box sx={{ flexGrow: 1 }} />
          <ToolButton
            title="Hoàn tác"
            icon="solar:undo-left-bold"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolButton
            title="Làm lại"
            icon="solar:undo-right-bold"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          />
          <ToolButton
            title={fullScreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            icon={
              fullScreen ? 'solar:quit-full-screen-square-bold' : 'solar:full-screen-square-bold'
            }
            onClick={() => setFullScreen((v) => !v)}
          />
        </Stack>

        <Box
          sx={(theme) => ({
            px: 3,
            py: 2.5,
            minHeight: 420,
            overflowY: 'auto',
            ...(fullScreen ? { flex: 1 } : { maxHeight: 720 }),
            '& .ProseMirror': {
              outline: 'none',
              minHeight: 380,
              ...newsContentSx(theme),
              '& p.is-editor-empty:first-of-type::before': {
                content: 'attr(data-placeholder)',
                float: 'left',
                height: 0,
                pointerEvents: 'none',
                color: 'text.disabled',
              },
              '& img.ProseMirror-selectednode': {
                outline: `3px solid ${theme.palette.primary.main}`,
              },
            },
          })}
        >
          <EditorContent editor={editor} />
        </Box>
      </Paper>

      {helperText && (
        <FormHelperText error={error} sx={{ px: 2 }}>
          {helperText}
        </FormHelperText>
      )}

      <input
        ref={fileRef}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleImage}
      />

      {/* Menu AI nổi trên vùng chữ đang bôi đen */}
      {aiActions?.length && onAiRewrite ? (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 120, maxWidth: 'none', placement: 'top-start' }}
          shouldShow={({ editor: e, state }) => !state.selection.empty && !e.isActive('image')}
        >
          <Paper
            elevation={8}
            sx={{
              p: 0.75,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexWrap: 'wrap',
              maxWidth: 560,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                px: 1,
                color: 'primary.main',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <Iconify icon="solar:magic-stick-3-bold" width={16} /> AI
            </Typography>
            {aiActions.map((a) => (
              <Button
                key={a.key}
                size="small"
                color="inherit"
                disabled={!!aiBusy}
                onClick={() => runAi(a.key)}
                startIcon={
                  aiBusy === a.key ? (
                    <CircularProgress size={14} />
                  ) : (
                    <Iconify icon={a.icon} width={16} />
                  )
                }
                sx={{ px: 1, minWidth: 0 }}
              >
                {a.label}
              </Button>
            ))}
          </Paper>
        </BubbleMenu>
      ) : null}

      <Popover
        open={!!linkAnchor}
        anchorEl={linkAnchor}
        onClose={() => setLinkAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack direction="row" spacing={1} sx={{ p: 2, width: 360 }}>
          <TextField
            autoFocus
            size="small"
            fullWidth
            label="Đường dẫn"
            placeholder="https://… hoặc /product/…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
            }}
          />
          <Button variant="contained" onClick={applyLink}>
            {linkUrl.trim() ? 'Gắn' : 'Bỏ link'}
          </Button>
        </Stack>
      </Popover>
    </Box>
  );
}
