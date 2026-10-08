'use client';

import type { FnbStockReason, IFnbStockReport, IFnbStockIngredient } from 'src/types/fnb';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
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
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { getFnbStock, adjustFnbStock } from 'src/api/fnb';

import { newId } from 'src/sections/fnb-pos/lib/ids';
import { useFnbBranches } from 'src/sections/fnb-pos/use-fnb-branches';

import { fQty, countLines, REASON_LABEL, STATUS_LABEL, sortIngredients } from './lib/stock';

// ----------------------------------------------------------------------
// Kho nguyên liệu của một chi nhánh F&B: tồn, giá trị, lượng dùng 7 ngày, số ngày còn đủ; số phần món còn pha được
// (tối đa nếu chỉ pha món đó / ước tính chia theo tỷ lệ bán 14 ngày); kiểm kê và xuất huỷ (quá hạn, hỏng). Món tụt dưới
// ngưỡng sau mỗi lần trừ kho thì chủ / quản lý nhận thông báo.
// ----------------------------------------------------------------------

const REFRESH_MS = 30_000;
const LOW_PORTIONS = 10;

export default function FnbStockView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const canEdit = ['Admin', 'Manager'].some((r) => user?.role === r || (user?.roles ?? []).includes(r));

  const { branches, branchId, setBranchId } = useFnbBranches();
  const [report, setReport] = useState<IFnbStockReport | null>(null);
  const [tab, setTab] = useState<'ingredients' | 'dishes'>('ingredients');
  const [counting, setCounting] = useState(false);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    try {
      setReport(await getFnbStock(branchId));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được kho nguyên liệu'), { variant: 'error' });
    }
  }, [branchId, enqueueSnackbar]);

  /** Bấm làm mới: có vòng quay và báo đã cập nhật (số không đổi vẫn biết là đã tải lại). */
  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    enqueueSnackbar('Đã cập nhật kho nguyên liệu', { variant: 'info' });
  };

  useEffect(() => {
    setReport(null);
    setCounting(false);
    setCounted({});
    load();
  }, [load]);

  useEffect(() => {
    if (!branchId || counting) return undefined;
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [branchId, counting, load]);

  const ingredients = useMemo(() => sortIngredients(report?.ingredients ?? []), [report]);
  const pending = countLines(ingredients, counted);
  const lowIngredients = ingredients.filter((i) => i.status === 'out' || i.status === 'low').length;
  const lowDishes = (report?.dishes ?? []).filter((d) => d.maxPortions <= LOW_PORTIONS).length;
  const stockValue = ingredients.reduce((s, i) => s + i.value, 0);
  const noRecipes = !!report && report.dishes.length === 0;
  const updatedAt = report ? new Date(report.generatedAt).toLocaleTimeString('vi-VN') : '';

  const saveCount = async () => {
    if (pending.length === 0) return;
    setSaving(true);
    try {
      await adjustFnbStock({ branchId, clientRequestId: newId(), reason: 'Count', lines: pending });
      enqueueSnackbar(`Đã kiểm kê ${pending.length} nguyên liệu`);
      setCounting(false);
      setCounted({});
      load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lưu được kiểm kê'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Kho nguyên liệu"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Kho nguyên liệu' }]}
        action={
          branches && branches.length > 0 ? (
            <TextField
              select
              size="small"
              label="Chi nhánh"
              value={branchId}
              disabled={branches.length === 1 || counting}
              onChange={(e) => setBranchId(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.branchName}
                </MenuItem>
              ))}
            </TextField>
          ) : null
        }
        sx={{ mb: 3 }}
      />

      {branches?.length === 0 && <Alert severity="info">Chưa có chi nhánh F&amp;B nào bạn được làm.</Alert>}

      {report && (
        <Stack spacing={2}>
          {noRecipes && (
            <Alert
              severity="warning"
              action={
                canEdit ? (
                  <Button
                    color="inherit"
                    size="small"
                    component={RouterLink}
                    href={`${paths.dashboard.fnb.root}?tab=recipes`}
                  >
                    Khai định lượng
                  </Button>
                ) : undefined
              }
            >
              Chưa món nào có định lượng nên bán hàng <b>chưa trừ nguyên liệu</b> và chưa ước được số phần món. Khai lượng
              nguyên liệu cho từng size / món ở Thiết lập F&amp;B › Định lượng — đơn gửi bar từ lúc đó mới trừ kho.
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {canEdit && <Summary title="Giá trị tồn nguyên liệu" value={fCurrency(stockValue)} />}
            <Summary
              title="Nguyên liệu hết / sắp hết"
              value={String(lowIngredients)}
              color={lowIngredients > 0 ? 'warning.main' : undefined}
            />
            <Summary
              title={`Món còn ≤ ${LOW_PORTIONS} phần`}
              value={String(lowDishes)}
              color={lowDishes > 0 ? 'error.main' : undefined}
            />
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flexGrow: 1 }}>
              <Tab value="ingredients" label={`Nguyên liệu (${ingredients.length})`} />
              <Tab value="dishes" label={`Món còn pha được (${report.dishes.length})`} />
            </Tabs>
            <Typography variant="caption" color="text.secondary">
              Cập nhật {updatedAt}
            </Typography>
            <IconButton onClick={refresh} disabled={counting || refreshing} title="Tải lại">
              {refreshing ? <CircularProgress size={20} /> : <Iconify icon="solar:refresh-bold" />}
            </IconButton>
            {canEdit && tab === 'ingredients' && !counting && (
              <>
                <Button variant="outlined" startIcon={<Iconify icon="solar:clipboard-check-bold" />} onClick={() => setCounting(true)}>
                  Kiểm kê
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                  onClick={() => setDisposeOpen(true)}
                >
                  Xuất huỷ
                </Button>
              </>
            )}
            {counting && (
              <>
                <Button
                  onClick={() => {
                    setCounting(false);
                    setCounted({});
                  }}
                >
                  Huỷ kiểm kê
                </Button>
                <LoadingButton variant="contained" loading={saving} disabled={pending.length === 0} onClick={saveCount}>
                  Lưu kiểm kê ({pending.length})
                </LoadingButton>
              </>
            )}
          </Stack>

          {tab === 'ingredients' && (
            <Card>
              {counting && (
                <Alert severity="info" sx={{ borderRadius: 0 }}>
                  Nhập số đếm thực tế (đơn vị gốc). Ô để trống = không kiểm. Lưu xong, tồn được đặt bằng số đếm và phần
                  chênh ghi vào sổ kho là kiểm kê.
                </Alert>
              )}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nguyên liệu</TableCell>
                      <TableCell align="right">Tồn</TableCell>
                      {counting && <TableCell align="right">Đếm được</TableCell>}
                      {canEdit && <TableCell align="right">Giá vốn</TableCell>}
                      {canEdit && <TableCell align="right">Giá trị</TableCell>}
                      <TableCell align="right">Dùng {report.usageDays} ngày</TableCell>
                      <TableCell align="right">Còn đủ</TableCell>
                      <TableCell>Trạng thái</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ingredients.map((i) => (
                      <IngredientRow
                        key={i.id}
                        item={i}
                        showCost={canEdit}
                        counting={counting}
                        value={counted[i.id] ?? ''}
                        onChange={(v) => setCounted((p) => ({ ...p, [i.id]: v }))}
                      />
                    ))}
                    {ingredients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                            Chưa có nguyên liệu. Tạo hàng hoá với Loại mặt hàng = Nguyên liệu và nhập hàng.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}

          {tab === 'dishes' && (
            <Card>
              <Alert severity="info" sx={{ borderRadius: 0 }}>
                <b>Tối đa</b>: số phần pha được nếu chỉ bán riêng món đó. <b>Ước tính</b>: nguyên liệu dùng chung chia cho
                các món theo tỷ lệ bán {report.salesDays} ngày gần nhất. Chỉ tính món đã khai định lượng.
              </Alert>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Món</TableCell>
                      <TableCell align="right">Tối đa</TableCell>
                      <TableCell align="right">Ước tính</TableCell>
                      <TableCell align="right">Đã bán {report.salesDays} ngày</TableCell>
                      <TableCell>Hết trước</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.dishes.map((d) => (
                      <TableRow key={d.productId} hover>
                        <TableCell>
                          {d.variantName ? `${d.name} (${d.variantName})` : d.name}
                          {d.isTopping && <Chip size="small" label="Món thêm" sx={{ ml: 1 }} />}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="subtitle2"
                            color={d.maxPortions === 0 ? 'error.main' : d.maxPortions <= LOW_PORTIONS ? 'warning.main' : 'text.primary'}
                          >
                            {d.maxPortions.toLocaleString('vi-VN')}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{d.estimatedPortions.toLocaleString('vi-VN')}</TableCell>
                        <TableCell align="right">{fQty(d.soldUnits)}</TableCell>
                        <TableCell>{d.limitingIngredientName ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                    {report.dishes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                            Chưa món nào có định lượng — khai ở Thiết lập F&amp;B › Định lượng.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </Stack>
      )}

      <FnbDisposeDialog
        open={disposeOpen}
        branchId={branchId}
        ingredients={ingredients}
        onClose={() => setDisposeOpen(false)}
        onDone={() => {
          setDisposeOpen(false);
          load();
        }}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

function Summary({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <Card sx={{ p: 2, flex: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h5" color={color}>
        {value}
      </Typography>
    </Card>
  );
}

type RowProps = {
  item: IFnbStockIngredient;
  showCost: boolean;
  counting: boolean;
  value: string;
  onChange: (v: string) => void;
};

function IngredientRow({ item, showCost, counting, value, onChange }: RowProps) {
  const status = STATUS_LABEL[item.status];
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="subtitle2">{item.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {item.code}
          {item.kind === 'SemiFinished' ? ' · bán thành phẩm' : ''}
          {item.usedInDishes > 0 ? ` · dùng trong ${item.usedInDishes} món` : ' · chưa có trong định lượng'}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" color={item.onHand < 0 ? 'error.main' : undefined}>
          {fQty(item.onHand)} {item.unit ?? ''}
        </Typography>
      </TableCell>
      {counting && (
        <TableCell align="right">
          <TextField
            size="small"
            type="number"
            value={value}
            placeholder={fQty(Math.max(0, item.onHand))}
            onChange={(e) => onChange(e.target.value)}
            inputProps={{ min: 0, step: 'any' }}
            InputProps={{ endAdornment: <InputAdornment position="end">{item.unit ?? ''}</InputAdornment> }}
            sx={{ width: 150 }}
          />
        </TableCell>
      )}
      {showCost && <TableCell align="right">{item.unitCost == null ? '—' : fCurrency(item.unitCost)}</TableCell>}
      {showCost && <TableCell align="right">{fCurrency(item.value)}</TableCell>}
      <TableCell align="right">
        {fQty(item.used)} {item.used > 0 ? item.unit ?? '' : ''}
      </TableCell>
      <TableCell align="right">{item.daysLeft == null ? '—' : `${fQty(item.daysLeft)} ngày`}</TableCell>
      <TableCell>
        <Chip size="small" color={status.color} variant={status.color === 'default' ? 'outlined' : 'soft'} label={status.label} />
      </TableCell>
    </TableRow>
  );
}

// ----------------------------------------------------------------------

type DisposeProps = {
  open: boolean;
  branchId: string;
  ingredients: IFnbStockIngredient[];
  onClose: VoidFunction;
  onDone: VoidFunction;
};

type DisposeLine = { ingredient: IFnbStockIngredient | null; quantity: string };

function FnbDisposeDialog({ open, branchId, ingredients, onClose, onDone }: DisposeProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [reason, setReason] = useState<Exclude<FnbStockReason, 'Count'>>('Expired');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<DisposeLine[]>([]);
  const [requestId, setRequestId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('Expired');
    setNote('');
    setLines([{ ingredient: null, quantity: '' }]);
    setRequestId(newId());
  }, [open]);

  const valid =
    lines.length > 0 &&
    lines.every((l) => l.ingredient && Number(l.quantity) > 0) &&
    new Set(lines.map((l) => l.ingredient?.id)).size === lines.length;

  const save = async () => {
    setSaving(true);
    try {
      await adjustFnbStock({
        branchId,
        clientRequestId: requestId,
        reason,
        note: note.trim() || null,
        lines: lines.map((l) => ({ productId: l.ingredient!.id, quantity: Number(l.quantity) })),
      });
      enqueueSnackbar(`Đã xuất huỷ ${lines.length} nguyên liệu`);
      onDone();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không xuất huỷ được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={saving ? undefined : onClose}>
      <DialogTitle>Xuất huỷ nguyên liệu</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField select label="Lý do" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
            {(Object.keys(REASON_LABEL) as (keyof typeof REASON_LABEL)[]).map((r) => (
              <MenuItem key={r} value={r}>
                {REASON_LABEL[r]}
              </MenuItem>
            ))}
          </TextField>
          {lines.map((line, index) => (
            <Stack key={index} direction="row" spacing={1} alignItems="center">
              <Autocomplete
                size="small"
                sx={{ flex: 2 }}
                options={ingredients}
                value={line.ingredient}
                getOptionLabel={(o) => `${o.name} (tồn ${fQty(o.onHand)} ${o.unit ?? ''})`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                onChange={(_, value) =>
                  setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ingredient: value } : l)))
                }
                renderInput={(params) => <TextField {...params} label="Nguyên liệu" />}
              />
              <TextField
                size="small"
                type="number"
                label="Lượng bỏ"
                value={line.quantity}
                onChange={(e) =>
                  setLines((prev) => prev.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)))
                }
                inputProps={{ min: 0, step: 'any' }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{line.ingredient?.unit ?? ''}</InputAdornment>,
                }}
                sx={{ flex: 1 }}
              />
              <IconButton
                color="error"
                disabled={lines.length === 1}
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
              >
                <Iconify icon="solar:trash-bin-trash-bold" />
              </IconButton>
            </Stack>
          ))}
          <Button
            sx={{ alignSelf: 'flex-start' }}
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => setLines((prev) => [...prev, { ingredient: null, quantity: '' }])}
          >
            Thêm dòng
          </Button>
          <TextField label="Ghi chú (lô, nguyên nhân…)" value={note} onChange={(e) => setNote(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" color="error" loading={saving} disabled={!valid} onClick={save}>
          Xuất huỷ
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
