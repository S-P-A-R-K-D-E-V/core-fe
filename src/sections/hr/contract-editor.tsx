'use client';

import type { Editor } from '@tiptap/react';
import type { EditorView } from '@tiptap/pm/view';

import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import TableCell from '@tiptap/extension-table-cell';
import TextAlign from '@tiptap/extension-text-align';
import { useEditor, EditorContent } from '@tiptap/react';
import TableHeader from '@tiptap/extension-table-header';
import { Node, nodePasteRule, nodeInputRule, mergeAttributes } from '@tiptap/core';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import Iconify from 'src/components/iconify';

import type { IContractField, IContractCustomField } from 'src/types/hr';

import { CONTRACT_CSS } from './contract-render';
import {
  fieldToken,
  fieldChipText,
  customFieldKey,
  FIELD_DRAG_TYPE,
  CUSTOM_FIELD_KEY,
  DATE_FORMAT_LABEL,
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

type ChipResolver = (key: string, format?: string | null) => { text: string; unknown: boolean };

/** Bấm thẻ trường (trình soạn mở menu định dạng nếu là trường ngày). */
type ChipClick = (args: { key: string; format: string | null; pos: number; anchor: HTMLElement }) => void;

function paintFieldChip(dom: HTMLElement, key: string, format: string | null | undefined, resolve: ChipResolver) {
  const { text, unknown } = resolve(key, format);
  dom.textContent = text;
  dom.title = fieldToken(key, format);
  dom.classList.toggle('merge-field--unknown', unknown);
}

/**
 * Trường trộn: thẻ nội dòng, không gõ được bên trong, kéo được để chuyển chỗ. Trường ngày có thêm định dạng (`format`:
 * ngay / thang / nam / nam2 / chu) — lưu ra `{{ma:dinh_dang}}`.
 */
export const MergeField = Node.create<{ resolve: ChipResolver; onChipClick?: ChipClick }>({
  name: 'mergeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { resolve: (key: string, format?: string | null) => ({ text: fieldToken(key, format), unknown: false }) };
  },

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-field'),
        renderHTML: (attributes) => ({ 'data-field': attributes.key }),
      },
      format: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-format') || null,
        renderHTML: (attributes) => (attributes.format ? { 'data-format': attributes.format } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-field]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'merge-field' }), fieldToken(node.attrs.key, node.attrs.format)];
  },

  renderText({ node }) {
    return fieldToken(node.attrs.key, node.attrs.format);
  },

  addNodeView() {
    const { resolve, onChipClick } = this.options;
    return ({ node, getPos }) => {
      const dom = document.createElement('span');
      dom.className = 'merge-field';
      dom.dataset.field = node.attrs.key;
      if (node.attrs.format) dom.dataset.format = node.attrs.format;
      dom.contentEditable = 'false';
      paintFieldChip(dom, node.attrs.key, node.attrs.format, resolve);
      if (onChipClick)
        dom.addEventListener('click', () => {
          const pos = typeof getPos === 'function' ? getPos() : undefined;
          if (typeof pos === 'number') onChipClick({ key: node.attrs.key, format: node.attrs.format, pos, anchor: dom });
        });
      return { dom };
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /\{\{([a-z0-9_]+)(?::([a-z0-9_]+))?\}\}$/,
        type: this.type,
        getAttributes: (m) => ({ key: m[1], format: m[2] ?? null }),
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: /\{\{([a-z0-9_]+)(?::([a-z0-9_]+))?\}\}/g,
        type: this.type,
        getAttributes: (m) => ({ key: m[1], format: m[2] ?? null }),
      }),
    ];
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

/** Một dòng trường trong bảng trường: kéo thả vào nội dung hoặc bấm để chèn ở con trỏ. */
function FieldRow({
  fieldKey,
  label,
  required,
  disabled,
  onInsert,
  action,
}: {
  fieldKey: string;
  label: string;
  required: boolean;
  disabled?: boolean;
  onInsert: () => void;
  action?: ReactNode;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <ButtonBase
        disabled={disabled}
        draggable={!disabled}
        onDragStart={(e) => {
          e.dataTransfer.setData(FIELD_DRAG_TYPE, fieldKey);
          e.dataTransfer.setData('text/plain', fieldToken(fieldKey));
          e.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={onInsert}
        aria-label={`Chèn trường ${label}`}
        sx={{
          flex: 1,
          minWidth: 0,
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
            {fieldKey.startsWith('chu_ky_') ? `✍ ${label}` : label}
            {required && (
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
            {fieldToken(fieldKey)}
          </Typography>
        </Box>
      </ButtonBase>
      {action}
    </Stack>
  );
}

type CustomDraft = IContractCustomField & { index: number | null; keyTouched: boolean };

/** Thêm / sửa một trường riêng của mẫu: nhãn → mã tự sinh `rieng_…` (sửa được), bắt buộc, giá trị mặc định. */
function CustomFieldDialog({
  draft,
  takenKeys,
  onClose,
  onSave,
}: {
  draft: CustomDraft | null;
  takenKeys: string[];
  onClose: () => void;
  onSave: (field: IContractCustomField, index: number | null) => void;
}) {
  const [value, setValue] = useState<CustomDraft | null>(draft);

  useEffect(() => setValue(draft), [draft]);

  if (!value) return null;
  const others = takenKeys.filter((k) => value.index === null || k !== draft?.key);
  const keyProblem = !CUSTOM_FIELD_KEY.test(value.key)
    ? 'Mã dạng rieng_ + chữ thường không dấu, số, gạch dưới (tối đa 40 ký tự)'
    : others.includes(value.key)
      ? 'Mã đã có'
      : null;
  const hasLabel = !!value.label.trim();

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{value.index === null ? 'Thêm trường riêng' : 'Sửa trường riêng'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Nhãn"
            value={value.label}
            autoFocus
            placeholder="Vd: Mã số thuế"
            onChange={(e) => {
              const label = e.target.value;
              setValue({ ...value, label, key: value.keyTouched ? value.key : customFieldKey(label, others) });
            }}
          />
          <TextField
            label="Mã"
            value={value.key}
            error={!!keyProblem && hasLabel}
            helperText={hasLabel ? keyProblem ?? `Dùng trong nội dung: ${fieldToken(value.key)}` : ' '}
            onChange={(e) => setValue({ ...value, key: e.target.value.trim().toLowerCase(), keyTouched: true })}
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />
          <FormControlLabel
            control={<Switch checked={value.required} onChange={(e) => setValue({ ...value, required: e.target.checked })} />}
            label="Bắt buộc nhập khi soạn hợp đồng"
          />
          <TextField
            label="Giá trị mặc định"
            value={value.defaultValue ?? ''}
            placeholder="Dùng cho mọi hợp đồng soạn từ mẫu"
            onChange={(e) => setValue({ ...value, defaultValue: e.target.value })}
            multiline
            maxRows={3}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
        <Button
          variant="contained"
          disabled={!hasLabel || !!keyProblem}
          onClick={() =>
            onSave(
              {
                key: value.key,
                label: value.label.trim(),
                required: value.required,
                defaultValue: value.defaultValue?.trim() ? value.defaultValue.trim() : null,
              },
              value.index
            )
          }
        >
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  /** Trường trộn để kéo thả / bấm chèn; không truyền = không có bảng trường (sửa nội dung một hợp đồng). */
  fields?: IContractField[];
  /** Chỉ để hiện tên tiếng Việt trên thẻ trường khi không có bảng trường (sửa nội dung một hợp đồng). */
  labelFields?: IContractField[];
  /** Trường riêng của mẫu: hiện trong bảng trường (thêm / sửa / xoá khi có onCustomFieldsChange). */
  customFields?: IContractCustomField[];
  onCustomFieldsChange?: (fields: IContractCustomField[]) => void;
  disabled?: boolean;
  minHeight?: number;
};

type FormatMenu = { key: string; format: string | null; pos: number; anchor: HTMLElement };

const DEFAULT_DATE_FORMATS = Object.entries(DATE_FORMAT_LABEL).map(([code, label]) => ({ code, label }));

export function ContractEditor({
  value,
  onChange,
  fields,
  labelFields,
  customFields,
  onCustomFieldsChange,
  disabled,
  minHeight = 480,
}: Props) {
  const labelsRef = useRef(new Map<string, string>());
  // Trường ngày → các định dạng chọn được (bấm thẻ trường ngày trong nội dung mở menu).
  const dateFormatsRef = useRef(new Map<string, { code: string; label: string }[]>());
  const disabledRef = useRef(!!disabled);
  const [formatMenu, setFormatMenu] = useState<FormatMenu | null>(null);
  const [customDraft, setCustomDraft] = useState<CustomDraft | null>(null);

  disabledRef.current = !!disabled;
  const resolve = useCallback<ChipResolver>((key, format) => fieldChipText(key, labelsRef.current, format), []);
  const onChipClick = useCallback<ChipClick>((args) => {
    if (!disabledRef.current && dateFormatsRef.current.has(args.key)) setFormatMenu(args);
  }, []);

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
      MergeField.configure({ resolve, onChipClick }),
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

  // Danh sách trường (cả trường riêng) về sau khi trình soạn đã dựng: ghi lại tên trên các thẻ đang hiện.
  const known = fields ?? labelFields;
  useEffect(() => {
    labelsRef.current = new Map([
      ...(known ?? []).map((f) => [f.key, f.label] as [string, string]),
      ...(customFields ?? []).map((f) => [f.key, f.label] as [string, string]),
    ]);
    dateFormatsRef.current = new Map(
      (known ?? []).filter((f) => f.isDate).map((f) => [f.key, f.formats?.length ? f.formats : DEFAULT_DATE_FORMATS])
    );
    if (!editor || editor.isDestroyed) return;
    editor.view.dom.querySelectorAll<HTMLElement>('span.merge-field[data-field]').forEach((el) => {
      paintFieldChip(el, el.dataset.field ?? '', el.dataset.format ?? null, resolve);
    });
  }, [editor, known, customFields, resolve]);

  const insertField = (key: string) => {
    if (!editor || disabled) return;
    editor.chain().focus().insertContent({ type: 'mergeField', attrs: { key } }).run();
  };

  /** Đổi định dạng của thẻ trường ngày vừa bấm (null = dd/MM/yyyy). */
  const setFormat = (format: string | null) => {
    if (!editor || !formatMenu) return;
    const { pos, key } = formatMenu;
    setFormatMenu(null);
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(pos);
        if (!node || node.type.name !== 'mergeField' || node.attrs.key !== key) return false;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, format });
        return true;
      })
      .run();
  };

  const saveCustom = (field: IContractCustomField, index: number | null) => {
    const list = [...(customFields ?? [])];
    if (index === null) list.push(field);
    else list[index] = field;
    onCustomFieldsChange?.(list);
    setCustomDraft(null);
  };

  const removeCustom = (index: number) => onCustomFieldsChange?.((customFields ?? []).filter((_, i) => i !== index));

  const canEditCustom = !!onCustomFieldsChange && !disabled;
  const showCustom = !!onCustomFieldsChange || (customFields?.length ?? 0) > 0;
  const formatOptions = formatMenu ? (dateFormatsRef.current.get(formatMenu.key) ?? []) : [];

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
        <Stack spacing={1} sx={{ width: { md: 280 }, flexShrink: 0 }}>
          <Typography variant="subtitle2">Trường thông tin</Typography>
          <Typography variant="caption" color="text.secondary">
            Kéo trường thả vào chỗ cần điền, hoặc đặt con trỏ rồi bấm trường. Bấm thẻ trường ngày trong nội dung để chọn
            định dạng (ngày / tháng / năm riêng). Trường bắt buộc (*) còn trống thì không chốt được hợp đồng.
          </Typography>
          <Stack spacing={0.5} sx={{ maxHeight: '60vh', overflow: 'auto', pr: 0.5 }}>
            {showCustom && (
              <>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 0.5 }}>
                  <Typography variant="overline" color="text.secondary">
                    Trường riêng của mẫu
                  </Typography>
                  {canEditCustom && (
                    <Button
                      size="small"
                      startIcon={<Iconify icon="mingcute:add-line" width={16} />}
                      onClick={() =>
                        setCustomDraft({ key: '', label: '', required: true, defaultValue: null, index: null, keyTouched: false })
                      }
                    >
                      Thêm
                    </Button>
                  )}
                </Stack>
                {(customFields?.length ?? 0) === 0 && (
                  <Typography variant="caption" color="text.disabled" sx={{ px: 0.5 }}>
                    Chưa có — thêm cho thông tin riêng của mẫu (mã số thuế, người đại diện…); nhập khi soạn hợp đồng.
                  </Typography>
                )}
                {(customFields ?? []).map((f, index) => (
                  <FieldRow
                    key={f.key}
                    fieldKey={f.key}
                    label={f.label}
                    required={f.required}
                    disabled={disabled}
                    onInsert={() => insertField(f.key)}
                    action={
                      canEditCustom && (
                        <Stack>
                          <IconButton
                            size="small"
                            aria-label={`Sửa trường ${f.label}`}
                            onClick={() => setCustomDraft({ ...f, index, keyTouched: true })}
                          >
                            <Iconify icon="solar:pen-bold" width={16} />
                          </IconButton>
                          <IconButton size="small" aria-label={`Xoá trường ${f.label}`} onClick={() => removeCustom(index)}>
                            <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                          </IconButton>
                        </Stack>
                      )
                    }
                  />
                ))}
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="overline" color="text.secondary">
                  Trường hệ thống
                </Typography>
              </>
            )}
            {fields.map((f) => (
              <FieldRow
                key={f.key}
                fieldKey={f.key}
                label={f.label}
                required={f.required}
                disabled={disabled}
                onInsert={() => insertField(f.key)}
              />
            ))}
          </Stack>
        </Stack>
      )}

      <Menu open={!!formatMenu} anchorEl={formatMenu?.anchor} onClose={() => setFormatMenu(null)}>
        <MenuItem selected={!formatMenu?.format} onClick={() => setFormat(null)}>
          Đầy đủ (dd/MM/yyyy)
        </MenuItem>
        {formatOptions.map((o) => (
          <MenuItem key={o.code} selected={formatMenu?.format === o.code} onClick={() => setFormat(o.code)}>
            {o.label}
          </MenuItem>
        ))}
      </Menu>

      <CustomFieldDialog
        draft={customDraft}
        takenKeys={(customFields ?? []).map((f) => f.key)}
        onClose={() => setCustomDraft(null)}
        onSave={saveCustom}
      />
    </Stack>
  );
}
