'use client';

import type { Editor } from '@tiptap/react';

import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import Underline from '@tiptap/extension-underline';
import TableCell from '@tiptap/extension-table-cell';
import TextAlign from '@tiptap/extension-text-align';
import { useEditor, EditorContent } from '@tiptap/react';
import TableHeader from '@tiptap/extension-table-header';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { MergeField, handleFieldDrop } from 'src/sections/hr/contract-editor';
import {
  fieldToken,
  FIELD_DRAG_TYPE,
  tokensToFieldNodes,
  fieldNodesToTokens,
} from 'src/sections/hr/contract-fields-html';

import Iconify from 'src/components/iconify';

import { FontSize, FONT_SIZE_CHOICES } from './font-size-mark';
import { receiptTemplateContentCss } from './receipt-template-render';
import { RECEIPT_TEMPLATE_PAPERS } from './receipt-template-settings';
import {
  RECEIPT_FIELDS,
  isItemField,
  isPaymentField,
  RECEIPT_FIELD_GROUPS,
} from './receipt-template-fields';

import type { ReceiptTemplateSettings } from './receipt-template-settings';

// ----------------------------------------------------------------------
// Trình soạn mẫu hoá đơn (tiptap) trên "tờ giấy" đúng khổ và lề của mẫu: đoạn, tiêu đề, đậm / nghiêng / gạch, cỡ chữ,
// căn lề, danh sách, kẻ ngang, bảng (thêm / bớt hàng, cột). Trường là thẻ: kéo từ bảng trường thả vào chỗ cần, hoặc bấm
// để chèn ở con trỏ; gõ / dán `{{ma}}` cũng thành thẻ. Lưu ra chữ `{{ma}}` (contract-fields-html).
// Thẻ trường dòng hàng / thanh toán có dấu ⟳: khối chứa chúng được lặp theo từng món / khoản thu khi in.
// ----------------------------------------------------------------------

const PX_PER_MM = 96 / 25.4;

const LABELS = new Map(
  RECEIPT_FIELDS.map((field) => [
    field.key,
    `${isItemField(field.key) || isPaymentField(field.key) ? '⟳ ' : ''}${field.block ? '▦ ' : ''}${field.label}`,
  ])
);

const resolveChip = (key: string) => ({ text: LABELS.get(key) ?? key, unknown: !LABELS.has(key) });

const cell = (inner: string, tag: 'td' | 'th' = 'td', attrs = '') =>
  `<${tag}${attrs}><p>${inner}</p></${tag}>`;
const rightCell = (inner: string) => `<td><p style="text-align: right">${inner}</p></td>`;

/** Khối dựng sẵn để chèn nhanh (đã là `{{ma}}`; tokensToFieldNodes đổi thành thẻ). */
const PRESETS: { key: string; label: string; html: string }[] = [
  {
    key: 'items-table',
    label: 'Bảng hàng hoá 4 cột (giấy rộng)',
    html:
      `<table><tbody><tr>${cell('Tên hàng', 'th')}${cell('SL', 'th')}${cell('Đơn giá', 'th')}${cell('T.Tiền', 'th')}</tr>` +
      `<tr>${cell('{{item_name}}')}${cell('{{item_quantity}}')}${rightCell('{{item_price}}')}${rightCell('{{item_total}}')}</tr></tbody></table>`,
  },
  {
    key: 'items-two-lines',
    label: 'Hàng hoá 2 dòng (giấy cuộn hẹp)',
    html:
      `<table><tbody><tr>${cell('<strong>{{item_name}}</strong>', 'td', ' colspan="2"')}</tr>` +
      `<tr>${cell('{{item_quantity}} × {{item_price}}')}${rightCell('{{item_total}}')}</tr></tbody></table>`,
  },
  {
    key: 'totals',
    label: 'Bảng tổng tiền',
    html:
      `<table><tbody><tr>${cell('Tổng tiền hàng')}${rightCell('{{subtotal}}')}</tr>` +
      `<tr>${cell('Giảm giá')}${rightCell('{{discount_total}}')}</tr>` +
      `<tr>${cell('<strong>Khách cần trả</strong>')}${rightCell('<strong>{{total}}</strong>')}</tr>` +
      `<tr>${cell('Khách đã trả')}${rightCell('{{paid}}')}</tr>` +
      `<tr>${cell('Tiền thừa trả khách')}${rightCell('{{change_due}}')}</tr>` +
      `<tr>${cell('<strong>Còn phải trả</strong>')}${rightCell('<strong>{{remaining}}</strong>')}</tr></tbody></table>`,
  },
  {
    key: 'payments',
    label: 'Các khoản thu',
    html: `<table><tbody><tr>${cell('{{payment_method}}')}${rightCell('{{payment_amount}}')}</tr></tbody></table>`,
  },
  {
    key: 'transfer',
    label: 'Khối chuyển khoản (mã QR)',
    html:
      '<p style="text-align: center"><strong>Quét mã để chuyển khoản</strong><br>{{transfer_qr}}</p>' +
      '<p style="text-align: center">{{transfer_bank}} - STK: <strong>{{transfer_account_number}}</strong></p>' +
      '<p style="text-align: center">Nội dung: {{transfer_content}}</p>',
  },
];

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
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
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
            minWidth: 30,
            height: 30,
            px: label ? 0.75 : 0,
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
  const [presetAnchor, setPresetAnchor] = useState<HTMLElement | null>(null);
  const run = () => editor.chain().focus();
  const inTable = editor.isActive('table');
  const fontSize = (editor.getAttributes('fontSize').size as string | undefined) ?? '';

  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      alignItems="center"
      gap={0.5}
      sx={{ p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.neutral' }}
    >
      <ToolButton
        title="Đoạn văn"
        label="Đoạn"
        active={editor.isActive('paragraph')}
        onClick={() => run().setParagraph().run()}
      />
      {([1, 2, 3] as const).map((level) => (
        <ToolButton
          key={level}
          title={`Tiêu đề cấp ${level}`}
          label={`H${level}`}
          active={editor.isActive('heading', { level })}
          onClick={() => run().toggleHeading({ level }).run()}
        />
      ))}
      <Select
        size="small"
        value={fontSize}
        displayEmpty
        onChange={(event) => {
          const size = event.target.value as string;
          if (size) run().setFontSize(size).run();
          else run().unsetFontSize().run();
        }}
        inputProps={{ 'aria-label': 'Cỡ chữ' }}
        sx={{ height: 30, minWidth: 92, typography: 'body2', bgcolor: 'background.paper' }}
      >
        <MenuItem value="">Cỡ chữ</MenuItem>
        {FONT_SIZE_CHOICES.map((size) => (
          <MenuItem key={size} value={size}>
            {size.replace('pt', ' pt')}
          </MenuItem>
        ))}
      </Select>
      <Divider orientation="vertical" flexItem />
      <ToolButton
        title="Đậm"
        icon="solar:text-bold-bold"
        active={editor.isActive('bold')}
        onClick={() => run().toggleBold().run()}
      />
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
      <ToolButton
        title="Gạch ngang chữ"
        icon="solar:text-cross-bold"
        active={editor.isActive('strike')}
        onClick={() => run().toggleStrike().run()}
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
      <ToolButton title="Kẻ ngang" label="—" onClick={() => run().setHorizontalRule().run()} />
      <Divider orientation="vertical" flexItem />
      <ToolButton
        title="Chèn bảng 2 cột"
        icon="mingcute:table-2-line"
        onClick={() => run().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()}
      />
      <ToolButton
        title="Thêm hàng"
        label="+Hàng"
        disabled={!inTable}
        onClick={() => run().addRowAfter().run()}
      />
      <ToolButton
        title="Thêm cột"
        label="+Cột"
        disabled={!inTable}
        onClick={() => run().addColumnAfter().run()}
      />
      <ToolButton
        title="Xoá hàng"
        label="−Hàng"
        disabled={!inTable}
        onClick={() => run().deleteRow().run()}
      />
      <ToolButton
        title="Xoá cột"
        label="−Cột"
        disabled={!inTable}
        onClick={() => run().deleteColumn().run()}
      />
      <ToolButton
        title="Gộp / tách ô"
        label="Gộp ô"
        disabled={!inTable}
        onClick={() => run().mergeOrSplit().run()}
      />
      <ToolButton
        title="Xoá bảng"
        label="Xoá bảng"
        disabled={!inTable}
        onClick={() => run().deleteTable().run()}
      />
      <Divider orientation="vertical" flexItem />
      <ToolButton
        title="Chèn khối dựng sẵn"
        label="+ Khối"
        onClick={(event) => setPresetAnchor(event.currentTarget)}
      />
      <Menu open={!!presetAnchor} anchorEl={presetAnchor} onClose={() => setPresetAnchor(null)}>
        {PRESETS.map((preset) => (
          <MenuItem
            key={preset.key}
            onClick={() => {
              setPresetAnchor(null);
              run().insertContent(tokensToFieldNodes(preset.html)).run();
            }}
          >
            {preset.label}
          </MenuItem>
        ))}
      </Menu>
      <Divider orientation="vertical" flexItem />
      <ToolButton
        title="Hoàn tác"
        icon="solar:undo-left-bold"
        disabled={!editor.can().undo()}
        onClick={() => run().undo().run()}
      />
      <ToolButton
        title="Làm lại"
        icon="solar:undo-right-bold"
        disabled={!editor.can().redo()}
        onClick={() => run().redo().run()}
      />
    </Stack>
  );
}

/** Bảng trường: tìm, kéo thả vào tờ phiếu hoặc bấm để chèn ở con trỏ. */
function FieldPalette({
  onInsert,
  disabled,
}: {
  onInsert: (key: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  return (
    <Stack spacing={1} sx={{ minHeight: 0 }}>
      <Typography variant="subtitle2">Trường thông tin</Typography>
      <Typography variant="caption" color="text.secondary">
        Kéo trường thả vào phiếu, hoặc đặt con trỏ rồi bấm. Đoạn / hàng bảng mà mọi trường đều trống
        (vd. giảm giá = 0) tự ẩn khi in.
      </Typography>
      <TextField
        size="small"
        placeholder="Tìm trường…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" width={18} sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
      />
      <Stack
        spacing={1.5}
        sx={{ overflow: 'auto', pr: 0.5, maxHeight: { md: 'calc(100vh - 300px)' } }}
      >
        {RECEIPT_FIELD_GROUPS.map((group) => {
          const fields = RECEIPT_FIELDS.filter(
            (field) =>
              field.group === group.key &&
              (!needle || field.label.toLowerCase().includes(needle) || field.key.includes(needle))
          );
          if (fields.length === 0) return null;
          return (
            <Box key={group.key}>
              <Typography variant="overline" color="text.secondary">
                {group.label}
              </Typography>
              {group.hint && (
                <Typography
                  variant="caption"
                  component="div"
                  color="text.disabled"
                  sx={{ mb: 0.5 }}
                >
                  {group.hint}
                </Typography>
              )}
              <Stack spacing={0.5}>
                {fields.map((field) => (
                  <ButtonBase
                    key={field.key}
                    disabled={disabled}
                    draggable={!disabled}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(FIELD_DRAG_TYPE, field.key);
                      event.dataTransfer.setData('text/plain', fieldToken(field.key));
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onInsert(field.key)}
                    aria-label={`Chèn trường ${field.label}`}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      gap: 1,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      cursor: disabled ? 'default' : 'grab',
                      '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.light' },
                    }}
                  >
                    <Iconify
                      icon="mdi:drag"
                      width={16}
                      sx={{ color: 'text.disabled', flexShrink: 0 }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                        {LABELS.get(field.key)}
                      </Typography>
                      {field.hint && (
                        <Typography variant="caption" component="div" color="text.disabled">
                          {field.hint}
                        </Typography>
                      )}
                    </Box>
                  </ButtonBase>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  settings: ReceiptTemplateSettings;
  /** Phóng to tờ phiếu (1 = cỡ thật trên màn hình 96 dpi). */
  zoom: number;
  disabled?: boolean;
};

export function ReceiptTemplateEditor({ value, onChange, settings, zoom, disabled }: Props) {
  const resolve = useCallback((key: string) => resolveChip(key), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: false,
        code: false,
        blockquote: false,
      }),
      Underline,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      MergeField.configure({ resolve }),
    ],
    content: tokensToFieldNodes(value),
    editable: !disabled,
    immediatelyRender: false,
    editorProps: { handleDrop: (view, event) => handleFieldDrop(view, event) },
    onUpdate: ({ editor: e }) => onChange(fieldNodesToTokens(e.getHTML())),
  });

  // Nội dung đổi từ ngoài (đặt lại mẫu mặc định, tải mẫu khác) → nạp lại; đang gõ thì trùng nên không nạp.
  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== fieldNodesToTokens(editor.getHTML()))
      editor.commands.setContent(tokensToFieldNodes(value || ''), false);
  }, [editor, value]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const insertField = (key: string) => {
    if (!editor || disabled) return;
    editor.chain().focus().insertContent({ type: 'mergeField', attrs: { key } }).run();
  };

  const paper = RECEIPT_TEMPLATE_PAPERS[settings.paper];
  const css = useMemo(() => receiptTemplateContentCss(settings), [settings]);
  const paperWidthPx = paper.widthMm * PX_PER_MM;

  return (
    <Box
      display="grid"
      gap={2}
      gridTemplateColumns={{ xs: 'minmax(0, 1fr)', md: '260px minmax(0, 1fr)' }}
      alignItems="start"
    >
      <Paper variant="outlined" sx={{ p: 1.5, position: { md: 'sticky' }, top: { md: 80 } }}>
        <FieldPalette onInsert={insertField} disabled={disabled} />
      </Paper>

      <Paper variant="outlined" sx={{ overflow: 'hidden', minWidth: 0 }}>
        {editor && !disabled && <Toolbar editor={editor} />}
        <Box
          sx={{
            p: 3,
            bgcolor: '#dfe3e8',
            overflow: 'auto',
            maxHeight: 'calc(100vh - 260px)',
            minHeight: 420,
          }}
        >
          <style>{css}</style>
          <Box
            sx={{
              zoom,
              mx: 'auto',
              width: paperWidthPx,
              minHeight: paper.heightMm ? paper.heightMm * PX_PER_MM : 360,
              bgcolor: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              boxSizing: 'border-box',
              pt: `${settings.marginTopMm}mm`,
              pr: `${settings.marginRightMm}mm`,
              pb: `${settings.marginBottomMm}mm`,
              pl: `${settings.marginLeftMm}mm`,
              position: 'relative',
              // Viền vùng in (lề) — chỉ để soạn, không in ra.
              '&::before': {
                content: '""',
                position: 'absolute',
                pointerEvents: 'none',
                top: `${settings.marginTopMm}mm`,
                right: `${settings.marginRightMm}mm`,
                bottom: `${settings.marginBottomMm}mm`,
                left: `${settings.marginLeftMm}mm`,
                outline: '1px dashed rgba(0, 120, 255, 0.35)',
              },
              '& .ProseMirror': { outline: 'none', minHeight: 300 },
              '& .ProseMirror table td, & .ProseMirror table th': {
                position: 'relative',
                outline:
                  settings.tableBorder === 'none'
                    ? '1px dotted rgba(145, 158, 171, 0.6)'
                    : undefined,
              },
              '& .ProseMirror .selectedCell': { bgcolor: 'rgba(0, 120, 255, 0.08)' },
              '& .ProseMirror .merge-field': {
                display: 'inline-block',
                px: 0.5,
                mx: '1px',
                borderRadius: 0.75,
                border: '1px solid rgba(0, 120, 255, 0.35)',
                bgcolor: 'rgba(0, 120, 255, 0.08)',
                color: '#0b4fa8',
                fontFamily: 'sans-serif',
                fontSize: '0.85em',
                lineHeight: 1.5,
                whiteSpace: 'nowrap',
                cursor: disabled ? 'default' : 'grab',
                userSelect: 'none',
              },
              '& .ProseMirror .merge-field--unknown': {
                color: 'error.main',
                borderColor: 'error.main',
                bgcolor: 'rgba(255, 86, 48, 0.08)',
              },
              '& .ProseMirror .merge-field.ProseMirror-selectednode': {
                outline: '2px solid',
                outlineColor: 'primary.main',
              },
              '& .ProseMirror hr.ProseMirror-selectednode': {
                outline: '2px solid',
                outlineColor: 'primary.main',
              },
            }}
          >
            {editor ? (
              <EditorContent editor={editor} className="rt" />
            ) : (
              <Box sx={{ minHeight: 300, borderRadius: 1, bgcolor: 'background.neutral' }} />
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
