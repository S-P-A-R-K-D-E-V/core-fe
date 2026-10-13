'use client';

import type { IFnbBatch, IFnbBatchRecipeBook, IFnbBatchRecipeLine, IFnbBatchRecipeItem } from 'src/types/fnb';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
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
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getFnbBatches, cancelFnbBatch, createFnbBatch, getFnbBatchRecipes } from 'src/api/fnb';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { newId } from 'src/sections/fnb-pos/lib/ids';
import FnbBranchNotice from 'src/sections/fnb-pos/fnb-branch-notice';
import { useFnbBranches } from 'src/sections/fnb-pos/use-fnb-branches';

import { fQty } from './lib/stock';
import { fDay } from './lib/documents';
import { linesCost, scaleLines, defaultExpiry, canCancelBatch, OWN_CANCEL_MINUTES } from './lib/batch';

// ----------------------------------------------------------------------
// Pha mẻ bán thành phẩm: nhân viên bấm "Pha mẻ" → trừ nguyên liệu theo công thức mẻ × số mẻ (sửa được lượng thật), cộng
// bán thành phẩm thành một lô mới có hạn = hôm nay + số ngày bảo quản. Phiếu ghi kho ngay; huỷ phiếu ghi ngược.
// ----------------------------------------------------------------------

/** Ngày theo giờ máy (Việt Nam) dạng yyyy-MM-dd. */
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const PERIODS = [
  { days: 1, label: 'Hôm nay' },
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
] as const;

const fTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

export default function FnbBatchesView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const manager = ['Admin', 'Manager'].some((r) => user?.role === r || (user?.roles ?? []).includes(r));
  const { branchId } = useFnbBranches();

  const [days, setDays] = useState<number>(7);
  const [batches, setBatches] = useState<IFnbBatch[] | null>(null);
  const [book, setBook] = useState<IFnbBatchRecipeBook | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<IFnbBatch | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    try {
      const [list, recipes] = await Promise.all([
        getFnbBatches(branchId, start.toISOString()),
        getFnbBatchRecipes(branchId),
      ]);
      setBatches(list);
      setBook(recipes);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được phiếu pha'), { variant: 'error' });
      setBatches([]);
    }
  }, [branchId, days, enqueueSnackbar]);

  useEffect(() => {
    setBatches(null);
    load();
  }, [load]);

  const withRecipe = book?.items.filter((i) => i.yieldQuantity != null).length ?? 0;
  const active = (batches ?? []).filter((b) => b.status === 'Completed');

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Pha mẻ bán thành phẩm"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho nguyên liệu', href: paths.dashboard.fnb.stock },
          { name: 'Pha mẻ' },
        ]}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              disabled={!book || book.items.length === 0}
              onClick={() => setCreating(true)}
            >
              Pha mẻ
            </Button>
          </Stack>
        }
        sx={{ mb: 3 }}
      />

      <FnbBranchNotice sx={{ mb: 2 }} />
      {book && book.items.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Chưa có bán thành phẩm. Tạo hàng hoá với Loại mặt hàng = Bán thành phẩm rồi khai công thức mẻ ở Thiết lập F&amp;B
          → Bán thành phẩm.
        </Alert>
      )}
      {book && book.items.length > 0 && withRecipe === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Chưa bán thành phẩm nào có công thức mẻ — vẫn pha được nếu nhập tay nguyên liệu và sản lượng; khai công thức ở
          Thiết lập F&amp;B → Bán thành phẩm để pha nhanh hơn.
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
        {PERIODS.map((p) => (
          <Chip
            key={p.days}
            label={p.label}
            color={days === p.days ? 'primary' : 'default'}
            variant={days === p.days ? 'filled' : 'outlined'}
            onClick={() => setDays(p.days)}
          />
        ))}
        {batches && (
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            {active.length} phiếu
            {manager && active.some((b) => b.totalCost != null)
              ? ` · giá vốn ${fCurrency(active.reduce((s, b) => s + (b.totalCost ?? 0), 0))}`
              : ''}
          </Typography>
        )}
      </Stack>

      <Card>
        {!batches ? (
          <Stack alignItems="center" sx={{ py: 5 }}>
            {branchId ? <CircularProgress /> : null}
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Phiếu</TableCell>
                  <TableCell>Bán thành phẩm</TableCell>
                  <TableCell align="right">Số mẻ</TableCell>
                  <TableCell align="right">Sản lượng</TableCell>
                  <TableCell>Hạn dùng</TableCell>
                  <TableCell>Người pha</TableCell>
                  {manager && <TableCell align="right">Giá vốn</TableCell>}
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id} hover sx={{ cursor: 'pointer' }} onClick={() => setViewing(b)}>
                    <TableCell>
                      <Typography variant="subtitle2">{b.code}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {fTime(b.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>{b.productName}</TableCell>
                    <TableCell align="right">{fQty(b.batchCount)}</TableCell>
                    <TableCell align="right">
                      {fQty(b.actualYield)} {b.unit ?? ''}
                      {b.plannedYield != null && b.plannedYield !== b.actualYield && (
                        <Typography variant="caption" color="warning.main" display="block">
                          công thức {fQty(b.plannedYield)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{b.expiryDate ? fDay(b.expiryDate) : '—'}</TableCell>
                    <TableCell>{b.createdByName ?? ''}</TableCell>
                    {manager && (
                      <TableCell align="right">{b.totalCost == null ? '—' : fCurrency(b.totalCost)}</TableCell>
                    )}
                    <TableCell align="right">
                      {b.status === 'Cancelled' && <Chip size="small" color="error" variant="soft" label="Đã huỷ" />}
                    </TableCell>
                  </TableRow>
                ))}
                {batches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={manager ? 8 : 7}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                        Chưa có phiếu pha nào trong kỳ.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {book && creating && (
        <FnbBatchCreateDialog
          branchId={branchId}
          book={book}
          onClose={() => setCreating(false)}
          onCreated={(batch) => {
            setCreating(false);
            enqueueSnackbar(`Đã pha ${batch.code}: +${fQty(batch.actualYield)} ${batch.unit ?? ''} ${batch.productName}`);
            load();
          }}
        />
      )}

      <FnbBatchDetailDialog
        batch={viewing}
        userId={user?.id}
        manager={manager}
        onClose={() => setViewing(null)}
        onCancelled={() => {
          setViewing(null);
          load();
        }}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

type CreateProps = {
  branchId: string;
  book: IFnbBatchRecipeBook;
  onClose: VoidFunction;
  onCreated: (batch: IFnbBatch) => void;
};

function FnbBatchCreateDialog({ branchId, book, onClose, onCreated }: CreateProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [requestId] = useState(newId);
  const [item, setItem] = useState<IFnbBatchRecipeItem | null>(
    () => book.items.find((i) => i.yieldQuantity != null) ?? book.items[0] ?? null
  );
  const [count, setCount] = useState(1);
  const [lines, setLines] = useState<IFnbBatchRecipeLine[]>([]);
  const [actualYield, setActualYield] = useState(0);
  const [expiry, setExpiry] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const ingredients = useMemo(() => new Map(book.ingredients.map((i) => [i.id, i])), [book.ingredients]);
  const options = useMemo(() => book.ingredients.filter((i) => i.id !== item?.productId), [book.ingredients, item]);
  const planned = item?.yieldQuantity != null && count > 0 ? Math.round(item.yieldQuantity * count * 10_000) / 10_000 : null;

  // Đổi bán thành phẩm / số mẻ → tính lại nguyên liệu, sản lượng, hạn theo công thức.
  useEffect(() => {
    if (!item) return;
    setLines(scaleLines(item.lines, count > 0 ? count : 0));
    setActualYield(item.yieldQuantity != null && count > 0 ? Math.round(item.yieldQuantity * count * 10_000) / 10_000 : 0);
  }, [item, count]);

  useEffect(() => {
    setExpiry(item ? defaultExpiry(item, isoDay(new Date())) ?? '' : '');
  }, [item]);

  const cost = linesCost(lines, ingredients);
  const unit = item?.unit ?? '';
  const error = !item
    ? 'Chọn bán thành phẩm.'
    : !(count > 0) || count > 100
      ? 'Số mẻ từ lớn hơn 0 tới 100.'
      : lines.length === 0
        ? 'Chưa có nguyên liệu — khai công thức mẻ hoặc thêm nguyên liệu.'
        : lines.some((l) => !l.ingredientId)
          ? 'Chọn nguyên liệu cho mọi dòng.'
          : lines.some((l) => !(l.quantity > 0))
            ? 'Lượng nguyên liệu phải lớn hơn 0.'
            : new Set(lines.map((l) => l.ingredientId)).size !== lines.length
              ? 'Mỗi nguyên liệu chỉ một dòng.'
              : !(actualYield > 0)
                ? 'Nhập sản lượng thu được.'
                : null;
  const short = lines.filter((l) => {
    const ingredient = ingredients.get(l.ingredientId);
    return ingredient && l.quantity > ingredient.onHand;
  });

  const update = (index: number, patch: Partial<IFnbBatchRecipeLine>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const submit = async () => {
    if (!item || error) return;
    setSaving(true);
    try {
      const batch = await createFnbBatch({
        branchId,
        clientRequestId: requestId,
        productId: item.productId,
        batchCount: count,
        actualYield,
        expiryDate: expiry || null,
        lines,
        note: note.trim() || null,
      });
      onCreated(batch);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lập được phiếu pha'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" open onClose={saving ? undefined : onClose}>
      <DialogTitle>Pha mẻ</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Autocomplete
              size="small"
              sx={{ flex: 2 }}
              options={book.items}
              value={item}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.productId === b.productId}
              onChange={(_, value) => setItem(value)}
              renderOption={(props, o) => (
                <li {...props} key={o.productId}>
                  <Stack>
                    <Typography variant="body2">{o.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      tồn {fQty(o.onHand)} {o.unit ?? ''}
                      {o.yieldQuantity != null
                        ? ` · 1 mẻ = ${fQty(o.yieldQuantity)} ${o.unit ?? ''}`
                        : ' · chưa có công thức mẻ'}
                    </Typography>
                  </Stack>
                </li>
              )}
              renderInput={(params) => <TextField {...params} label="Bán thành phẩm" />}
            />
            <TextField
              size="small"
              type="number"
              label="Số mẻ"
              value={Number.isFinite(count) && count !== 0 ? count : ''}
              onChange={(e) => setCount(Number(e.target.value))}
              inputProps={{ min: 0, max: 100, step: 0.5 }}
              sx={{ width: { sm: 120 } }}
            />
          </Stack>

          {item?.note && (
            <Alert severity="info" icon={<Iconify icon="solar:notes-bold" />}>
              {item.note}
            </Alert>
          )}

          <Typography variant="subtitle2">Nguyên liệu dùng (sửa nếu thực tế khác công thức)</Typography>
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
                  renderInput={(params) => <TextField {...params} label="Nguyên liệu" />}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Lượng dùng"
                  value={Number.isFinite(line.quantity) && line.quantity !== 0 ? line.quantity : ''}
                  onChange={(e) => update(index, { quantity: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 'any' }}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">{ingredient?.unit ?? ''}</InputAdornment>,
                  }}
                  helperText={ingredient ? `tồn ${fQty(ingredient.onHand)}` : ' '}
                  error={!!ingredient && line.quantity > ingredient.onHand}
                  sx={{ flex: 1, minWidth: 140 }}
                />
                <IconButton color="error" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
                  <Iconify icon="solar:trash-bin-trash-bold" />
                </IconButton>
              </Stack>
            );
          })}
          <Button
            sx={{ alignSelf: 'flex-start' }}
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => setLines((prev) => [...prev, { ingredientId: '', quantity: 0 }])}
          >
            Thêm nguyên liệu
          </Button>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="number"
              label="Sản lượng thu được"
              value={Number.isFinite(actualYield) && actualYield !== 0 ? actualYield : ''}
              onChange={(e) => setActualYield(Number(e.target.value))}
              inputProps={{ min: 0, step: 'any' }}
              InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
              helperText={planned != null ? `Theo công thức ${fQty(planned)} ${unit}` : 'Chưa có công thức — nhập tay'}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="date"
              label="Hạn dùng của mẻ"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText={
                item?.shelfLifeDays != null ? `Bảo quản ${item.shelfLifeDays} ngày theo công thức` : 'Bỏ trống = không ghi hạn'
              }
              sx={{ flex: 1 }}
            />
          </Stack>

          <TextField
            size="small"
            label="Ghi chú (không bắt buộc)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            inputProps={{ maxLength: 500 }}
          />

          {cost != null && actualYield > 0 && (
            <Typography variant="body2">
              Giá vốn mẻ {fCurrency(cost)} · {fCurrency(Math.round((cost / actualYield) * 100) / 100)}/{unit || 'đv'}
            </Typography>
          )}
          {short.length > 0 && (
            <Alert severity="warning">
              Tồn hệ thống không đủ: {short.map((l) => ingredients.get(l.ingredientId)?.name).join(', ')} — vẫn pha được
              (tồn sẽ âm), nên kiểm kho lại.
            </Alert>
          )}
          {error && item && <Alert severity="warning">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!!error} onClick={submit}>
          Pha xong — ghi kho
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

type DetailProps = {
  batch: IFnbBatch | null;
  userId: string | undefined;
  manager: boolean;
  onClose: VoidFunction;
  onCancelled: VoidFunction;
};

function FnbBatchDetailDialog({ batch, userId, manager, onClose, onCancelled }: DetailProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNote('');
  }, [batch]);

  if (!batch) return null;

  const own = !!userId && batch.createdById === userId;
  const cancellable = canCancelBatch(batch, userId, manager);
  // Quản lý huỷ phiếu không phải của mình (hoặc quá 60 phút) phải ghi lý do.
  const noteRequired = cancellable && !canCancelBatch(batch, userId, false);

  const cancel = async () => {
    setSaving(true);
    try {
      await cancelFnbBatch(batch.id, note.trim() || null);
      enqueueSnackbar(`Đã huỷ phiếu pha ${batch.code}`);
      onCancelled();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không huỷ được phiếu pha'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" open onClose={saving ? undefined : onClose}>
      <DialogTitle>
        {batch.code} · {batch.productName}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            {fQty(batch.batchCount)} mẻ → {fQty(batch.actualYield)} {batch.unit ?? ''}
            {batch.plannedYield != null && batch.plannedYield !== batch.actualYield
              ? ` (công thức ${fQty(batch.plannedYield)})`
              : ''}
            {batch.expiryDate ? ` · HSD ${fDay(batch.expiryDate)}` : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {batch.createdByName ?? ''} · {fTime(batch.createdAt)}
            {batch.note ? ` · ${batch.note}` : ''}
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nguyên liệu</TableCell>
                <TableCell align="right">Lượng</TableCell>
                {manager && <TableCell align="right">Giá vốn</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {batch.lines.map((l) => (
                <TableRow key={l.ingredientId}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell align="right">
                    {fQty(l.quantity)} {l.unit ?? ''}
                  </TableCell>
                  {manager && <TableCell align="right">{l.value == null ? '—' : fCurrency(l.value)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {manager && batch.totalCost != null && (
            <Typography variant="body2">
              Tổng giá vốn {fCurrency(batch.totalCost)}
              {batch.unitCost != null ? ` · ${fCurrency(Math.round(batch.unitCost * 100) / 100)}/${batch.unit ?? 'đv'}` : ''}
            </Typography>
          )}

          {batch.status === 'Cancelled' && (
            <Alert severity="error">
              Đã huỷ bởi {batch.cancelledByName ?? ''}
              {batch.cancelledAt ? ` lúc ${fTime(batch.cancelledAt)}` : ''}
              {batch.cancelNote ? ` — ${batch.cancelNote}` : ''}
            </Alert>
          )}
          {cancellable && (
            <TextField
              size="small"
              label={noteRequired ? 'Lý do huỷ (bắt buộc)' : 'Lý do huỷ'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              inputProps={{ maxLength: 500 }}
              helperText="Huỷ phiếu sẽ hoàn nguyên liệu và trừ lại bán thành phẩm của mẻ."
            />
          )}
          {!cancellable && batch.status === 'Completed' && own && (
            <Typography variant="caption" color="text.secondary">
              Quá {OWN_CANCEL_MINUTES} phút — nhờ quản lý huỷ nếu pha nhầm.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        {cancellable && (
          <LoadingButton
            color="error"
            variant="contained"
            loading={saving}
            disabled={noteRequired && !note.trim()}
            onClick={cancel}
          >
            Huỷ phiếu pha
          </LoadingButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
