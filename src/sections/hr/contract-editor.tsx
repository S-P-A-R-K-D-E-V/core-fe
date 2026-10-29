'use client';

import type { Editor } from '@tiptap/react';
import type { EditorView } from '@tiptap/pm/view';

import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import { useRef, useEffect, useCallback } from 'react';
import TableCell from '@tiptap/extension-table-cell';
import TextAlign from '@tiptap/extension-text-align';
import { useEditor, EditorContent } from '@tiptap/react';
import TableHeader from '@tiptap/extension-table-header';
import { Node, nodePasteRule, nodeInputRule, mergeAttributes } from '@tiptap/core';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';

import type { IContractField } from 'src/types/hr';

import { CONTRACT_CSS } from './contract-render';
import {
  fieldToken,
  fieldChipText,
  FIELD_DRAG_TYPE,
  tokensToFieldNodes,
  fieldNodesToTokens,
} from './contract-fields-html';

// ----------------------------------------------------------------------
// Trình soạn nội dung hợp đồng (tiptap): đoạn, tiêu đề, đậm / nghiêng / gạch chân, căn lề, danh sách, bảng, ngắt trang.
// Trường trộn là thẻ (node `mergeField`) hiện tên tiếng Việt — kéo trường thả vào chỗ cần điền, hoặc bấm để chèn ở con
// trỏ; gõ / dán `{{ma}}` cũng thành thẻ. Lưu ra vẫn là chữ `{{ma}}` (contract-fields-html).
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

type ChipResolver = (key: string) => { text: string; unknown: boolean };

function paintFieldChip(dom: HTMLElement, key: string, resolve: ChipResolver) {
  const { text, unknown } = resolve(key);
  dom.textContent = text;
  dom.title = fieldToken(key);
  dom.classList.toggle('merge-field--unknown', unknown);
}

/** Trường trộn: thẻ nội dòng, không gõ được bên trong, kéo được để chuyển chỗ. */
export const MergeField = Node.create<{ resolve: ChipResolver }>({
  name: 'mergeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { resolve: (key: string) => ({ text: key, unknown: false }) };
  },

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-field'),
        renderHTML: (attributes) => ({ 'data-field': attributes.key }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-field]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'merge-field' }), fieldToken(node.attrs.key)];
  },

  renderText({ node }) {
    return fieldToken(node.attrs.key);
  },

  addNodeView() {
    const { resolve } = this.options;
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'merge-field';
      dom.dataset.field = node.attrs.key;
      dom.contentEditable = 'false';
      paintFieldChip(dom, node.attrs.key, resolve);
      return { dom };
    };
  },

  addInputRules() {
    return [nodeInputRule({ find: /\{\{([a-z0-9_]+)\}\}$/, type: this.type, getAttributes: (m) => ({ key: m[1] }) })];
  },

  addPasteRules() {
    return [nodePasteRule({ find: /\{\{([a-z0-9_]+)\}\}/g, type: this.type, getAttributes: (m) => ({ key: m[1] }) })];
  },
});

/**
 * Thả trường kéo từ danh sách vào nội dung: chèn thẻ đúng chỗ thả. Kéo thứ khác (chữ, thẻ đã có trong bài) để tiptap tự xử
 * lý như thường.
 */
export function handleFieldDrop(view: EditorView, event: DragEvent): boolean {
  const key = event.dataTransfer?.getData(FIELD_DRAG_TYPE);
  const type = view.state.schema.nodes.mergeField;
  if (!key || !type) return false;
  const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!at) return false;
  event.preventDefault();
  view.dispatch(view.state.tr.insert(at.pos, type.create({ key })).scrollIntoView());
  view.focus();
  return true;
}

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
  /** Chỉ để hiện tên tiếng Việt trên thẻ trường khi không có bảng trường (sửa nội dung một hợp đồng). */
  labelFields?: IContractField[];
  disabled?: boolean;
  minHeight?: number;
};

export function ContractEditor({ value, onChange, fields, labelFields, disabled, minHeight = 480 }: Props) {
  const labelsRef = useRef(new Map<string, string>());
  const resolve = useCallback<ChipResolver>((key) => fieldChipText(key, labelsRef.current), []);

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
      MergeField.configure({ resolve }),
    ],
    content: tokensToFieldNodes(value),
    editable: !disabled,
    immediatelyRender: false,
    editorProps: { handleDrop: (view, event) => handleFieldDrop(view, event) },
    onUpdate: ({ editor: e }) => onChange(fieldNodesToTokens(e.getHTML())),
  });

  // Nội dung đổi từ ngoài (tải mẫu lên, mở bản khác) → nạp lại; đang gõ thì giá trị trùng nên không nạp.
  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== fieldNodesToTokens(editor.getHTML()))
      editor.commands.setContent(tokensToFieldNodes(value || ''), false);
  }, [editor, value]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!disabled);
  }, [editor, disabled]);

  // Danh sách trường về sau khi trình soạn đã dựng: ghi lại tên trên các thẻ đang hiện.
  const known = fields ?? labelFields;
  useEffect(() => {
    labelsRef.current = new Map((known ?? []).map((f) => [f.key, f.label]));
    if (!editor || editor.isDestroyed) return;
    editor.view.dom.querySelectorAll<HTMLElement>('span.merge-field[data-field]').forEach((el) => {
      paintFieldChip(el, el.dataset.field ?? '', resolve);
    });
  }, [editor, known, resolve]);

  const insertField = (key: string) => {
    if (!editor || disabled) return;
    editor.chain().focus().insertContent({ type: 'mergeField', attrs: { key } }).run();
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
            '& .ProseMirror .merge-field': {
              display: 'inline-block',
              px: 0.75,
              mx: '1px',
              borderRadius: 0.75,
              border: '1px solid rgba(0, 120, 255, 0.35)',
              bgcolor: 'rgba(0, 120, 255, 0.08)',
              color: '#0b4fa8',
              fontFamily: 'sans-serif',
              fontSize: '0.85em',
              lineHeight: 1.6,
              whiteSpace: 'nowrap',
              cursor: disabled ? 'default' : 'grab',
              userSelect: 'none',
            },
            '& .ProseMirror .merge-field--unknown': {
              color: 'error.main',
              borderColor: 'error.main',
              bgcolor: 'rgba(255, 86, 48, 0.08)',
            },
            '& .ProseMirror .merge-field.ProseMirror-selectednode': { outline: '2px solid', outlineColor: 'primary.main' },
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
          <Stack spacing={0.5} sx={{ maxHeight: '60vh', overflow: 'auto', pr: 0.5 }}>
            {fields.map((f) => (
              <ButtonBase
                key={f.key}
                disabled={disabled}
                draggable={!disabled}
                onDragStart={(e) => {
                  e.dataTransfer.setData(FIELD_DRAG_TYPE, f.key);
                  e.dataTransfer.setData('text/plain', fieldToken(f.key));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => insertField(f.key)}
                aria-label={`Chèn trường ${f.label}`}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  gap: 1,
                  px: 1,
                  py: 0.75,
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                  cursor: disabled ? 'default' : 'grab',
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.light' },
                  '&.Mui-disabled': { opacity: 0.5 },
                }}
              >
                <Iconify icon="mdi:drag" width={18} sx={{ color: 'text.disabled', flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                    {f.key.startsWith('chu_ky_') ? `✍ ${f.label}` : f.label}
                    {f.required && (
                      <Box component="span" sx={{ color: 'error.main' }}>
                        {' *'}
                      </Box>
                    )}
                  </Typography>
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{ color: 'text.disabled', fontFamily: 'monospace', wordBreak: 'break-all' }}
                  >
                    {fieldToken(f.key)}
                  </Typography>
                </Box>
              </ButtonBase>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
