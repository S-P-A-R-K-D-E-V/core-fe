'use client';

import type { IFnbBatchRecipeBook, IFnbBatchRecipeItem, IFnbBatchRecipeLine } from 'src/types/fnb';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
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

import { setFnbBatchRecipe, getFnbBatchRecipes } from 'src/api/fnb';

import { fQty } from './lib/stock';
import { linesCost, batchRecipeError } from './lib/batch';

// ----------------------------------------------------------------------
// Công thức mẻ của bán thành phẩm (cold brew, syrup, kem muối, trân châu nấu sẵn…): nguyên liệu cho MỘT mẻ, sản lượng
// một mẻ, số ngày bảo quản. Pha mẻ (trang Kho nguyên liệu → Pha mẻ) trừ nguyên liệu và cộng bán thành phẩm thành lô có hạn.
// ----------------------------------------------------------------------

export default function FnbBatchRecipeTab({ branchId }: { branchId: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const [book, setBook] = useState<IFnbBatchRecipeBook | null>(null);
  const [editing, setEditing] = useState<IFnbBatchRecipeItem | null>(null);

  const load = useCallback(async () => {
    try {
      setBook(await getFnbBatchRecipes(branchId));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được công thức mẻ'), { variant: 'error' });
      setBook({ items: [], ingredients: [] });
    }
  }, [branchId, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  if (!book) return null;

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Bán thành phẩm là thứ quán tự làm sẵn cả mẻ rồi dùng dần (cold brew, syrup, kem muối…). Khai nguyên liệu cho MỘT
        mẻ theo đơn vị gốc, sản lượng một mẻ và số ngày bảo quản. Mỗi lần pha mẻ sẽ trừ nguyên liệu, cộng bán thành phẩm
        thành một lô có hạn dùng.
      </Alert>
      {book.items.length === 0 && (
        <Alert severity="warning">
          Chưa có bán thành phẩm. Tạo hàng hoá với Loại mặt hàng = Bán thành phẩm (đơn vị gốc ml, g…) rồi quay lại.
        </Alert>
      )}

      {book.items.length > 0 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Bán thành phẩm</TableCell>
                  <TableCell align="right">Sản lượng / mẻ</TableCell>
                  <TableCell align="right">Bảo quản</TableCell>
                  <TableCell align="right">Giá vốn / mẻ</TableCell>
                  <TableCell align="right">Giá vốn / đơn vị</TableCell>
                  <TableCell>Nguyên liệu</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {book.items.map((item) => (
                  <TableRow key={item.productId} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{item.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.code} · tồn {fQty(item.onHand)} {item.unit ?? ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {item.yieldQuantity == null ? '—' : `${fQty(item.yieldQuantity)} ${item.unit ?? ''}`}
                    </TableCell>
                    <TableCell align="right">
                      {item.shelfLifeDays == null
                        ? '—'
                        : item.shelfLifeDays === 0
                          ? 'Trong ngày'
                          : `${item.shelfLifeDays} ngày`}
                    </TableCell>
                    <TableCell align="right">{item.batchCost == null ? '—' : fCurrency(item.batchCost)}</TableCell>
                    <TableCell align="right">
                      {item.recipeUnitCost == null
                        ? '—'
                        : `${fCurrency(Math.round(item.recipeUnitCost * 100) / 100)}/${item.unit ?? 'đv'}`}
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
                      <Button size="small" onClick={() => setEditing(item)}>
                        Sửa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <FnbBatchRecipeDialog
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

type DialogProps = {
  book: IFnbBatchRecipeBook;
  item: IFnbBatchRecipeItem | null;
  onClose: VoidFunction;
  onSaved: VoidFunction;
};

function FnbBatchRecipeDialog({ book, item, onClose, onSaved }: DialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [lines, setLines] = useState<IFnbBatchRecipeLine[]>([]);
  const [yieldQuantity, setYieldQuantity] = useState(0);
  const [shelfLife, setShelfLife] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setLines(item.lines.map((l) => ({ ...l })));
    setYieldQuantity(item.yieldQuantity ?? 0);
    setShelfLife(item.shelfLifeDays == null ? '' : String(item.shelfLifeDays));
    setNote(item.note ?? '');
  }, [item]);

  const ingredients = useMemo(() => new Map(book.ingredients.map((i) => [i.id, i])), [book.ingredients]);
  const options = useMemo(
    () => book.ingredients.filter((i) => i.id !== item?.productId),
    [book.ingredients, item?.productId]
  );
  const shelfLifeDays = shelfLife.trim() === '' ? null : Number(shelfLife);
  const error = item ? batchRecipeError(item.productId, lines, yieldQuantity, shelfLifeDays) : null;
  const cost = linesCost(lines, ingredients);
  const unit = item?.unit ?? '';

  const update = (index: number, patch: Partial<IFnbBatchRecipeLine>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const save = async () => {
    if (!item || error) return;
    setSaving(true);
    try {
      await setFnbBatchRecipe(item.productId, { yieldQuantity, shelfLifeDays, note: note.trim() || null, lines });
      enqueueSnackbar(lines.length === 0 ? `Đã bỏ công thức mẻ ${item.name}` : `Đã lưu công thức mẻ ${item.name}`);
      onSaved();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được công thức mẻ'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" open={!!item} onClose={saving ? undefined : onClose}>
      <DialogTitle>Công thức mẻ · {item?.name ?? ''}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="number"
              label="Sản lượng một mẻ"
              value={Number.isFinite(yieldQuantity) && yieldQuantity !== 0 ? yieldQuantity : ''}
              onChange={(e) => setYieldQuantity(Number(e.target.value))}
              inputProps={{ min: 0, step: 'any' }}
              InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
              helperText="Lượng thành phẩm thu được sau khi pha xong một mẻ"
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="number"
              label="Bảo quản (ngày)"
              value={shelfLife}
              onChange={(e) => setShelfLife(e.target.value)}
              inputProps={{ min: 0, max: 365, step: 1 }}
              helperText="0 = dùng trong ngày; bỏ trống = không ghi hạn"
              sx={{ flex: 1 }}
            />
          </Stack>

          <Typography variant="subtitle2">Nguyên liệu cho một mẻ</Typography>
          {lines.map((line, index) => {
            const ingredient = ingredients.get(line.ingredientId) ?? null;
            return (
              <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Autocomplete
                  size="small"
                  sx={{ flex: 2, minWidth: 220 }}
                  options={options}
                  value={ingredient}
                  getOptionLabel={(o) => o.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  onChange={(_, value) => update(index, { ingredientId: value?.id ?? '' })}
                  renderOption={(props, o) => (
                    <li {...props} key={o.id}>
                      <Stack>
                        <Typography variant="body2">{o.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {o.unit ?? 'đơn vị gốc'} · tồn {fQty(o.onHand)}
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
                  label="Lượng / mẻ"
                  value={Number.isFinite(line.quantity) && line.quantity !== 0 ? line.quantity : ''}
                  onChange={(e) => update(index, { quantity: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{ingredient?.unit ?? ''}</InputAdornment>,
                  }}
                  sx={{ flex: 1, minWidth: 140 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, textAlign: 'right' }}>
                  {ingredient?.unitCost != null && line.quantity > 0
                    ? fCurrency(Math.round(ingredient.unitCost * line.quantity))
                    : ''}
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
              onClick={() => setLines((prev) => [...prev, { ingredientId: '', quantity: 0 }])}
            >
              Thêm nguyên liệu
            </Button>
            {cost != null && (
              <Typography variant="body2">
                Giá vốn một mẻ {fCurrency(cost)}
                {yieldQuantity > 0 && ` · ${fCurrency(Math.round((cost / yieldQuantity) * 100) / 100)}/${unit || 'đv'}`}
              </Typography>
            )}
          </Stack>

          <TextField
            size="small"
            label="Ghi chú cách pha (không bắt buộc)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ maxLength: 500 }}
          />

          {lines.length === 0 && item?.lines.length ? (
            <Alert severity="warning">Không còn nguyên liệu nào — lưu sẽ bỏ công thức mẻ.</Alert>
          ) : null}
          {error && <Alert severity="warning">{error}</Alert>}
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
