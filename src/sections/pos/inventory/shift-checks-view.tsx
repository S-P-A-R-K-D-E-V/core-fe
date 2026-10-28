'use client';

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
import Switch from '@mui/material/Switch';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import axios from 'src/utils/axios';
import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useWorkingBranch } from 'src/store/working-branch-store';
import { getAllCategories } from 'src/api/categories';
import {
  saveStockCheckArea,
  getStockCheckAreas,
  getShiftStockCheck,
  getShiftStockChecks,
  saveShiftStockCounts,
  reviewShiftStockCheck,
  submitShiftStockCheck,
  getMyShiftStockChecks,
} from 'src/api/shift-stock-checks';
import {
  type IStockCheckArea,
  type IShiftStockCheck,
  type ShiftStockCheckStatus,
  SHIFT_STOCK_CHECK_STATUS_LABEL,
} from 'src/types/shift-stock-check';

import { useAuthContext } from 'src/auth/hooks';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------
// Kiểm hàng khu vực mỗi ca (Quy chế Điều 24.3, Nội quy Điều 8 / 11; chủ tịch 2026-10-28): Admin chọn khu nhỏ (sản phẩm / nhóm
// hàng); mỗi ca đang chạy có phiếu đếm mù cho trưởng ca; chênh lệch chỉ báo lại cho quản lý — không chỉnh tồn kho.
// ----------------------------------------------------------------------

const STATUS_COLOR: Record<ShiftStockCheckStatus, 'default' | 'warning' | 'success' | 'info'> = {
  Draft: 'warning',
  Pending: 'info',
  Completed: 'success',
  Cancelled: 'default',
};

function StatusChip({ check }: { check: IShiftStockCheck }) {
  if (check.isOverdue) return <Chip size="small" color="error" label="Hết ca chưa nộp" />;
  return <Chip size="small" color={STATUS_COLOR[check.status]} label={SHIFT_STOCK_CHECK_STATUS_LABEL[check.status]} />;
}

const qty = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('vi-VN', { maximumFractionDigits: 3 }));

function parseQty(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

// ── Đếm một phiếu ───────────────────────────────────────────────────────

export function ShiftCountCard({ check, onChanged }: { check: IShiftStockCheck; onChanged: (c: IShiftStockCheck) => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  const editable = check.status === 'Draft';

  useEffect(() => {
    setTexts(Object.fromEntries((check.lines ?? []).map((l) => [l.lineId, l.countedQuantity == null ? '' : String(l.countedQuantity)])));
  }, [check]);

  const changed = (check.lines ?? []).filter((l) => (texts[l.lineId] ?? '') !== (l.countedQuantity == null ? '' : String(l.countedQuantity)));
  const invalid = changed.some((l) => parseQty(texts[l.lineId] ?? '') === undefined);

  const save = async (): Promise<IShiftStockCheck | null> => {
    if (changed.length === 0) return check;
    setBusy('save');
    try {
      const saved = await saveShiftStockCounts(
        check.id,
        changed.map((l) => ({ lineId: l.lineId, quantity: parseQty(texts[l.lineId] ?? '') ?? null }))
      );
      onChanged(saved);
      return saved;
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được số đếm'), { variant: 'error' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    const saved = await save();
    if (!saved) return;
    setBusy('submit');
    try {
      onChanged(await submitShiftStockCheck(check.id));
      enqueueSnackbar('Đã nộp phiếu kiểm hàng ca');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Chưa nộp được'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        title={check.title ?? check.areaName}
        subheader={
          <>
            {check.shiftDate ? fDate(check.shiftDate, 'dd/MM/yyyy') : ''} · đã đếm {check.countedLines}/{check.totalLines}
            {check.dueAt ? ` · nộp trước ${fDate(check.dueAt, 'HH:mm')}` : ''}
          </>
        }
        action={<StatusChip check={check} />}
      />
      {check.blind && editable && (
        <Alert severity="info" sx={{ mx: 2 }}>
          Đếm số thực tế trên kệ — không cần đối chiếu với máy. Chênh lệch (nếu có) được báo cho quản lý.
        </Alert>
      )}
      <TableContainer sx={{ mt: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mặt hàng</TableCell>
              <TableCell align="right" sx={{ width: 140 }}>
                Đếm được
              </TableCell>
              {!check.blind && <TableCell align="right">Tồn máy</TableCell>}
              {!check.blind && <TableCell align="right">Lệch</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {(check.lines ?? []).map((l) => (
              <TableRow key={l.lineId}>
                <TableCell>
                  {l.productName}
                  <Typography variant="caption" color="text.secondary" display="block">
                    {l.productCode}
                    {l.unit ? ` · ${l.unit}` : ''}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {editable ? (
                    <TextField
                      size="small"
                      value={texts[l.lineId] ?? ''}
                      onChange={(e) => setTexts((t) => ({ ...t, [l.lineId]: e.target.value }))}
                      error={parseQty(texts[l.lineId] ?? '') === undefined}
                      inputProps={{ inputMode: 'decimal', style: { textAlign: 'right' } }}
                      sx={{ width: 110 }}
                    />
                  ) : (
                    qty(l.countedQuantity)
                  )}
                </TableCell>
                {!check.blind && <TableCell align="right">{qty(l.systemQuantity)}</TableCell>}
                {!check.blind && (
                  <TableCell align="right" sx={{ color: l.variance ? 'error.main' : undefined, fontWeight: l.variance ? 600 : undefined }}>
                    {l.variance == null ? '—' : `${l.variance > 0 ? '+' : ''}${qty(l.variance)}`}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {editable && (
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ p: 2 }}>
          <LoadingButton loading={busy === 'save'} disabled={changed.length === 0 || invalid || !!busy} onClick={save}>
            Lưu số đếm
          </LoadingButton>
          <LoadingButton variant="contained" loading={busy === 'submit'} disabled={invalid || !!busy} onClick={submit}>
            Nộp phiếu
          </LoadingButton>
        </Stack>
      )}
    </Card>
  );
}

function MyChecksTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [list, setList] = useState<IShiftStockCheck[] | null>(null);

  useEffect(() => {
    getMyShiftStockChecks()
      .then(setList)
      .catch((err) => {
        setList([]);
        enqueueSnackbar(apiErrorMessage(err, 'Không tải được phiếu kiểm hàng ca'), { variant: 'error' });
      });
  }, [enqueueSnackbar]);

  if (list == null) return null;
  if (list.length === 0)
    return (
      <Typography color="text.secondary" sx={{ p: 3 }}>
        Hôm nay chưa có phiếu kiểm hàng cho ca của bạn — phiếu tự tạo khi ca bắt đầu (nếu Admin đã chọn khu vực kiểm).
      </Typography>
    );
  return (
    <Stack sx={{ p: 2 }}>
      {list.map((c) => (
        <ShiftCountCard key={c.id} check={c} onChanged={(n) => setList((l) => (l ?? []).map((x) => (x.id === n.id ? n : x)))} />
      ))}
    </Stack>
  );
}

// ── Quản lý: phiếu kiểm ca ──────────────────────────────────────────────

function CheckDetailDialog({ id, onClose, onReviewed }: { id: string | null; onClose: () => void; onReviewed: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [check, setCheck] = useState<IShiftStockCheck | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCheck(null);
    setNote('');
    if (id) getShiftStockCheck(id).then(setCheck).catch(() => setCheck(null));
  }, [id]);

  const review = async (action: 'acknowledge' | 'cancel') => {
    if (!check) return;
    setBusy(true);
    try {
      setCheck(await reviewShiftStockCheck(check.id, action, note.trim() || null));
      enqueueSnackbar(action === 'acknowledge' ? 'Đã xác nhận đã xem' : 'Đã huỷ phiếu');
      onReviewed();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không cập nhật được phiếu'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!id} onClose={() => !busy && onClose()} fullWidth maxWidth="md">
      <DialogTitle>Phiếu kiểm hàng ca {check?.code ?? ''}</DialogTitle>
      <DialogContent>
        {check && (
          <Stack spacing={2}>
            {check.submittedByName && (
              <Typography variant="body2" color="text.secondary">
                {check.submittedByName} nộp lúc {fDate(check.submittedAt, 'HH:mm dd/MM')}
                {check.reviewedByName ? ` · ${check.reviewedByName} đã xem ${fDate(check.reviewedAt, 'HH:mm dd/MM')}` : ''}
                {check.reviewNote ? ` — ${check.reviewNote}` : ''}
              </Typography>
            )}
            <ShiftCountCard check={check} onChanged={setCheck} />
            {(check.status === 'Pending' || check.status === 'Draft') && (
              <TextField label="Ghi chú (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} />
            )}
            <Alert severity="info">
              Phiếu kiểm ca chỉ để báo chênh lệch — không chỉnh tồn kho. Thiếu hàng thật thì lập biên bản chênh lệch ở mục Nhân sự.
            </Alert>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Đóng
        </Button>
        {check && (check.status === 'Draft' || check.status === 'Pending') && (
          <LoadingButton color="error" loading={busy} onClick={() => review('cancel')}>
            Huỷ phiếu
          </LoadingButton>
        )}
        {check?.status === 'Pending' && (
          <LoadingButton variant="contained" loading={busy} onClick={() => review('acknowledge')}>
            Đã xem
          </LoadingButton>
        )}
      </DialogActions>
    </Dialog>
  );
}

function ChecksTab() {
  const { enqueueSnackbar } = useSnackbar();
  const today = fDate(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(fDate(new Date(Date.now() - 6 * 86_400_000), 'yyyy-MM-dd'));
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<ShiftStockCheckStatus | ''>('');
  const [list, setList] = useState<IShiftStockCheck[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await getShiftStockChecks({ from, to, status: status || undefined }));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được phiếu kiểm ca'), { variant: 'error' });
    }
  }, [from, to, status, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2 }}>
        <TextField type="date" label="Từ ngày" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField type="date" label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField select label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value as ShiftStockCheckStatus | '')} sx={{ minWidth: 160 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {(Object.keys(SHIFT_STOCK_CHECK_STATUS_LABEL) as ShiftStockCheckStatus[]).map((s) => (
            <MenuItem key={s} value={s}>
              {SHIFT_STOCK_CHECK_STATUS_LABEL[s]}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      {list.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 3, pt: 0 }}>
          Không có phiếu kiểm ca nào trong khoảng này.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ngày</TableCell>
                <TableCell>Ca · khu</TableCell>
                <TableCell align="right">Đã đếm</TableCell>
                <TableCell align="right">Mặt hàng lệch</TableCell>
                <TableCell align="right">Giá trị lệch</TableCell>
                <TableCell>Trạng thái</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpenId(c.id)}>
                  <TableCell>{c.shiftDate ? fDate(c.shiftDate, 'dd/MM/yyyy') : ''}</TableCell>
                  <TableCell>{c.title ?? c.areaName}</TableCell>
                  <TableCell align="right">
                    {c.countedLines}/{c.totalLines}
                  </TableCell>
                  <TableCell align="right" sx={{ color: c.varianceLines ? 'error.main' : undefined }}>
                    {c.varianceLines ?? 0}
                  </TableCell>
                  <TableCell align="right">{(c.varianceValue ?? 0).toLocaleString('vi-VN')}đ</TableCell>
                  <TableCell>
                    <StatusChip check={c} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <CheckDetailDialog id={openId} onClose={() => setOpenId(null)} onReviewed={load} />
    </>
  );
}

// ── Khu vực (Admin) ─────────────────────────────────────────────────────

type ProductOption = { id: string; code: string; name: string };

function AreaDialog({
  area,
  open,
  onClose,
  onSaved,
}: {
  area: IStockCheckArea | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const branches = useWorkingBranch((s) => s.options) ?? [];
  const current = useWorkingBranch((s) => s.branch);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [branchId, setBranchId] = useState('');
  const [everyShift, setEveryShift] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllCategories()
      .then((list) => setCategories(list.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    setName(area?.name ?? '');
    setNote(area?.note ?? '');
    setBranchId(area?.branchId ?? current?.id ?? branches[0]?.id ?? '');
    setEveryShift(area?.everyShift ?? false);
    setSortOrder(String(area?.sortOrder ?? 0));
    setIsActive(area?.isActive ?? true);
    setProducts((area?.products ?? []).map((p) => ({ id: p.id, code: p.code, name: p.name })));
    setCategoryIds(area?.categoryIds ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, area]);

  useEffect(() => {
    if (!open || keyword.trim().length < 2) {
      setOptions([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      axios
        .get('/products', { params: { isActive: true, keyword: keyword.trim(), page: 1, pageSize: 20 } })
        .then((res) =>
          setOptions(((res.data?.items as any[]) ?? []).map((p) => ({ id: p.id, code: p.code, name: p.fullName || p.name })))
        )
        .catch(() => setOptions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, open]);

  const selectedCategories = useMemo(() => categories.filter((c) => categoryIds.includes(c.id)), [categories, categoryIds]);

  const submit = async () => {
    setSaving(true);
    try {
      await saveStockCheckArea(area?.id ?? null, {
        branchId,
        name: name.trim(),
        note: note.trim() || null,
        everyShift,
        sortOrder: Number(sortOrder) || 0,
        isActive,
        productIds: products.map((p) => p.id),
        categoryIds,
      });
      enqueueSnackbar('Đã lưu khu vực kiểm');
      onSaved();
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được khu vực'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>{area ? 'Sửa khu vực kiểm' : 'Thêm khu vực kiểm'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Tên khu (vd Tủ trang sức)" value={name} onChange={(e) => setName(e.target.value)} />
          {branches.length > 1 && (
            <TextField select label="Chi nhánh" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Autocomplete
            multiple
            options={options}
            value={products}
            filterOptions={(x) => x}
            getOptionLabel={(o) => `${o.name} (${o.code})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, v) => setProducts(v)}
            onInputChange={(_, v, reason) => reason === 'input' && setKeyword(v)}
            noOptionsText={keyword.trim().length < 2 ? 'Gõ ít nhất 2 ký tự tên / mã hàng' : 'Không thấy hàng'}
            renderInput={(params) => <TextField {...params} label="Sản phẩm chọn riêng" />}
          />
          <Autocomplete
            multiple
            options={categories}
            value={selectedCategories}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, v) => setCategoryIds(v.map((c) => c.id))}
            renderInput={(params) => <TextField {...params} label="Cả nhóm hàng (gồm nhóm con)" />}
          />
          <FormControlLabel
            control={<Switch checked={everyShift} onChange={(e) => setEveryShift(e.target.checked)} />}
            label={everyShift ? 'Ca nào cũng kiểm khu này' : 'Luân phiên — mỗi ca kiểm một khu luân phiên, lần lượt theo thứ tự'}
          />
          <TextField label="Thứ tự" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputProps={{ inputMode: 'numeric' }} />
          <TextField label="Ghi chú cho người đếm" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
          <FormControlLabel control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />} label="Đang dùng" />
          <Typography variant="caption" color="text.secondary">
            Khu nhỏ để đếm nhanh trong ca: tối đa 60 mặt hàng. Không có hàng giá trị cao / thấp riêng — Admin tự chọn hàng cần kiểm.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={!name.trim() || !branchId || (isActive && products.length === 0 && categoryIds.length === 0)}
          onClick={submit}
        >
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

function AreasTab({ canManage }: { canManage: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const [list, setList] = useState<IStockCheckArea[]>([]);
  const [editing, setEditing] = useState<IStockCheckArea | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await getStockCheckAreas());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được khu vực'), { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      {canManage && (
        <Stack direction="row" justifyContent="flex-end" sx={{ p: 2 }}>
          <Button
            variant="contained"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Thêm khu vực
          </Button>
        </Stack>
      )}
      {list.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 3, pt: canManage ? 0 : 3 }}>
          Chưa có khu vực kiểm nào — chưa có ca nào phải kiểm hàng.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Khu</TableCell>
                <TableCell>Kiểm</TableCell>
                <TableCell align="right">Mặt hàng</TableCell>
                <TableCell>Trạng thái</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((a) => (
                <TableRow
                  key={a.id}
                  hover={canManage}
                  sx={{ cursor: canManage ? 'pointer' : undefined }}
                  onClick={() => {
                    if (!canManage) return;
                    setEditing(a);
                    setOpen(true);
                  }}
                >
                  <TableCell>
                    {a.name}
                    {a.note && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {a.note}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{a.everyShift ? 'Mọi ca' : `Luân phiên (thứ tự ${a.sortOrder})`}</TableCell>
                  <TableCell align="right">{a.productCount}</TableCell>
                  <TableCell>
                    <Chip size="small" color={a.isActive ? 'success' : 'default'} label={a.isActive ? 'Đang dùng' : 'Tắt'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <AreaDialog area={editing} open={open} onClose={() => setOpen(false)} onSaved={load} />
    </>
  );
}

// ── Trang ───────────────────────────────────────────────────────────────

export function ShiftStockChecksView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const canRead = hasPermission(user, PERMISSIONS.stockTake.read);
  const canManage = hasPermission(user, PERMISSIONS.stockTake.shiftCheckManage);
  const [tab, setTab] = useState<'mine' | 'checks' | 'areas'>('mine');

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Kiểm hàng ca"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Kiểm tra cửa hàng' }, { name: 'Kiểm hàng ca' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab value="mine" label="Phiếu hôm nay" />
          {canRead && <Tab value="checks" label="Các phiếu kiểm ca" />}
          {canRead && <Tab value="areas" label="Khu vực kiểm" />}
        </Tabs>
        {tab === 'mine' && <MyChecksTab />}
        {tab === 'checks' && canRead && <ChecksTab />}
        {tab === 'areas' && canRead && <AreasTab canManage={canManage} />}
      </Card>
    </Container>
  );
}
