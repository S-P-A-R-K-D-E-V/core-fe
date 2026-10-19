'use client';

import { useMemo, useState, useEffect } from 'react';

import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { fCurrency } from 'src/utils/format-number';

import { updatePurchaseImportLine } from 'src/api/purchase-imports';

import type { IPurchaseImport, IPurchaseImportLine } from 'src/types/purchase-import';

import { parseAmount, importErrorMessage } from './purchase-import-utils';

// ----------------------------------------------------------------------
// Đặt mã mới cho các dòng đã tích (hàng chưa có trong danh mục): tên mặc định là tên hàng trên hoá đơn — KHÔNG kèm số
// (số trên toa là số lượng / đơn giá, đưa vào tên sẽ sai) — giá bán tuỳ chọn. Chỉ ghi lên dòng; mã thật được tạo (SP…)
// khi bấm "Tạo phiếu nhập", trống giá bán thì lấy gấp đôi giá nhập.
// ----------------------------------------------------------------------

type Row = { lineNo: number; name: string; salePrice: string };

type Props = {
  open: boolean;
  item: IPurchaseImport;
  lineNos: number[];
  /** Tên hàng của dòng (dòng "như trên" lấy tên dòng có tên phía trên). */
  familyName: (line: IPurchaseImportLine) => string;
  zIndex: number;
  onClose: () => void;
  onSaved: (next: IPurchaseImport, savedLineNos: number[]) => void;
};

export default function PurchaseImportNewProductsDialog({
  open,
  item,
  lineNos,
  familyName,
  zIndex,
  onClose,
  onSaved,
}: Props) {
  const lines = useMemo(
    () => item.lines.filter((l) => lineNos.includes(l.lineNo)),
    [item.lines, lineNos]
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setRows(lines.map((line) => ({ lineNo: line.lineNo, name: familyName(line), salePrice: '' })));
  }, [open, lines, familyName]);

  const update = (lineNo: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.lineNo === lineNo ? { ...row, ...patch } : row))
    );

  const submit = async () => {
    setWorking(true);
    setError(null);
    const saved: number[] = [];
    let latest: IPurchaseImport | null = null;
    try {
      // eslint-disable-next-line no-restricted-syntax
      for (const row of rows) {
        // eslint-disable-next-line no-await-in-loop
        latest = await updatePurchaseImportLine(item.id, row.lineNo, {
          newProductName: row.name.trim(),
          newProductSalePrice: parseAmount(row.salePrice),
        });
        saved.push(row.lineNo);
      }
      onSaved(latest!, saved);
      onClose();
    } catch (err) {
      if (latest) onSaved(latest, saved);
      setRows((current) => current.filter((row) => !saved.includes(row.lineNo)));
      setError(importErrorMessage(err, 'Chưa đặt được mã mới cho dòng.'));
    } finally {
      setWorking(false);
    }
  };

  const invalid = rows.some(
    (row) => !row.name.trim() || (row.salePrice.trim() !== '' && parseAmount(row.salePrice) == null)
  );

  return (
    <Dialog
      open={open}
      onClose={working ? undefined : onClose}
      maxWidth="md"
      fullWidth
      sx={{ zIndex }}
    >
      <DialogTitle>Đặt mã mới cho {rows.length} dòng</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}>Dòng</TableCell>
                <TableCell>Trên hoá đơn</TableCell>
                <TableCell sx={{ minWidth: 220 }}>Tên sản phẩm mới</TableCell>
                <TableCell sx={{ width: 150 }}>Giá bán (tuỳ chọn)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const line = lines.find((l) => l.lineNo === row.lineNo);
                return (
                  <TableRow key={row.lineNo} sx={{ verticalAlign: 'top' }}>
                    <TableCell>{row.lineNo}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {line?.rawText}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {line?.quantity ?? '?'} ×{' '}
                        {line?.unitPrice != null ? fCurrency(line.unitPrice) : '?'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        value={row.name}
                        error={!row.name.trim()}
                        onChange={(e) => update(row.lineNo, { name: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.salePrice}
                        placeholder={
                          line?.unitPrice
                            ? `≈ ${fCurrency(Math.ceil((line.unitPrice * 2) / 1000) * 1000)}`
                            : undefined
                        }
                        error={row.salePrice.trim() !== '' && parseAmount(row.salePrice) == null}
                        onChange={(e) => update(row.lineNo, { salePrice: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary">
            Mã thật (SP…) được tạo khi bấm <strong>Tạo phiếu nhập</strong> — danh mục theo các mã
            gần giống, trống giá bán thì lấy gấp đôi giá nhập (sửa sau trong Sản phẩm). Hệ thống ghi
            nhớ chữ trên hoá đơn của NCC này = mã mới.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={working} onClick={onClose}>
          Thôi
        </Button>
        <LoadingButton
          variant="contained"
          loading={working}
          disabled={rows.length === 0 || invalid}
          onClick={submit}
        >
          Đặt mã mới
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
