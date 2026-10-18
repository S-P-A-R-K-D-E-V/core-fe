'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { fCurrency, fNumber } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';

import type { IPurchaseImportLine, IUpdatePurchaseImportLineRequest } from 'src/types/purchase-import';

import PurchaseImportProductPicker from './purchase-import-product-picker';
import { LINE_STATUS, issueLabel, parseAmount, hasNumberIssue } from './purchase-import-utils';

// ----------------------------------------------------------------------

type Props = {
  line: IPurchaseImportLine;
  /** Tên của dòng phía trên — dòng ghi "—" (như trên) dùng để gợi ý tìm / tạo mã. */
  familyName?: string | null;
  editable: boolean;
  busy: boolean;
  canCreateProduct: boolean;
  onSave: (patch: IUpdatePurchaseImportLineRequest) => void;
  onCreateProduct: () => void;
};

export default function PurchaseImportLineRow({
  line,
  familyName,
  editable,
  busy,
  canCreateProduct,
  onSave,
  onCreateProduct,
}: Props) {
  const [changing, setChanging] = useState(false);
  const skipped = line.status === 'Skipped';
  const chosen = line.productId ? line.candidates.find((c) => c.productId === line.productId) : undefined;
  const showChoices = editable && !skipped && (!line.productId || changing);
  const keyword = line.name || familyName || '';

  // Chọn xong (hoặc dữ liệu tải lại) thì đóng phần đổi mã.
  useEffect(() => setChanging(false), [line.productId]);

  const pick = (productId: string) => onSave({ productId });

  return (
    <TableRow sx={{ verticalAlign: 'top', opacity: skipped ? 0.5 : 1 }}>
      <TableCell sx={{ width: 40, color: 'text.secondary' }}>{line.lineNo}</TableCell>

      <TableCell sx={{ minWidth: 180 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {line.rawText}
        </Typography>
        {(line.name || line.sameAsAbove) && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
            {line.sameAsAbove ? `Như trên${familyName ? ` (${familyName})` : ''}` : line.name}
            {line.unitText ? ` · ${line.unitText}` : ''}
          </Typography>
        )}
        {line.issues.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {line.issues.map((issue) => (
              <Chip
                key={issue}
                size="small"
                variant="soft"
                color={issue === 'unit_converted' || issue === 'number_corrected' ? 'info' : 'warning'}
                label={issueLabel(issue)}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            ))}
          </Stack>
        )}
      </TableCell>

      <TableCell align="right" sx={{ width: 96 }}>
        <NumberCell value={line.quantity} disabled={!editable || skipped || busy} onCommit={(quantity) => onSave({ quantity })} />
      </TableCell>
      <TableCell align="right" sx={{ width: 120 }}>
        <NumberCell value={line.unitPrice} disabled={!editable || skipped || busy} onCommit={(unitPrice) => onSave({ unitPrice })} />
      </TableCell>
      <TableCell align="right" sx={{ width: 130 }}>
        <NumberCell
          value={line.lineTotal}
          warn={hasNumberIssue(line)}
          disabled={!editable || skipped || busy}
          onCommit={(lineTotal) => onSave({ lineTotal })}
        />
      </TableCell>

      <TableCell sx={{ minWidth: 300 }}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Label color={LINE_STATUS[line.status].color}>{LINE_STATUS[line.status].label}</Label>
            {chosen && !changing && (
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                <strong>{chosen.code}</strong> — {chosen.name}
              </Typography>
            )}
            {line.productId && !chosen && !changing && (
              <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>
                Đã chọn mã
              </Typography>
            )}
            {busy && <CircularProgress size={16} />}
            {editable && !skipped && line.productId && (
              <Button size="small" color="inherit" onClick={() => setChanging((v) => !v)}>
                {changing ? 'Giữ mã này' : 'Đổi'}
              </Button>
            )}
          </Stack>

          {chosen && !changing && line.status === 'Matched' && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {chosen.reason}
            </Typography>
          )}

          {showChoices && (
            <>
              {line.candidates
                .filter((c) => c.productId !== line.productId)
                .slice(0, 3)
                .map((c, index) => (
                  <Box
                    key={c.productId}
                    sx={{
                      p: 1,
                      gap: 1,
                      display: 'flex',
                      borderRadius: 1,
                      alignItems: 'center',
                      border: (theme) => `1px dashed ${theme.palette.divider}`,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        {index === 0 && c.productId === line.suggestedProductId && (
                          <Box component="span" sx={{ color: 'warning.main', mr: 0.5 }}>
                            Có thể là
                          </Box>
                        )}
                        <strong>{c.code}</strong> — {c.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {c.reason}
                        {c.lastUnitPrice ? ` · giá nhập gần nhất ${fCurrency(c.lastUnitPrice)}` : ''} ·{' '}
                        {Math.round(c.score * 100)}%
                      </Typography>
                    </Box>
                    <Button size="small" variant="soft" color="primary" disabled={busy} onClick={() => pick(c.productId)}>
                      Chọn
                    </Button>
                  </Box>
                ))}

              <Stack direction="row" spacing={1} alignItems="center">
                <PurchaseImportProductPicker
                  defaultKeyword={keyword}
                  disabled={busy}
                  onPick={(product) => pick(product.id)}
                />
                {canCreateProduct && (
                  <Tooltip title="Tạo mã mới với tên và giá nhập của dòng này">
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={busy}
                      onClick={onCreateProduct}
                      startIcon={<Iconify icon="mingcute:add-line" />}
                      sx={{ flexShrink: 0 }}
                    >
                      Tạo mã
                    </Button>
                  </Tooltip>
                )}
              </Stack>
            </>
          )}
        </Stack>
      </TableCell>

      <TableCell sx={{ width: 48 }}>
        {editable && (
          <Tooltip title={skipped ? 'Lấy lại dòng' : 'Bỏ dòng (không nhập)'}>
            <span>
              <IconButton size="small" disabled={busy} onClick={() => onSave({ skip: !skipped })}>
                <Iconify icon={skipped ? 'solar:undo-left-round-bold' : 'solar:trash-bin-minimalistic-linear'} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}

// ----------------------------------------------------------------------

type NumberCellProps = {
  value?: number | null;
  disabled: boolean;
  warn?: boolean;
  onCommit: (value: number) => void;
};

/** Ô số sửa tại chỗ: lưu khi rời ô / Enter, chỉ khi giá trị đổi và > 0. */
function NumberCell({ value, disabled, warn, onCommit }: NumberCellProps) {
  const [text, setText] = useState(value != null ? String(value) : '');

  useEffect(() => setText(value != null ? String(value) : ''), [value]);

  if (disabled) {
    return (
      <Typography variant="body2" sx={{ color: warn ? 'warning.main' : undefined, py: 0.75 }}>
        {value != null ? fNumber(value) : '—'}
      </Typography>
    );
  }

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
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
      helperText={value != null && value >= 1000 ? fNumber(value) : undefined}
    />
  );
}
