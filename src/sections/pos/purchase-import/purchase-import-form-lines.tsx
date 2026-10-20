'use client';

import { useRef, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { fNumber, fCurrency } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';

import { getAllProducts } from 'src/api/products';

import type {
  IPurchaseImport,
  IPurchaseImportLine,
  IPurchaseImportProductHistory,
  IUpdatePurchaseImportLineRequest,
} from 'src/types/purchase-import';

import PurchaseImportPackField from './purchase-import-pack-field';
import { flattenProducts } from './purchase-import-product-picker';
import {
  issueLabel,
  LINE_STATUS,
  parseAmount,
  perPieceCost,
  hasNumberIssue,
} from './purchase-import-utils';

// ----------------------------------------------------------------------
// Các dòng của lần nhập dạng FORM PHIẾU NHẬP (trang duyệt đầy đủ): mỗi dòng như một dòng phiếu chính thức — chọn / đổi
// sản phẩm ngay trong ô (gợi ý của hệ thống trước, gõ để tìm cả danh mục, hoặc đặt mã mới tạo khi tạo phiếu), sửa SL /
// đơn giá / thành tiền tại chỗ, tích "Giá theo gói" khi đơn giá là giá cả gói. Hàng dưới mỗi dòng: số sẽ vào phiếu
// (chiếc × giá mỗi chiếc), lịch sử nhập của mã ở NCC này, cảnh báo số. Lưu từng ô khi rời ô.
// ----------------------------------------------------------------------

type Props = {
  item: IPurchaseImport;
  editable: boolean;
  busyLine: number | null;
  highlight: number[];
  /** Tên dòng "như trên" = tên dòng có tên phía trên. */
  familyName: (line: IPurchaseImportLine) => string;
  history: (line: IPurchaseImportLine) => IPurchaseImportProductHistory | null;
  canCreateProduct: boolean;
  selectable: (line: IPurchaseImportLine) => boolean;
  selected: number[];
  onToggleSelect: (lineNo: number) => void;
  onSave: (lineNo: number, patch: IUpdatePurchaseImportLineRequest) => void;
  popperZIndex?: number;
};

export default function PurchaseImportFormLines({
  item,
  editable,
  busyLine,
  highlight,
  familyName,
  history,
  canCreateProduct,
  selectable,
  selected,
  onToggleSelect,
  onSave,
  popperZIndex,
}: Props) {
  return (
    <Scrollbar>
      <Table size="small" sx={{ minWidth: 820 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 56 }}>#</TableCell>
            <TableCell sx={{ minWidth: 150 }}>Trên hoá đơn</TableCell>
            <TableCell sx={{ minWidth: 260 }}>Sản phẩm</TableCell>
            <TableCell align="right" sx={{ width: 84 }}>
              SL
            </TableCell>
            <TableCell align="right" sx={{ width: 112 }}>
              Đơn giá
            </TableCell>
            <TableCell align="right" sx={{ width: 124 }}>
              Thành tiền
            </TableCell>
            <TableCell sx={{ width: 40 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {item.lines.map((line) => (
            <FormRow
              key={line.lineNo}
              line={line}
              familyName={familyName(line)}
              history={history(line)}
              editable={editable}
              busy={busyLine === line.lineNo}
              highlighted={highlight.includes(line.lineNo)}
              canCreateProduct={canCreateProduct}
              selectable={selectable(line)}
              selected={selected.includes(line.lineNo)}
              onToggleSelect={() => onToggleSelect(line.lineNo)}
              onSave={(patch) => onSave(line.lineNo, patch)}
              popperZIndex={popperZIndex}
            />
          ))}
        </TableBody>
      </Table>
    </Scrollbar>
  );
}

// ----------------------------------------------------------------------

type RowProps = {
  line: IPurchaseImportLine;
  familyName: string;
  history: IPurchaseImportProductHistory | null;
  editable: boolean;
  busy: boolean;
  highlighted: boolean;
  canCreateProduct: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onSave: (patch: IUpdatePurchaseImportLineRequest) => void;
  popperZIndex?: number;
};

function FormRow({
  line,
  familyName,
  history,
  editable,
  busy,
  highlighted,
  canCreateProduct,
  selectable,
  selected,
  onToggleSelect,
  onSave,
  popperZIndex,
}: RowProps) {
  const skipped = line.status === 'Skipped';
  const locked = !editable || skipped || busy;
  const pieces =
    line.countedQuantity && line.countedQuantity > 0 ? line.countedQuantity : line.quantity;
  const pieceCost = perPieceCost(line) ?? line.unitPrice;
  const issues = line.issues.filter((i) => i !== 'unit_converted');
  const rowSx = {
    opacity: skipped ? 0.5 : 1,
    bgcolor: highlighted ? 'success.lighter' : undefined,
    transition: 'background-color 600ms ease',
  };

  return (
    <>
      <TableRow sx={{ ...rowSx, verticalAlign: 'top', '& td': { borderBottom: 'none', pb: 0.5 } }}>
        <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap', px: 0.5 }}>
          {selectable ? (
            <Checkbox
              size="small"
              checked={selected}
              onChange={onToggleSelect}
              inputProps={{ 'aria-label': `Đặt mã mới cho dòng ${line.lineNo}` }}
              sx={{ p: 0.25 }}
            />
          ) : (
            <Box component="span" sx={{ display: 'inline-block', width: 26 }} />
          )}
          {line.lineNo}
        </TableCell>
        <TableCell>
          <Typography variant="subtitle2">
            {line.sameAsAbove ? '″ ' : ''}
            {familyName}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.disabled', fontFamily: 'monospace', display: 'block' }}
          >
            {line.rawText}
          </Typography>
        </TableCell>
        <TableCell>
          <ProductCell
            line={line}
            familyName={familyName}
            disabled={locked}
            canCreateProduct={canCreateProduct}
            onSave={onSave}
            popperZIndex={popperZIndex}
          />
        </TableCell>
        <TableCell align="right">
          <NumberField
            label="SL"
            value={line.quantity}
            disabled={locked}
            onCommit={(quantity) => onSave({ quantity })}
          />
        </TableCell>
        <TableCell align="right">
          <NumberField
            label="Đơn giá"
            value={line.unitPrice}
            disabled={locked}
            onCommit={(unitPrice) => onSave({ unitPrice })}
          />
        </TableCell>
        <TableCell align="right">
          <NumberField
            label="Thành tiền"
            value={line.lineTotal}
            warn={hasNumberIssue(line)}
            disabled={locked}
            onCommit={(lineTotal) => onSave({ lineTotal })}
          />
        </TableCell>
        <TableCell sx={{ px: 0.5 }}>
          {editable && (
            <Tooltip title={skipped ? 'Lấy lại dòng' : 'Bỏ dòng (không nhập)'}>
              <span>
                <IconButton size="small" disabled={busy} onClick={() => onSave({ skip: !skipped })}>
                  <Iconify
                    icon={
                      skipped ? 'solar:undo-left-round-bold' : 'solar:trash-bin-minimalistic-linear'
                    }
                    width={18}
                  />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>

      <TableRow sx={rowSx}>
        <TableCell />
        <TableCell colSpan={6} sx={{ pt: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start" flexWrap="wrap" useFlexGap>
            {!skipped && (
              <PurchaseImportPackField line={line} disabled={locked} dense onSave={onSave} />
            )}
            {!skipped && pieces != null && pieceCost != null && (
              <Typography variant="caption" sx={{ color: 'text.secondary', pt: 1 }}>
                Vào phiếu: <strong>{fNumber(pieces)}</strong>
                {line.countedQuantity ? ' chiếc' : ''} × <strong>{fCurrency(pieceCost)}</strong>
              </Typography>
            )}
            {history && !skipped && (
              <Typography
                variant="caption"
                title={`Lần đầu ${fDate(history.firstDate, 'dd/MM/yyyy')}, tổng ${history.totalQuantity} chiếc`}
                sx={{ color: 'text.secondary', pt: 1 }}
              >
                <Iconify
                  icon="solar:clock-circle-outline"
                  width={13}
                  sx={{ mr: 0.5, verticalAlign: -2 }}
                />
                Đã nhập NCC này {history.times} lần · gần nhất{' '}
                {fDate(history.lastDate, 'dd/MM/yyyy')}: {history.lastQuantity} chiếc ×{' '}
                {fCurrency(history.lastCost)}
                {history.minCost !== history.maxCost &&
                  ` (${fCurrency(history.minCost)}–${fCurrency(history.maxCost)})`}
              </Typography>
            )}
            {issues.map((issue) => (
              <Chip
                key={issue}
                size="small"
                color="warning"
                variant="soft"
                label={issueLabel(issue)}
                sx={{ height: 22, mt: 0.5 }}
              />
            ))}
          </Stack>
        </TableCell>
      </TableRow>
    </>
  );
}

// ----------------------------------------------------------------------

type Option =
  | { kind: 'candidate'; id: string; code: string; name: string; reason: string; top: boolean }
  | { kind: 'search'; id: string; code: string; name: string; price?: number }
  | { kind: 'new'; name: string };

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

type ProductCellProps = {
  line: IPurchaseImportLine;
  familyName: string;
  disabled: boolean;
  canCreateProduct: boolean;
  onSave: (patch: IUpdatePurchaseImportLineRequest) => void;
  popperZIndex?: number;
};

/**
 * Ô sản phẩm của dòng: đã chốt thì hiện mã (bấm "Đổi" để chọn lại); chưa thì một ô chọn — gợi ý của hệ thống trước (kèm
 * lý do), gõ ≥ 2 chữ thì tìm cả danh mục, cuối danh sách "Đặt mã mới «…»" (mã tạo khi tạo phiếu).
 */
function ProductCell({
  line,
  familyName,
  disabled,
  canCreateProduct,
  onSave,
  popperZIndex,
}: ProductCellProps) {
  const [changing, setChanging] = useState(false);
  const [input, setInput] = useState('');
  const [found, setFound] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const request = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => setChanging(false), [line.productId, line.newProductName]);

  const status = LINE_STATUS[line.status];
  const chosen = line.productId
    ? line.candidates.find((c) => c.productId === line.productId)
    : undefined;

  if (line.newProductName && !changing)
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Label color="info">Mã mới</Label>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
          «{line.newProductName}»
          {line.newProductSalePrice ? ` · bán ${fCurrency(line.newProductSalePrice)}` : ''}
        </Typography>
        {!disabled && (
          <Button size="small" color="inherit" onClick={() => onSave({ newProductName: '' })}>
            Bỏ
          </Button>
        )}
      </Stack>
    );

  if (line.productId && !changing)
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <Label color={status.color}>{status.label}</Label>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={chosen?.reason}>
          {chosen ? (
            <>
              <strong>{chosen.code}</strong> — {chosen.name}
            </>
          ) : (
            'Đã chọn mã'
          )}
        </Typography>
        {!disabled && (
          <Button size="small" color="inherit" onClick={() => setChanging(true)}>
            Đổi
          </Button>
        )}
      </Stack>
    );

  const search = (keyword: string) => {
    clearTimeout(timer.current);
    if (keyword.trim().length < MIN_CHARS) {
      setFound([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const current = ++request.current;
    timer.current = setTimeout(() => {
      getAllProducts({ keyword: keyword.trim(), pageSize: 20 })
        .then(
          (res) =>
            current === request.current &&
            setFound(flattenProducts(res.items).map((p) => ({ kind: 'search' as const, ...p })))
        )
        .catch(() => current === request.current && setFound([]))
        .finally(() => current === request.current && setLoading(false));
    }, DEBOUNCE_MS);
  };

  const candidates: Option[] = line.candidates
    .filter((c) => c.productId !== line.productId)
    .map((c, index) => ({
      kind: 'candidate' as const,
      id: c.productId,
      code: c.code,
      name: c.name,
      reason: c.reason,
      top: index === 0 && c.productId === line.suggestedProductId,
    }));
  const newName = (input.trim() || familyName).trim();
  const options: Option[] = [
    ...candidates,
    ...found.filter(
      (f) => f.kind === 'search' && !candidates.some((c) => c.kind === 'candidate' && c.id === f.id)
    ),
    ...(canCreateProduct && newName ? [{ kind: 'new' as const, name: newName }] : []),
  ];

  return (
    <Stack spacing={0.5}>
      <Autocomplete<Option>
        size="small"
        fullWidth
        openOnFocus
        disabled={disabled}
        options={options}
        loading={loading}
        value={null}
        inputValue={input}
        filterOptions={(x) => x}
        groupBy={(o) =>
          o.kind === 'candidate' ? 'Gợi ý' : o.kind === 'search' ? 'Danh mục' : 'Hàng mới'
        }
        noOptionsText="Gõ tên hoặc mã hàng để tìm"
        slotProps={popperZIndex ? { popper: { sx: { zIndex: popperZIndex } } } : undefined}
        getOptionLabel={(o) =>
          o.kind === 'new' ? `Đặt mã mới «${o.name}»` : `${o.code} — ${o.name}`
        }
        isOptionEqualToValue={(a, b) =>
          a.kind === b.kind &&
          (a.kind === 'new'
            ? a.name === (b as { name: string }).name
            : a.id === (b as { id: string }).id)
        }
        onInputChange={(_, value, reason) => {
          if (reason === 'reset') return;
          setInput(value);
          search(value);
        }}
        onChange={(_, value) => {
          if (!value) return;
          setInput('');
          setFound([]);
          if (value.kind === 'new') onSave({ newProductName: value.name });
          else onSave({ productId: value.id });
        }}
        renderOption={(props, option) => (
          <li {...props} key={option.kind === 'new' ? 'new' : `${option.kind}-${option.id}`}>
            {option.kind === 'new' ? (
              <Typography variant="body2" sx={{ color: 'info.main' }}>
                <Iconify icon="mingcute:add-line" width={14} sx={{ mr: 0.5, verticalAlign: -2 }} />
                Đặt mã mới «{option.name}» (tạo khi tạo phiếu)
              </Typography>
            ) : (
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {option.kind === 'candidate' && option.top && (
                    <Box component="span" sx={{ color: 'warning.main', mr: 0.5 }}>
                      Có thể là
                    </Box>
                  )}
                  <strong>{option.code}</strong> — {option.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                  {option.kind === 'candidate'
                    ? option.reason
                    : option.price
                      ? `bán ${fCurrency(option.price)}`
                      : ''}
                </Typography>
              </Box>
            )}
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={
              candidates.length
                ? `Chọn mã (${candidates.length} gợi ý) hoặc gõ để tìm…`
                : 'Gõ tên / mã hàng…'
            }
            error={
              !disabled && !line.productId && !line.newProductName && line.status !== 'Skipped'
            }
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress color="inherit" size={16} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
      {!changing && candidates[0] && candidates[0].kind === 'candidate' && (
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', flex: 1, minWidth: 0 }}
            noWrap
          >
            <Box component="span" sx={{ color: 'warning.main' }}>
              Gợi ý:
            </Box>{' '}
            <strong>{candidates[0].code}</strong> — {candidates[0].name}
          </Typography>
          {!disabled && (
            <Button
              size="small"
              variant="soft"
              color="primary"
              onClick={() => onSave({ productId: (candidates[0] as { id: string }).id })}
              sx={{ minWidth: 0, px: 1, py: 0 }}
            >
              Đúng
            </Button>
          )}
        </Stack>
      )}
      {changing && (
        <Button
          size="small"
          color="inherit"
          onClick={() => setChanging(false)}
          sx={{ alignSelf: 'flex-start' }}
        >
          Giữ mã cũ
        </Button>
      )}
    </Stack>
  );
}

// ----------------------------------------------------------------------

type NumberFieldProps = {
  label: string;
  value?: number | null;
  disabled: boolean;
  warn?: boolean;
  onCommit: (value: number) => void;
};

/** Ô số sửa tại chỗ: lưu khi rời ô / Enter, chỉ khi giá trị đổi và > 0. */
function NumberField({ label, value, disabled, warn, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(value != null ? String(value) : '');

  useEffect(() => setText(value != null ? String(value) : ''), [value]);

  const commit = () => {
    const parsed = parseAmount(text);
    if (parsed === null) {
      setText(value != null ? String(value) : '');
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <TextField
      size="small"
      value={text}
      error={warn}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      inputProps={{ inputMode: 'decimal', 'aria-label': label, style: { textAlign: 'right' } }}
      helperText={value != null && value >= 1000 ? fNumber(value) : undefined}
      FormHelperTextProps={{ sx: { textAlign: 'right', mx: 0 } }}
    />
  );
}
