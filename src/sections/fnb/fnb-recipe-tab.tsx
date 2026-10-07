'use client';

import type { IFnbRecipeBook, IFnbRecipeItem, IFnbRecipeLine, FnbServiceScope } from 'src/types/fnb';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { getFnbRecipes, setFnbRecipe } from 'src/api/fnb';

import { itemTitle, recipeCost, recipeError, SCOPE_LABEL, marginPercent } from './lib/recipe';

// ----------------------------------------------------------------------
// Định lượng của từng size / món / món thêm: lượng nguyên liệu (đơn vị gốc: g, ml, cái…) cho MỘT phần. Gửi bar là trừ
// kho nguyên liệu theo định lượng; huỷ món chưa pha thì hoàn lại. Bao bì (ly nhựa, nắp, ống hút) khai "Mang về".
// ----------------------------------------------------------------------

export default function FnbRecipeTab({ branchId }: { branchId: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const [book, setBook] = useState<IFnbRecipeBook | null>(null);
  const [editing, setEditing] = useState<IFnbRecipeItem | null>(null);

  const load = useCallback(async () => {
    try {
      setBook(await getFnbRecipes(branchId));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được định lượng'), { variant: 'error' });
      setBook({ items: [], ingredients: [] });
    }
  }, [branchId, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const missing = book?.items.filter((i) => i.lines.length === 0).length ?? 0;

  if (!book) return null;

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Khai lượng nguyên liệu cho MỘT phần theo đơn vị gốc (g, ml, cái). Gửi bar sẽ trừ kho nguyên liệu theo định lượng;
        huỷ món chưa pha thì hoàn lại. Bao bì (ly nhựa, nắp, ống hút) chọn &quot;Mang về&quot;.
        {missing > 0 && ` Còn ${missing} món / size chưa có định lượng — bán vẫn được nhưng không trừ kho.`}
      </Alert>
      {book.ingredients.length === 0 && (
        <Alert severity="warning">
          Chưa có nguyên liệu. Tạo hàng hoá với Loại mặt hàng = Nguyên liệu (hoặc Bán thành phẩm) rồi quay lại.
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Món</TableCell>
                <TableCell align="right">Giá bán</TableCell>
                <TableCell align="right">Giá vốn tại chỗ</TableCell>
                <TableCell align="right">Giá vốn mang về</TableCell>
                <TableCell align="right">Lãi gộp</TableCell>
                <TableCell>Định lượng</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {book.items.map((item) => {
                const margin = marginPercent(item.price, item.costDineIn);
                return (
                  <TableRow key={item.productId} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2">{itemTitle(item)}</Typography>
                        {item.isTopping && <Chip size="small" label="Món thêm" />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{fCurrency(item.price)}</TableCell>
                    <TableCell align="right">{item.costDineIn == null ? '—' : fCurrency(item.costDineIn)}</TableCell>
                    <TableCell align="right">{item.costTakeaway == null ? '—' : fCurrency(item.costTakeaway)}</TableCell>
                    <TableCell align="right">
                      {margin == null ? '—' : (
                        <Typography variant="body2" color={margin < 50 ? 'warning.main' : 'success.main'}>
                          {margin}%
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.lines.length === 0 ? (
                        <Chip size="small" color="warning" variant="outlined" label="Chưa khai" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {item.lines.length} nguyên liệu
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => setEditing(item)} disabled={book.ingredients.length === 0}>
                        Sửa
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {book.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      Thực đơn chi nhánh chưa có món.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <FnbRecipeDialog
        book={book}
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </Stack>
  );
}

// ----------------------------------------------------------------------

type DialogProps = { book: IFnbRecipeBook; item: IFnbRecipeItem | null; onClose: VoidFunction; onSaved: VoidFunction };

function FnbRecipeDialog({ book, item, onClose, onSaved }: DialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [lines, setLines] = useState<IFnbRecipeLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) setLines(item.lines.map((l) => ({ ...l })));
  }, [item]);

  const ingredients = useMemo(() => new Map(book.ingredients.map((i) => [i.id, i])), [book.ingredients]);
  const others = book.items.filter((i) => i.productId !== item?.productId && i.lines.length > 0);
  const error = recipeError(lines);
  const costDineIn = recipeCost(lines, ingredients, false);
  const costTakeaway = recipeCost(lines, ingredients, true);

  const update = (index: number, patch: Partial<IFnbRecipeLine>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const save = async () => {
    if (!item || error) return;
    setSaving(true);
    try {
      await setFnbRecipe(item.productId, lines);
      enqueueSnackbar(`Đã lưu định lượng ${itemTitle(item)}`);
      onSaved();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được định lượng'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" open={!!item} onClose={saving ? undefined : onClose}>
      <DialogTitle>Định lượng · {item ? itemTitle(item) : ''}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {others.length > 0 && (
            <TextField
              select
              size="small"
              label="Chép từ món / size khác"
              value=""
              onChange={(e) => {
                const source = others.find((o) => o.productId === e.target.value);
                if (source) setLines(source.lines.map((l) => ({ ...l })));
              }}
              sx={{ maxWidth: 360 }}
            >
              {others.map((o) => (
                <MenuItem key={o.productId} value={o.productId}>
                  {itemTitle(o)}
                </MenuItem>
              ))}
            </TextField>
          )}

          {lines.map((line, index) => {
            const ingredient = ingredients.get(line.ingredientId) ?? null;
            return (
              <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Autocomplete
                  size="small"
                  sx={{ flex: 2, minWidth: 220 }}
                  options={book.ingredients}
                  value={ingredient}
                  getOptionLabel={(o) => o.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  onChange={(_, value) => update(index, { ingredientId: value?.id ?? '' })}
                  renderOption={(props, o) => (
                    <li {...props} key={o.id}>
                      <Stack>
                        <Typography variant="body2">{o.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {o.unit ?? 'đơn vị gốc'} · tồn {o.onHand.toLocaleString('vi-VN')}
                          {o.unitCost != null ? ` · ${fCurrency(o.unitCost)}/${o.unit ?? 'đv'}` : ' · chưa có giá vốn'}
                        </Typography>
                      </Stack>
                    </li>
                  )}
                  renderInput={(params) => <TextField {...params} label="Nguyên liệu" />}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Lượng / phần"
                  value={Number.isFinite(line.quantity) ? line.quantity : ''}
                  onChange={(e) => update(index, { quantity: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{ingredient?.unit ?? ''}</InputAdornment>,
                  }}
                  sx={{ flex: 1, minWidth: 140 }}
                />
                <TextField
                  select
                  size="small"
                  label="Áp cho"
                  value={line.serviceScope}
                  onChange={(e) => update(index, { serviceScope: e.target.value as FnbServiceScope })}
                  sx={{ width: 140 }}
                >
                  {(Object.keys(SCOPE_LABEL) as FnbServiceScope[]).map((s) => (
                    <MenuItem key={s} value={s}>
                      {SCOPE_LABEL[s]}
                    </MenuItem>
                  ))}
                </TextField>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, textAlign: 'right' }}>
                  {ingredient?.unitCost != null && line.quantity > 0 ? fCurrency(Math.round(ingredient.unitCost * line.quantity)) : ''}
                </Typography>
                <IconButton color="error" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
                  <Iconify icon="solar:trash-bin-trash-bold" />
                </IconButton>
              </Stack>
            );
          })}

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Button
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => setLines((prev) => [...prev, { ingredientId: '', quantity: 0, serviceScope: 'All' }])}
            >
              Thêm nguyên liệu
            </Button>
            <Typography variant="body2">
              Giá vốn: tại chỗ {costDineIn == null ? '—' : fCurrency(costDineIn)} · mang về{' '}
              {costTakeaway == null ? '—' : fCurrency(costTakeaway)}
            </Typography>
          </Stack>
          {lines.length > 0 && error && <Alert severity="warning">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!!error} onClick={save}>
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
