'use client';

import { useMemo, useState, useEffect } from 'react';

import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
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

import { getAllCategories } from 'src/api/categories';
import { createPurchaseImportProducts } from 'src/api/purchase-imports';

import type { ICategory } from 'src/types/corecms-api';
import type { IPurchaseImport, IPurchaseImportLine } from 'src/types/purchase-import';

import { parseAmount, importErrorMessage } from './purchase-import-utils';

// ----------------------------------------------------------------------
// Tạo mã mới cho các dòng đã tích (hàng chưa có trong danh mục). Tên mặc định theo cách đặt tên của cửa hàng
// "{nhóm} - {giá bán theo nghìn}" (vd "Bờm tóc - 40"), giá bán gợi ý ≈ 2 lần giá nhập — sửa được từng dòng. Danh mục để
// trống = máy chủ lấy danh mục hay gặp của các mã gợi ý trên hoá đơn. Mã tự sinh (SP…).
// ----------------------------------------------------------------------

type Row = { lineNo: number; name: string; nameEdited: boolean; salePrice: string; unit: string };

type Props = {
  open: boolean;
  item: IPurchaseImport;
  lineNos: number[];
  /** Tên nhóm của dòng (dòng "như trên" lấy tên dòng có tên phía trên). */
  familyName: (line: IPurchaseImportLine) => string;
  zIndex: number;
  onClose: () => void;
  onCreated: (next: IPurchaseImport, createdLineNos: number[]) => void;
};

/** Giá bán gợi ý: gấp đôi giá nhập, làm tròn lên nghìn. */
export function suggestSalePrice(unitPrice?: number | null): number | null {
  if (!unitPrice || unitPrice <= 0) return null;
  return Math.ceil((unitPrice * 2) / 1000) * 1000;
}

/** "Lô dính" + 15.000 → "Lô dính - 15". */
export function suggestProductName(family: string, salePrice: number | null): string {
  const base = family.trim() || 'Hàng mới';
  return salePrice ? `${base} - ${Math.round(salePrice / 1000)}` : base;
}

export default function PurchaseImportNewProductsDialog({
  open,
  item,
  lineNos,
  familyName,
  zIndex,
  onClose,
  onCreated,
}: Props) {
  const lines = useMemo(
    () => item.lines.filter((l) => lineNos.includes(l.lineNo)),
    [item.lines, lineNos]
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLineErrors({});
    setRows(
      lines.map((line) => {
        const price = suggestSalePrice(line.unitPrice);
        return {
          lineNo: line.lineNo,
          name: suggestProductName(familyName(line), price),
          nameEdited: false,
          salePrice: price ? String(price) : '',
          unit: '',
        };
      })
    );
  }, [open, lines, familyName]);

  useEffect(() => {
    if (!open || categories.length > 0) return;
    getAllCategories()
      .then((list) => setCategories([...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'))))
      .catch(() => setCategories([]));
  }, [open, categories.length]);

  const update = (lineNo: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => {
        if (row.lineNo !== lineNo) return row;
        const next = { ...row, ...patch };
        // Đổi giá bán mà chưa sửa tên tay → tên theo giá mới.
        if (patch.salePrice !== undefined && !next.nameEdited) {
          const line = lines.find((l) => l.lineNo === lineNo);
          if (line) next.name = suggestProductName(familyName(line), parseAmount(patch.salePrice));
        }
        return next;
      })
    );

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const response = await createPurchaseImportProducts(
        item.id,
        rows.map((row) => ({
          lineNo: row.lineNo,
          name: row.name.trim(),
          salePrice: parseAmount(row.salePrice) ?? 0,
          categoryId: categoryId || null,
          unit: row.unit.trim() || null,
        }))
      );
      const failed = Object.fromEntries(
        response.results.filter((r) => r.error).map((r) => [r.lineNo, r.error!])
      );
      const created = response.results.filter((r) => !r.error).map((r) => r.lineNo);
      onCreated(response.import, created);
      if (Object.keys(failed).length === 0) {
        onClose();
      } else {
        setLineErrors(failed);
        setRows((current) => current.filter((row) => failed[row.lineNo]));
      }
    } catch (err) {
      setError(importErrorMessage(err, 'Không tạo được mã mới (cần quyền tạo sản phẩm).'));
    } finally {
      setWorking(false);
    }
  };

  const invalid = rows.some((row) => !row.name.trim() || parseAmount(row.salePrice) == null);

  return (
    <Dialog
      open={open}
      onClose={working ? undefined : onClose}
      maxWidth="md"
      fullWidth
      sx={{ zIndex }}
    >
      <DialogTitle>Tạo {rows.length} mã mới từ hoá đơn</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            size="small"
            label="Danh mục"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            SelectProps={{ MenuProps: { sx: { zIndex: zIndex + 100 } } }}
            helperText="Để trống: lấy danh mục hay gặp của các mã gợi ý trên hoá đơn."
          >
            <MenuItem value="">Tự chọn theo mã gần giống</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.parentCategoryName ? `${c.parentCategoryName} › ${c.name}` : c.name}
              </MenuItem>
            ))}
          </TextField>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}>Dòng</TableCell>
                <TableCell>Trên hoá đơn</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Tên mã mới</TableCell>
                <TableCell sx={{ width: 130 }}>Giá bán</TableCell>
                <TableCell sx={{ width: 90 }}>Đơn vị</TableCell>
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
                        error={!row.name.trim() || !!lineErrors[row.lineNo]}
                        helperText={lineErrors[row.lineNo]}
                        onChange={(e) =>
                          update(row.lineNo, { name: e.target.value, nameEdited: true })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.salePrice}
                        error={parseAmount(row.salePrice) == null}
                        onChange={(e) => update(row.lineNo, { salePrice: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="Cái"
                        value={row.unit}
                        onChange={(e) => update(row.lineNo, { unit: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary">
            Mã tự sinh (SP…). Tạo xong, mã mới được chốt cho dòng và hệ thống ghi nhớ chữ trên hoá
            đơn của NCC này khi tạo phiếu nhập. Giá trên hoá đơn có thể theo tá / chục — kiểm giá
            bán trước khi tạo.
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
          Tạo {rows.length} mã
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
