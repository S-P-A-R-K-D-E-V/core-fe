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

import type {
  IPurchaseImport,
  IPurchaseImportLine,
  IUpdatePurchaseImportLineRequest,
} from 'src/types/purchase-import';

import {
  parseAmount,
  perPieceCost,
  receiptUnitCost,
  suggestSalePrice,
  importErrorMessage,
} from './purchase-import-utils';

// ----------------------------------------------------------------------
// Đặt mã mới cho các dòng đã tích (hàng chưa có trong danh mục). Tên mặc định là tên hàng trên hoá đơn — KHÔNG kèm số
// (số trên toa là số lượng / đơn giá). "Tên chung cho cả nhóm" đặt một tên cho mọi dòng: các dòng cùng tên là một nhóm,
// mỗi giá bán là một mã (mã gốc + mã con như danh mục KiotViet, vd "Lô dính - 15", "Lô dính - 20"). Hàng theo gói: ghi
// số cái kho đếm được → giá nhập mỗi cái = thành tiền ÷ số cái, giá bán trống thì gấp đôi giá đó. Chỉ ghi lên dòng; mã
// thật được tạo khi bấm "Tạo phiếu nhập".
// ----------------------------------------------------------------------

type Row = { lineNo: number; name: string; salePrice: string; counted: string };

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

const groupKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');

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
  const [groupName, setGroupName] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setGroupName('');
    setRows(
      lines.map((line) => ({
        lineNo: line.lineNo,
        name: familyName(line),
        salePrice: '',
        counted: line.countedQuantity ? String(line.countedQuantity) : '',
      }))
    );
  }, [open, lines, familyName]);

  const update = (lineNo: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.lineNo === lineNo ? { ...row, ...patch } : row))
    );

  const lineOf = (row: Row) => lines.find((l) => l.lineNo === row.lineNo);
  const costOf = (row: Row) => {
    const line = lineOf(row);
    if (!line) return null;
    return perPieceCost(line, parseAmount(row.counted)) ?? receiptUnitCost(line);
  };
  const priceOf = (row: Row) => parseAmount(row.salePrice) ?? suggestSalePrice(costOf(row));

  // Xem trước: mỗi tên là một nhóm, mỗi giá bán trong nhóm là một mã.
  const groups = new Map<string, { name: string; prices: Set<number> }>();
  rows.forEach((row) => {
    const name = row.name.trim().replace(/\s+/g, ' ');
    if (!name) return;
    const group = groups.get(groupKey(name)) ?? { name, prices: new Set<number>() };
    const price = priceOf(row);
    if (price) group.prices.add(price);
    groups.set(groupKey(name), group);
  });
  const preview = Array.from(groups.values()).map((g) => ({
    name: g.name,
    prices: Array.from(g.prices).sort((a, b) => a - b),
  }));

  const submit = async () => {
    setWorking(true);
    setError(null);
    const saved: number[] = [];
    let latest: IPurchaseImport | null = null;
    try {
      // eslint-disable-next-line no-restricted-syntax
      for (const row of rows) {
        const line = lineOf(row);
        const counted = parseAmount(row.counted);
        const patch: IUpdatePurchaseImportLineRequest = {
          newProductName: row.name.trim(),
          newProductSalePrice: parseAmount(row.salePrice),
        };
        if (counted) patch.countedQuantity = counted;
        else if (line?.countedQuantity) patch.countedQuantity = 0;
        // eslint-disable-next-line no-await-in-loop
        latest = await updatePurchaseImportLine(item.id, row.lineNo, patch);
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
    (row) =>
      !row.name.trim() ||
      (row.salePrice.trim() !== '' && parseAmount(row.salePrice) == null) ||
      (row.counted.trim() !== '' && parseAmount(row.counted) == null)
  );

  return (
    <Dialog
      open={open}
      onClose={working ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      sx={{ zIndex }}
    >
      <DialogTitle>Đặt mã mới cho {rows.length} dòng</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {rows.length > 1 && (
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                label="Tên chung cho cả nhóm (tuỳ chọn)"
                placeholder="vd Lô dính"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                sx={{ flex: 1, maxWidth: 420 }}
              />
              <Button
                size="small"
                variant="outlined"
                disabled={!groupName.trim()}
                onClick={() =>
                  setRows((current) => current.map((row) => ({ ...row, name: groupName })))
                }
              >
                Đặt cho {rows.length} dòng
              </Button>
            </Stack>
          )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}>Dòng</TableCell>
                <TableCell>Trên hoá đơn</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Tên sản phẩm mới</TableCell>
                <TableCell sx={{ width: 120 }}>Số cái đếm được</TableCell>
                <TableCell sx={{ width: 110 }}>Giá nhập/cái</TableCell>
                <TableCell sx={{ width: 150 }}>Giá bán (tuỳ chọn)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const line = lineOf(row);
                const cost = costOf(row);
                const suggested = suggestSalePrice(cost);
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
                        value={row.counted}
                        placeholder="theo gói"
                        error={row.counted.trim() !== '' && parseAmount(row.counted) == null}
                        onChange={(e) => update(row.lineNo, { counted: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ pt: 1 }}>
                        {cost != null ? fCurrency(cost) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={row.salePrice}
                        placeholder={suggested ? `≈ ${fCurrency(suggested)}` : undefined}
                        error={row.salePrice.trim() !== '' && parseAmount(row.salePrice) == null}
                        onChange={(e) => update(row.lineNo, { salePrice: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {preview.length > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Sẽ tạo khi tạo phiếu nhập</Typography>
              {preview.map((group) => (
                <Typography key={group.name} variant="body2">
                  <strong>«{group.name}»</strong> —{' '}
                  {group.prices.length > 1
                    ? `nhóm ${group.prices.length} mã (mã gốc + ${group.prices.length - 1} mã con): `
                    : '1 mã: '}
                  {group.prices.map((p) => fCurrency(p)).join(' · ') || 'giá bán gấp đôi giá nhập'}
                </Typography>
              ))}
            </Stack>
          )}
          <Typography variant="caption" color="text.secondary">
            Mã thật (SP…) được tạo khi bấm <strong>Tạo phiếu nhập</strong> — cùng tên là một nhóm,
            mỗi giá bán một mã; dòng cùng giá dùng chung mã. Danh mục theo các mã gần giống, trống
            giá bán thì lấy gấp đôi giá nhập mỗi cái (sửa sau trong Sản phẩm). Hệ thống ghi nhớ chữ
            trên hoá đơn của NCC này = mã mới.
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
