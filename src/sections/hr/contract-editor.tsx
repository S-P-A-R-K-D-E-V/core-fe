'use client';

import type { Editor } from '@tiptap/react';

import { useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import { Node, mergeAttributes } from '@tiptap/core';
import TableRow from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import TableCell from '@tiptap/extension-table-cell';
import TextAlign from '@tiptap/extension-text-align';
import { useEditor, EditorContent } from '@tiptap/react';
import TableHeader from '@tiptap/extension-table-header';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';

import type { IContractField } from 'src/types/hr';

import { CONTRACT_CSS } from './contract-render';

// ----------------------------------------------------------------------
// Trình soạn nội dung hợp đồng (tiptap): đoạn, tiêu đề, đậm / nghiêng / gạch chân, căn lề, danh sách, bảng, ngắt trang.
// Trường trộn {{ma}} là chữ thường trong văn bản — kéo chip trường thả vào chỗ cần điền, hoặc bấm chip để chèn ở con trỏ.
// ----------------------------------------------------------------------

/** Ngắt trang khi in: <div class="page-break"></div> (máy chủ giữ thẻ này khi lọc). */
const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div.page-break' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'page-break' })];
  },
});

export const fieldToken = (key: string) => `{{${key}}}`;

function ToolButton({
  title,
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  title: string;
  icon?: string;
  label?: string;
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
            minWidth: 32,
            height: 32,
            px: label ? 1 : 0,
            borderRadius: 0.75,
            typography: 'subtitle2',
            color: active ? 'primary.main' : 'text.secondary',
            bgcolor: active ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
            '&.Mui-disabled': { opacity: 0.4 },
          }}
        >
          {icon ? <Iconify icon={icon} width={18} /> : label}
        </ButtonBase>
      </span>
    </Tooltip>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const run = () => editor.chain().focus();
  const inTable = editor.isActive('table');
  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      alignItems="center"
      gap={0.5}
      sx={{ p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.neutral' }}
    >
      <ToolButton title="Đoạn văn" label="Đoạn" active={editor.isActive('paragraph')} onClick={() => run().setParagraph().run()} />
      <ToolButton
        title="Tiêu đề"
        label="H2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => run().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        title="Tiêu đề nhỏ"
        label="H3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => run().toggleHeading({ level: 3 }).run()}
      />
      <Divider orientation="vertical" flexItem />
      <ToolButton title="Đậm" icon="solar:text-bold-bold" active={editor.isActive('bold')} onClick={() => run().toggleBold().run()} />
      <ToolButton
        title="Nghiêng"
        icon="solar:text-italic-bold"
        active={editor.isActive('italic')}
        onClick={() => run().toggleItalic().run()}
      />
      <ToolButton
        title="Gạch chân"
        icon="solar:text-underline-bold"
        active={editor.isActive('underline')}
        onClick={() => run().toggleUnderline().run()}
      />
      <Divider orientation="vertical" flexItem />
      <ToolButton
        title="Căn trái"
        icon="solar:align-left-bold"
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => run().setTextAlign('left').run()}
      />
      <ToolButton
        title="Căn giữa"
        icon="solar:align-horizontal-center-bold"
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => run().setTextAlign('center').run()}
      />
      <ToolButton
        title="Căn phải"
        icon="solar:align-right-bold"
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => run().setTextAlign('right').run()}
      />
      <ToolButton
        title="Căn đều hai bên"
        label="≡"
        active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => run().setTextAlign('justify').run()}
      />
      <Divider orientation="vertical" flexItem />
      <ToolButton
        title="Danh sách chấm"
        icon="solar:list-bold"
        active={editor.isActive('bulletList')}
        onClick={() => run().toggleBulletList().run()}
      />
      <ToolButton
        title="Danh sách số"
        icon="solar:list-arrow-down-minimalistic-bold"
        active={editor.isActive('orderedList')}
        onClick={() => run().toggleOrderedList().run()}
      />
      <Divider orientation="vertical" flexItem />
      <ToolButton
        title="Chèn bảng"
        icon="mingcute:table-2-line"
        onClick={() => run().insertTable({ rows: 3, cols: 2, withHeaderRow: false }).run()}
      />
      <ToolButton title="Thêm hàng" label="+Hàng" disabled={!inTable} onClick={() => run().addRowAfter().run()} />
      <ToolButton title="Thêm cột" label="+Cột" disabled={!inTable} onClick={() => run().addColumnAfter().run()} />
      <ToolButton title="Xoá hàng" label="−Hàng" disabled={!inTable} onClick={() => run().deleteRow().run()} />
      <ToolButton title="Xoá cột" label="−Cột" disabled={!inTable} onClick={() => run().deleteColumn().run()} />
      <ToolButton title="Xoá bảng" label="Xoá bảng" disabled={!inTable} onClick={() => run().deleteTable().run()} />
      <Divider orientation="vertical" flexItem />
      <ToolButton title="Ngắt trang" label="Ngắt trang" onClick={() => run().insertContent({ type: 'pageBreak' }).run()} />
      <Divider orientation="vertical" flexItem />
      <ToolButton title="Hoàn tác" icon="solar:undo-left-bold" disabled={!editor.can().undo()} onClick={() => run().undo().run()} />
      <ToolButton title="Làm lại" icon="solar:undo-right-bold" disabled={!editor.can().redo()} onClick={() => run().redo().run()} />
    </Stack>
  );
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  /** Trường trộn để kéo thả / bấm chèn; không truyền = không có bảng trường (sửa nội dung một hợp đồng). */
  fields?: IContractField[];
  disabled?: boolean;
  minHeight?: number;
};

export function ContractEditor({ value, onChange, fields, disabled, minHeight = 480 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, codeBlock: false, code: false }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      PageBreak,
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Nội dung đổi từ ngoài (tải mẫu lên, mở bản khác) → nạp lại; đang gõ thì giá trị trùng nên không nạp.
  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== editor.getHTML()) editor.commands.setContent(value || '', false);
  }, [editor, value]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const insertField = (key: string) => {
    if (!editor || disabled) return;
    editor.chain().focus().insertContent(fieldToken(key)).run();
  };

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
      <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {editor && !disabled && <Toolbar editor={editor} />}
        <Box
          sx={{
            p: 2,
            minHeight,
            maxHeight: '65vh',
            overflow: 'auto',
            bgcolor: '#fff',
            '& .ProseMirror': { outline: 'none', minHeight: minHeight - 32 },
            '& .ProseMirror table td, & .ProseMirror table th': { position: 'relative' },
            '& .ProseMirror .selectedCell': { bgcolor: 'rgba(0, 120, 255, 0.08)' },
            '& .ProseMirror div.page-break': {
              my: 2,
              borderTop: '1px dashed',
              borderColor: 'text.disabled',
              position: 'relative',
              '&::after': {
                content: '"Ngắt trang"',
                position: 'absolute',
                top: -9,
                left: '50%',
                transform: 'translateX(-50%)',
                px: 1,
                fontSize: 11,
                color: 'text.disabled',
                bgcolor: '#fff',
                fontFamily: 'sans-serif',
              },
            },
          }}
        >
          <style>{CONTRACT_CSS}</style>
          {editor ? (
            <EditorContent editor={editor} className="contract-doc" />
          ) : (
            <Box sx={{ minHeight, borderRadius: 1, bgcolor: 'background.neutral' }} />
          )}
        </Box>
      </Paper>

      {fields && (
        <Stack spacing={1} sx={{ width: { md: 260 }, flexShrink: 0 }}>
          <Typography variant="subtitle2">Trường thông tin</Typography>
          <Typography variant="caption" color="text.secondary">
            Kéo trường thả vào chỗ cần điền, hoặc đặt con trỏ rồi bấm trường. Trường bắt buộc (*) còn trống thì không chốt
            được hợp đồng. Hai trường chữ ký hiện ảnh chữ ký khi nhân viên đã ký.
          </Typography>
          <Stack spacing={0.75} sx={{ maxHeight: '60vh', overflow: 'auto', pr: 0.5 }}>
            {fields.map((f) => (
              <Stack key={f.key} direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  variant="outlined"
                  label={fieldToken(f.key)}
                  disabled={disabled}
                  draggable={!disabled}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', fieldToken(f.key));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => insertField(f.key)}
                  sx={{ cursor: disabled ? 'default' : 'grab', fontFamily: 'monospace' }}
                />
                <Typography variant="caption">
                  {f.label}
                  {f.required ? ' *' : ''}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
