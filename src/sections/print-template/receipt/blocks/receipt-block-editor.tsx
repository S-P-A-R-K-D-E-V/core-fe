'use client';

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

import { useId, useRef, useState } from 'react';
import { CSS } from '@dnd-kit/utilities';
import {
  arrayMove,
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  useSensor,
  DndContext,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
} from '@dnd-kit/core';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { uploadTemplateImage } from '../../print-image-upload';
import { PURCHASE_FIELD_SET } from '../../purchase/purchase-template-fields';
import { isItemField, isPaymentField, RECEIPT_FIELD_SET } from '../receipt-template-fields';
import {
  INFO_ROWS,
  TOTAL_ROWS,
  createBlock,
  STORE_LINES,
  ITEM_COLUMNS,
  blockTypeInfo,
  duplicateBlock,
  BLOCK_STARTERS,
  TRANSFER_LINES,
  INFO_ROW_LABELS,
  TOTAL_ROW_LABELS,
  BLOCK_TYPE_ORDERS,
  RULE_STYLE_LABELS,
  STORE_LINE_LABELS,
  PURCHASE_INFO_ROWS,
  MAX_RECEIPT_BLOCKS,
  ITEM_COLUMN_LABELS,
  PURCHASE_TOTAL_ROWS,
  ITEMS_LAYOUT_LABELS,
  TRANSFER_LINE_LABELS,
  PURCHASE_INFO_ROW_LABELS,
  PURCHASE_TOTAL_ROW_LABELS,
} from './receipt-blocks';

import type { ReceiptBlock, ReceiptBlockType, BlockDocumentKind } from './receipt-blocks';

// ----------------------------------------------------------------------
// Trình soạn mẫu hoá đơn theo khối: cột trái là các loại khối (kéo thả vào danh sách hoặc bấm để thêm sau khối đang chọn),
// giữa là bố cục phiếu (kéo tay nắm để đổi thứ tự; bàn phím: Tab tới tay nắm, Space nhấc, ↑↓ dời, Space thả), phải là
// thuộc tính của khối đang chọn. Xem trước / khổ giấy nằm ở cột bên ngoài (print-template-edit-view).
// ----------------------------------------------------------------------

const NEW_PREFIX = 'new:';
const LIST_END = 'list-end';

/** Trường chèn được vào chữ tự do / tiêu đề (không gồm trường dòng hàng, khoản thu, hình). */
const textFieldsOf = (kind: BlockDocumentKind) =>
  (kind === 'purchase' ? PURCHASE_FIELD_SET : RECEIPT_FIELD_SET).fields.filter(
    (field) => !field.block && !isItemField(field.key) && !isPaymentField(field.key)
  );

type Props = {
  blocks: ReceiptBlock[];
  onChange: (blocks: ReceiptBlock[]) => void;
  /** Thay bố cục bằng mẫu khởi đầu (trang chủ đổi luôn khổ giấy). */
  onStarter: (key: string) => void;
  /** Chuyển sang soạn tự do (một chiều). */
  onFreeMode: () => void;
  /** Loại chứng từ: quyết định các khối, mẫu khởi đầu và trường chèn được. */
  kind?: BlockDocumentKind;
};

function summary(block: ReceiptBlock): string {
  const on = <K extends string>(flags: Record<K, boolean>, labels: Record<K, string>) =>
    (Object.keys(flags) as K[])
      .filter((key) => flags[key])
      .map((key) => labels[key])
      .join(' · ');
  switch (block.type) {
    case 'logo':
      return `Rộng ${block.widthPct}%`;
    case 'storeHeader':
      return on(block.lines, STORE_LINE_LABELS);
    case 'title':
    case 'text':
      return block.text;
    case 'invoiceInfo':
      return on(block.rows, INFO_ROW_LABELS);
    case 'items':
      return ITEMS_LAYOUT_LABELS[block.layout];
    case 'totals':
      return on(block.rows, TOTAL_ROW_LABELS);
    case 'payments':
      return 'Phương thức — số tiền';
    case 'transferQr':
      return block.caption;
    case 'code':
      return block.kind === 'qr' ? 'Mã QR mã hoá đơn' : 'Mã vạch mã hoá đơn';
    case 'divider':
      return RULE_STYLE_LABELS[block.style];
    case 'spacer':
      return `${block.lines} dòng`;
    case 'image':
      return block.src ? `Rộng ${block.widthPct}%` : 'Chưa chọn ảnh';
    case 'footer':
      return [block.showFooter ? 'Lời chào' : '', block.showPrintedAt ? 'In lúc …' : '']
        .filter(Boolean)
        .join(' · ');
    case 'purchaseInfo':
      return on(block.rows, PURCHASE_INFO_ROW_LABELS);
    case 'purchaseTotals':
      return on(block.rows, PURCHASE_TOTAL_ROW_LABELS);
    case 'signatures':
      return [block.left, block.right].filter((side) => side.trim()).join(' · ');
    default:
      return '';
  }
}

// ── Cột trái: loại khối ──────────────────────────────────────────────────

function PaletteItem({
  type,
  kind,
  onAdd,
}: {
  type: ReceiptBlockType;
  kind: BlockDocumentKind;
  onAdd: (type: ReceiptBlockType) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `${NEW_PREFIX}${type}` });
  const info = blockTypeInfo(type, kind);
  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={`Thêm khối ${info.label}`}
      onClick={() => onAdd(type)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onAdd(type);
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.75,
        borderRadius: 1,
        border: '1px dashed',
        borderColor: 'divider',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
      }}
    >
      <Iconify icon={info.icon} width={18} sx={{ color: 'text.secondary', flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {info.label}
        </Typography>
        <Typography variant="caption" color="text.disabled" noWrap component="div">
          {info.hint}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Giữa: bố cục ─────────────────────────────────────────────────────────

type RowProps = {
  block: ReceiptBlock;
  kind: BlockDocumentKind;
  selected: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onMove: (delta: number) => void;
  onToggleHidden: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

function BlockRow({
  block,
  kind,
  selected,
  first,
  last,
  onSelect,
  onMove,
  onToggleHidden,
  onDuplicate,
  onRemove,
}: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const info = blockTypeInfo(block.type, kind);
  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      onClick={onSelect}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        pl: 0.5,
        pr: 0.5,
        py: 0.5,
        cursor: 'pointer',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : block.hidden ? 0.5 : 1,
        borderColor: selected ? 'primary.main' : 'divider',
        boxShadow: selected ? (theme) => `0 0 0 1px ${theme.palette.primary.main}` : 'none',
      }}
    >
      <IconButton
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        size="small"
        aria-label={`Kéo để đổi chỗ khối ${info.label}`}
        sx={{ cursor: 'grab', touchAction: 'none' }}
        onClick={(event) => event.stopPropagation()}
      >
        <Iconify icon="mdi:drag" width={18} />
      </IconButton>
      <Iconify icon={info.icon} width={18} sx={{ color: 'text.secondary', flexShrink: 0 }} />
      <Box sx={{ minWidth: 0, flexGrow: 1, ml: 0.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography variant="subtitle2" noWrap>
            {info.label}
          </Typography>
          {!block.hideEmpty && <Chip size="small" label="luôn in" sx={{ height: 18 }} />}
          {block.hidden && <Chip size="small" label="tạm ẩn" sx={{ height: 18 }} />}
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {summary(block) || ' '}
        </Typography>
      </Box>
      <Stack direction="row" onClick={(event) => event.stopPropagation()}>
        <Tooltip title="Lên">
          <span>
            <IconButton size="small" disabled={first} onClick={() => onMove(-1)} aria-label="Lên">
              <Iconify icon="eva:arrow-upward-fill" width={16} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Xuống">
          <span>
            <IconButton size="small" disabled={last} onClick={() => onMove(1)} aria-label="Xuống">
              <Iconify icon="eva:arrow-downward-fill" width={16} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={block.hidden ? 'In lại khối này' : 'Tạm ẩn (giữ cấu hình, không in)'}>
          <IconButton size="small" onClick={onToggleHidden} aria-label="Tạm ẩn">
            <Iconify icon={block.hidden ? 'solar:eye-closed-bold' : 'solar:eye-bold'} width={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Nhân đôi">
          <IconButton size="small" onClick={onDuplicate} aria-label="Nhân đôi">
            <Iconify icon="solar:copy-bold" width={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Xoá">
          <IconButton size="small" color="error" onClick={onRemove} aria-label="Xoá khối">
            <Iconify icon="solar:trash-bin-trash-bold" width={16} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

function ListEnd({ empty }: { empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: LIST_END });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        minHeight: empty ? 160 : 36,
        borderRadius: 1,
        border: '1px dashed',
        borderColor: isOver ? 'primary.main' : 'divider',
        bgcolor: isOver ? 'action.hover' : 'transparent',
        display: 'grid',
        placeItems: 'center',
        color: 'text.disabled',
        typography: 'caption',
      }}
    >
      {empty ? 'Kéo khối từ bên trái thả vào đây' : 'Thả vào đây để thêm cuối phiếu'}
    </Box>
  );
}

// ── Phải: thuộc tính ─────────────────────────────────────────────────────

function FlagGroup<K extends string>({
  keys,
  labels,
  value,
  onChange,
}: {
  keys: readonly K[];
  labels: Record<K, string>;
  value: Record<K, boolean>;
  onChange: (next: Record<K, boolean>) => void;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1 }}>
      {keys.map((key) => (
        <FormControlLabel
          key={key}
          sx={{ m: 0, '& .MuiFormControlLabel-label': { typography: 'body2' } }}
          control={
            <Checkbox
              size="small"
              checked={value[key]}
              onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
            />
          }
          label={labels[key]}
        />
      ))}
    </Box>
  );
}

function FieldChips({ kind, onInsert }: { kind: BlockDocumentKind; onInsert: (token: string) => void }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {textFieldsOf(kind).map((field) => (
        <Chip
          key={field.key}
          size="small"
          variant="outlined"
          label={field.label}
          onClick={() => onInsert(`{{${field.key}}}`)}
        />
      ))}
    </Box>
  );
}

function BlockProperties({
  block,
  kind,
  onChange,
}: {
  block: ReceiptBlock;
  kind: BlockDocumentKind;
  onChange: (next: ReceiptBlock) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ReceiptBlock>) => onChange({ ...block, ...patch } as ReceiptBlock);
  const info = blockTypeInfo(block.type, kind);
  const doc = kind === 'purchase' ? 'phiếu' : 'hoá đơn';
  const textual = !['logo', 'divider', 'spacer', 'image'].includes(block.type);
  const alignable = !['divider', 'spacer', 'items', 'totals', 'payments', 'purchaseTotals', 'signatures'].includes(
    block.type
  );
  const hideable = !['logo', 'divider', 'spacer', 'image', 'code', 'signatures'].includes(block.type);

  const upload = async (file: File | undefined) => {
    if (!file || block.type !== 'image') return;
    setUploading(true);
    try {
      const src = await uploadTemplateImage(file);
      onChange({ ...block, src });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Không tải được ảnh', { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Iconify icon={info.icon} width={20} />
        <Typography variant="subtitle1">{info.label}</Typography>
      </Stack>

      {alignable && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={block.align}
          onChange={(_, next) => next && set({ align: next })}
          aria-label="Căn lề"
        >
          <ToggleButton value="left" aria-label="Căn trái">
            <Iconify icon="solar:align-left-bold" width={18} />
          </ToggleButton>
          <ToggleButton value="center" aria-label="Căn giữa">
            <Iconify icon="solar:align-horizontal-center-bold" width={18} />
          </ToggleButton>
          <ToggleButton value="right" aria-label="Căn phải">
            <Iconify icon="solar:align-right-bold" width={18} />
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      {textual && (
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            select
            size="small"
            label="Cỡ chữ"
            value={block.size}
            onChange={(event) => set({ size: Number(event.target.value) })}
            sx={{ minWidth: 140 }}
          >
            {[-2, -1, 0, 1, 2, 3, 4, 6, 8].map((delta) => (
              <MenuItem key={delta} value={delta}>
                {delta === 0 ? 'Theo mẫu' : `${delta > 0 ? '+' : ''}${delta} pt`}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={<Switch size="small" checked={block.bold} onChange={(e) => set({ bold: e.target.checked })} />}
            label="Đậm"
          />
        </Stack>
      )}

      {block.type === 'logo' && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            Rộng {block.widthPct}% bề ngang phiếu — khi in lấy logo hiện tại ở Cài đặt cửa hàng
          </Typography>
          <Slider
            size="small"
            min={10}
            max={100}
            step={5}
            value={block.widthPct}
            onChange={(_, next) => onChange({ ...block, widthPct: next as number })}
            aria-label="Bề rộng logo"
          />
        </Box>
      )}

      {block.type === 'storeHeader' && (
        <>
          <FlagGroup
            keys={STORE_LINES}
            labels={STORE_LINE_LABELS}
            value={block.lines}
            onChange={(lines) => onChange({ ...block, lines })}
          />
          <Typography variant="caption" color="text.secondary">
            Tên chi nhánh, địa chỉ, ĐT lấy theo chi nhánh của {doc} (KiotViet). Tên chi nhánh trùng ý với tên cửa hàng thì
            tắt dòng &quot;Tên chi nhánh&quot;.
          </Typography>
        </>
      )}

      {(block.type === 'title' || block.type === 'text') && (
        <>
          <TextField
            size="small"
            multiline={block.type === 'text'}
            minRows={block.type === 'text' ? 2 : undefined}
            label={block.type === 'title' ? 'Tiêu đề' : 'Nội dung'}
            value={block.text}
            onChange={(event) => onChange({ ...block, text: event.target.value.slice(0, 500) })}
            helperText={
              block.type === 'title'
                ? kind === 'purchase'
                  ? '{{invoice_title}} = PHIẾU NHẬP HÀNG'
                  : '{{invoice_title}} = tiêu đề theo trạng thái hoá đơn'
                : undefined
            }
          />
          <FieldChips kind={kind} onInsert={(token) => onChange({ ...block, text: `${block.text}${token}` })} />
          {block.type === 'title' && (
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={block.showCancelled}
                  onChange={(e) => onChange({ ...block, showCancelled: e.target.checked })}
                />
              }
              label={`Hiện dấu "ĐÃ HUỶ" khi ${doc} huỷ`}
            />
          )}
        </>
      )}

      {block.type === 'invoiceInfo' && (
        <FlagGroup keys={INFO_ROWS} labels={INFO_ROW_LABELS} value={block.rows} onChange={(rows) => onChange({ ...block, rows })} />
      )}

      {block.type === 'items' && (
        <>
          <TextField
            select
            size="small"
            label="Kiểu"
            value={block.layout}
            onChange={(event) => onChange({ ...block, layout: event.target.value as typeof block.layout })}
          >
            {(Object.keys(ITEMS_LAYOUT_LABELS) as (keyof typeof ITEMS_LAYOUT_LABELS)[]).map((key) => (
              <MenuItem key={key} value={key}>
                {ITEMS_LAYOUT_LABELS[key]}
              </MenuItem>
            ))}
          </TextField>
          <FlagGroup keys={ITEM_COLUMNS} labels={ITEM_COLUMN_LABELS} value={block.cols} onChange={(cols) => onChange({ ...block, cols })} />
          <FormControlLabel
            control={<Checkbox size="small" checked={block.header} onChange={(e) => onChange({ ...block, header: e.target.checked })} />}
            label="Hàng tiêu đề cột (kiểu bảng)"
          />
          <Typography variant="caption" color="text.secondary">
            Dòng hàng tự lặp cho từng món. &quot;Tự động&quot;: mỗi món 2 dòng ở giấy cuộn, bảng nhiều cột ở A5 / A4.
          </Typography>
        </>
      )}

      {block.type === 'totals' && (
        <>
          <FlagGroup keys={TOTAL_ROWS} labels={TOTAL_ROW_LABELS} value={block.rows} onChange={(rows) => onChange({ ...block, rows })} />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={block.emphasizeTotal}
                onChange={(e) => onChange({ ...block, emphasizeTotal: e.target.checked })}
              />
            }
            label='Nhấn mạnh "Khách cần trả"'
          />
        </>
      )}

      {block.type === 'payments' && (
        <>
          <FormControlLabel
            control={<Checkbox size="small" checked={block.showReference} onChange={(e) => onChange({ ...block, showReference: e.target.checked })} />}
            label="Mã giao dịch"
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={block.showTime} onChange={(e) => onChange({ ...block, showTime: e.target.checked })} />}
            label="Thời gian thu"
          />
        </>
      )}

      {block.type === 'transferQr' && (
        <>
          <TextField
            size="small"
            label="Chú thích trên mã"
            value={block.caption}
            onChange={(event) => onChange({ ...block, caption: event.target.value.slice(0, 500) })}
          />
          <FlagGroup keys={TRANSFER_LINES} labels={TRANSFER_LINE_LABELS} value={block.lines} onChange={(lines) => onChange({ ...block, lines })} />
          <Typography variant="caption" color="text.secondary">
            Chỉ in khi hoá đơn còn phải trả. Tài khoản nhận theo kênh (Thanh toán › Cài đặt); mất mạng thì dựng VietQR tĩnh tại máy.
          </Typography>
        </>
      )}

      {block.type === 'code' && (
        <>
          <TextField
            select
            size="small"
            label="Loại mã"
            value={block.kind}
            onChange={(event) => onChange({ ...block, kind: event.target.value as 'barcode' | 'qr' })}
          >
            <MenuItem value="barcode">Mã vạch</MenuItem>
            <MenuItem value="qr">Mã QR</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Checkbox size="small" checked={block.showCode} onChange={(e) => onChange({ ...block, showCode: e.target.checked })} />}
            label={`In mã ${doc} dưới mã`}
          />
        </>
      )}

      {block.type === 'purchaseInfo' && (
        <FlagGroup
          keys={PURCHASE_INFO_ROWS}
          labels={PURCHASE_INFO_ROW_LABELS}
          value={block.rows}
          onChange={(rows) => onChange({ ...block, rows })}
        />
      )}

      {block.type === 'purchaseTotals' && (
        <>
          <FlagGroup
            keys={PURCHASE_TOTAL_ROWS}
            labels={PURCHASE_TOTAL_ROW_LABELS}
            value={block.rows}
            onChange={(rows) => onChange({ ...block, rows })}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={block.emphasizeTotal}
                onChange={(e) => onChange({ ...block, emphasizeTotal: e.target.checked })}
              />
            }
            label='Nhấn mạnh "Cần trả NCC"'
          />
        </>
      )}

      {block.type === 'signatures' && (
        <>
          <TextField
            size="small"
            label="Cột trái"
            value={block.left}
            onChange={(event) => onChange({ ...block, left: event.target.value.slice(0, 60) })}
          />
          <TextField
            size="small"
            label="Cột phải"
            value={block.right}
            onChange={(event) => onChange({ ...block, right: event.target.value.slice(0, 60) })}
            helperText="Để trống một cột = chỉ một chữ ký"
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={block.showNote}
                onChange={(e) => onChange({ ...block, showNote: e.target.checked })}
              />
            }
            label='"(Ký, ghi rõ họ tên)"'
          />
          <TextField
            select
            size="small"
            label="Chỗ trống để ký"
            value={block.lines}
            onChange={(event) => onChange({ ...block, lines: Number(event.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <MenuItem key={n} value={n}>
                {n} dòng
              </MenuItem>
            ))}
          </TextField>
        </>
      )}

      {block.type === 'divider' && (
        <TextField
          select
          size="small"
          label="Kiểu nét"
          value={block.style}
          onChange={(event) => onChange({ ...block, style: event.target.value as typeof block.style })}
        >
          {(Object.keys(RULE_STYLE_LABELS) as (keyof typeof RULE_STYLE_LABELS)[]).map((key) => (
            <MenuItem key={key} value={key}>
              {RULE_STYLE_LABELS[key]}
            </MenuItem>
          ))}
        </TextField>
      )}

      {block.type === 'spacer' && (
        <TextField
          select
          size="small"
          label="Số dòng trống"
          value={block.lines}
          onChange={(event) => onChange({ ...block, lines: Number(event.target.value) })}
        >
          {[1, 2, 3, 4].map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>
      )}

      {block.type === 'image' && (
        <>
          {block.src && (
            <Box component="img" src={block.src} alt="" sx={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
          )}
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              upload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            variant="outlined"
            size="small"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            startIcon={<Iconify icon="solar:upload-bold" />}
          >
            {uploading ? 'Đang tải ảnh…' : block.src ? 'Đổi ảnh' : 'Chọn ảnh từ máy'}
          </Button>
          <Slider
            size="small"
            min={10}
            max={100}
            step={5}
            value={block.widthPct}
            onChange={(_, next) => onChange({ ...block, widthPct: next as number })}
            aria-label="Bề rộng ảnh"
          />
        </>
      )}

      {block.type === 'footer' && (
        <>
          <FormControlLabel
            control={<Checkbox size="small" checked={block.showFooter} onChange={(e) => onChange({ ...block, showFooter: e.target.checked })} />}
            label="Lời chào (Cài đặt cửa hàng › Thông tin)"
          />
          <FormControlLabel
            control={<Checkbox size="small" checked={block.showPrintedAt} onChange={(e) => onChange({ ...block, showPrintedAt: e.target.checked })} />}
            label='"In lúc …"'
          />
        </>
      )}

      {hideable && (
        <FormControlLabel
          control={<Switch size="small" checked={block.hideEmpty} onChange={(e) => set({ hideEmpty: e.target.checked })} />}
          label={
            <Box>
              <Typography variant="body2">Ẩn dòng khi rỗng</Typography>
              <Typography variant="caption" color="text.secondary">
                Tắt = luôn in dòng (vd. &quot;Ghi chú: …&quot; để viết tay)
              </Typography>
            </Box>
          }
        />
      )}
    </Stack>
  );
}

// ── Trình soạn ───────────────────────────────────────────────────────────

export function ReceiptBlockEditor({ blocks, onChange, onStarter, onFreeMode, kind = 'receipt' }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id ?? null);
  const [dragging, setDragging] = useState<string | null>(null);
  // Mã ổn định cho phần mô tả trợ năng của dnd-kit (tự đánh số thì lệch giữa máy chủ và trình duyệt khi hydrate).
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const selected = blocks.find((block) => block.id === selectedId) ?? null;
  const full = blocks.length >= MAX_RECEIPT_BLOCKS;

  const insertAt = (type: ReceiptBlockType, index: number) => {
    if (full) return;
    const block = createBlock(type);
    const next = [...blocks];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
    onChange(next);
    setSelectedId(block.id);
  };

  const addAfterSelected = (type: ReceiptBlockType) => {
    const at = selected ? blocks.indexOf(selected) + 1 : blocks.length;
    insertAt(type, at);
  };

  const update = (next: ReceiptBlock) => onChange(blocks.map((b) => (b.id === next.id ? next : b)));

  const move = (id: string, delta: number) => {
    const from = blocks.findIndex((b) => b.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= blocks.length) return;
    onChange(arrayMove(blocks, from, to));
  };

  const remove = (id: string) => {
    const index = blocks.findIndex((b) => b.id === id);
    const next = blocks.filter((b) => b.id !== id);
    onChange(next);
    if (selectedId === id) setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? null);
  };

  const onDragStart = (event: DragStartEvent) => setDragging(String(event.active.id));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith(NEW_PREFIX)) {
      const type = activeId.slice(NEW_PREFIX.length) as ReceiptBlockType;
      const index = overId === LIST_END ? blocks.length : blocks.findIndex((b) => b.id === overId);
      insertAt(type, index < 0 ? blocks.length : index);
      return;
    }
    if (activeId === overId) return;
    const from = blocks.findIndex((b) => b.id === activeId);
    const to = overId === LIST_END ? blocks.length - 1 : blocks.findIndex((b) => b.id === overId);
    if (from >= 0 && to >= 0) onChange(arrayMove(blocks, from, to));
  };

  const draggingType = dragging?.startsWith(NEW_PREFIX)
    ? (dragging.slice(NEW_PREFIX.length) as ReceiptBlockType)
    : (blocks.find((b) => b.id === dragging)?.type ?? null);

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <Box
        display="grid"
        gap={2}
        gridTemplateColumns={{ xs: 'minmax(0, 1fr)', md: '200px minmax(0, 1fr)', lg: '210px minmax(0, 1fr) 300px' }}
        alignItems="start"
      >
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="overline" color="text.secondary">
            Khối
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
            Kéo vào bố cục, hoặc bấm để thêm sau khối đang chọn.
          </Typography>
          <Stack spacing={0.75}>
            {BLOCK_TYPE_ORDERS[kind].map((type) => (
              <PaletteItem key={type} type={type} kind={kind} onAdd={addAfterSelected} />
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
            <Typography variant="overline" color="text.secondary" sx={{ flexGrow: 1 }}>
              Bố cục phiếu · {blocks.length} khối
            </Typography>
            <TextField
              select
              size="small"
              label="Bắt đầu từ mẫu"
              value=""
              onChange={(event) => {
                if (window.confirm('Thay toàn bộ bố cục bằng mẫu khởi đầu này?')) onStarter(event.target.value);
              }}
              sx={{ minWidth: 200 }}
            >
              {BLOCK_STARTERS[kind].map((starter) => (
                <MenuItem key={starter.key} value={starter.key}>
                  {starter.label}
                </MenuItem>
              ))}
            </TextField>
            <Tooltip describeChild title="Chuyển sang trình soạn văn bản (định dạng tự do). Sau khi lưu ở chế độ đó, mẫu không mở lại theo khối được.">
              <Button size="small" color="inherit" onClick={onFreeMode} startIcon={<Iconify icon="solar:pen-new-square-bold" />}>
                Soạn tự do
              </Button>
            </Tooltip>
          </Stack>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <Stack spacing={0.75}>
              {blocks.map((block, index) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  kind={kind}
                  selected={block.id === selectedId}
                  first={index === 0}
                  last={index === blocks.length - 1}
                  onSelect={() => setSelectedId(block.id)}
                  onMove={(delta) => move(block.id, delta)}
                  onToggleHidden={() => update({ ...block, hidden: !block.hidden })}
                  onDuplicate={() => {
                    if (full) return;
                    const copy = duplicateBlock(block);
                    const next = [...blocks];
                    next.splice(index + 1, 0, copy);
                    onChange(next);
                    setSelectedId(copy.id);
                  }}
                  onRemove={() => remove(block.id)}
                />
              ))}
              <ListEnd empty={blocks.length === 0} />
            </Stack>
          </SortableContext>
          {full && (
            <Typography variant="caption" color="warning.main">
              Tối đa {MAX_RECEIPT_BLOCKS} khối.
            </Typography>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, gridColumn: { md: '1 / -1', lg: 'auto' } }}>
          {selected ? (
            <BlockProperties key={selected.id} block={selected} kind={kind} onChange={update} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Chọn một khối trong bố cục để chỉnh.
            </Typography>
          )}
        </Paper>
      </Box>

      <DragOverlay dropAnimation={null}>
        {draggingType && (
          <Paper elevation={8} sx={{ px: 1.5, py: 1, display: 'flex', gap: 1, alignItems: 'center', width: 220 }}>
            <Iconify icon={blockTypeInfo(draggingType, kind).icon} width={18} />
            <Typography variant="body2">{blockTypeInfo(draggingType, kind).label}</Typography>
          </Paper>
        )}
      </DragOverlay>
    </DndContext>
  );
}
