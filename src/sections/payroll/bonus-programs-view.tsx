'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { getActiveStaffUsers } from 'src/api/users';
import { getAllCategories } from 'src/api/categories';
import {
  getBonusOrders,
  saveBonusProgram,
  getBonusPrograms,
  getBonusProgramMonth,
  setBonusOrderAttribution,
} from 'src/api/bonus-programs';
import {
  type IBonusOrder,
  type IBonusProgram,
  BONUS_MODE_LABEL,
  type BonusRecipient,
  BONUS_SOURCE_LABEL,
  type BonusSalesSource,
  type BonusProgramMode,
  type ISaveBonusProgram,
  type IBonusProgramMonth,
  BONUS_RECIPIENT_LABEL,
} from 'src/types/bonus-program';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { fVnd, parseAmount } from '../hr/hr-common';

// ----------------------------------------------------------------------
// Chương trình thưởng theo đơn (Quy chế Điều 4, 14a.4, 29; chủ tịch 2026-10-28) — chỉ Admin. Thưởng doanh số tuần (Điều 5)
// vẫn cấu hình ở trang Chính sách ngày lễ.
// ----------------------------------------------------------------------

const SOURCES: BonusSalesSource[] = ['Online', 'Web', 'Pos', 'KiotViet'];

function describe(p: IBonusProgram): string {
  if (p.mode === 'PercentOfRevenue') return `${p.ratePercent ?? 0}% doanh thu đơn`;
  if (p.mode === 'FixedPerOrder') return `${fVnd(p.fixedAmount ?? 0)} mỗi đơn`;
  return `% theo ${p.categoryRates.length} nhóm hàng`;
}

const emptyProgram = (): ISaveBonusProgram => ({
  name: 'Hoa hồng đơn online',
  note: null,
  isActive: true,
  sources: ['Online'],
  mode: 'PercentOfRevenue',
  ratePercent: 3,
  fixedAmount: null,
  minOrderTotal: null,
  excludeDiscountRatio: 0.3,
  recipient: 'Closer',
  returnDays: 15,
  startOn: fDate(new Date(Date.now() + 15 * 86_400_000), 'yyyy-MM-dd'),
  endOn: null,
  payFrom: null,
  categoryRates: [],
});

// ── Thêm / sửa chương trình ─────────────────────────────────────────────

function ProgramDialog({
  program,
  open,
  onClose,
  onSaved,
}: {
  program: IBonusProgram | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<ISaveBonusProgram>(emptyProgram());
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const locked = program?.locked ?? false;

  useEffect(() => {
    getAllCategories()
      .then((list) => setCategories(list.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (program) {
      const { id, locked: _l, noticeWarning: _w, ...rest } = program;
      setForm(rest);
    } else {
      setForm(emptyProgram());
    }
  }, [open, program]);

  const set = <K extends keyof ISaveBonusProgram>(key: K, value: ISaveBonusProgram[K]) => setForm((f) => ({ ...f, [key]: value }));
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '…';

  const valid =
    form.name.trim() &&
    form.sources.length > 0 &&
    (form.mode !== 'PercentOfRevenue' || ((form.ratePercent ?? 0) > 0 && (form.ratePercent ?? 0) <= 50)) &&
    (form.mode !== 'FixedPerOrder' || (form.fixedAmount ?? 0) > 0) &&
    (form.mode !== 'PercentByCategory' || (form.categoryRates.length > 0 && form.categoryRates.every((r) => r.ratePercent > 0 && r.ratePercent <= 50)));

  const submit = async () => {
    setSaving(true);
    try {
      const saved = await saveBonusProgram(program?.id ?? null, { ...form, name: form.name.trim() });
      enqueueSnackbar(saved.noticeWarning ? `Đã lưu. ${saved.noticeWarning}` : 'Đã lưu chương trình thưởng', {
        variant: saved.noticeWarning ? 'warning' : 'success',
      });
      onSaved();
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được chương trình'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>{program ? 'Sửa chương trình thưởng' : 'Thêm chương trình thưởng'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {locked && (
            <Alert severity="warning">
              Đã trả vào lương từ {fDate(program?.payFrom, 'dd/MM/yyyy')} — không sửa cách tính được (Quy chế Điều 29, không hồi tố).
              Muốn đổi mức thưởng: đặt ngày kết thúc ở đây và thêm chương trình mới.
            </Alert>
          )}
          <TextField label="Tên chương trình" value={form.name} onChange={(e) => set('name', e.target.value)} />

          <Stack>
            <Typography variant="subtitle2">Nguồn đơn</Typography>
            {SOURCES.map((s) => (
              <FormControlLabel
                key={s}
                disabled={locked}
                control={
                  <Checkbox
                    checked={form.sources.includes(s)}
                    onChange={(e) =>
                      set('sources', e.target.checked ? [...form.sources, s] : form.sources.filter((x) => x !== s))
                    }
                  />
                }
                label={BONUS_SOURCE_LABEL[s]}
              />
            ))}
            <Typography variant="caption" color="text.secondary">
              Đơn online = Admin đánh dấu ở tab &quot;Đánh dấu đơn&quot;, hoặc hoá đơn KiotViet ở kênh bán online (Facebook, Shopee…).
            </Typography>
          </Stack>

          <TextField
            select
            disabled={locked}
            label="Cách tính"
            value={form.mode}
            onChange={(e) => set('mode', e.target.value as BonusProgramMode)}
          >
            {(Object.keys(BONUS_MODE_LABEL) as BonusProgramMode[]).map((m) => (
              <MenuItem key={m} value={m}>
                {BONUS_MODE_LABEL[m]}
              </MenuItem>
            ))}
          </TextField>
          {form.mode === 'PercentOfRevenue' && (
            <TextField
              disabled={locked}
              label="Tỷ lệ (%)"
              value={form.ratePercent ?? ''}
              onChange={(e) => set('ratePercent', e.target.value === '' ? null : Number(e.target.value.replace(',', '.')))}
              inputProps={{ inputMode: 'decimal' }}
            />
          )}
          {form.mode === 'FixedPerOrder' && (
            <TextField
              disabled={locked}
              label="Tiền mỗi đơn (đ)"
              value={form.fixedAmount ?? ''}
              onChange={(e) => set('fixedAmount', parseAmount(e.target.value))}
            />
          )}
          {form.mode === 'PercentByCategory' && (
            <Stack spacing={1}>
              {form.categoryRates.map((r, i) => (
                <Stack key={r.categoryId} direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ flex: 1 }}>{categoryName(r.categoryId)}</Typography>
                  <TextField
                    size="small"
                    disabled={locked}
                    label="%"
                    value={r.ratePercent}
                    onChange={(e) =>
                      set(
                        'categoryRates',
                        form.categoryRates.map((x, j) => (j === i ? { ...x, ratePercent: Number(e.target.value.replace(',', '.')) || 0 } : x))
                      )
                    }
                    sx={{ width: 90 }}
                  />
                  <IconButton
                    disabled={locked}
                    onClick={() => set('categoryRates', form.categoryRates.filter((_, j) => j !== i))}
                  >
                    <Iconify icon="mingcute:close-line" />
                  </IconButton>
                </Stack>
              ))}
              <Autocomplete
                disabled={locked}
                options={categories.filter((c) => !form.categoryRates.some((r) => r.categoryId === c.id))}
                getOptionLabel={(o) => o.name}
                value={null}
                onChange={(_, v) => v && set('categoryRates', [...form.categoryRates, { categoryId: v.id, ratePercent: 3 }])}
                renderInput={(params) => <TextField {...params} label="Thêm nhóm hàng (gồm nhóm con)" />}
              />
            </Stack>
          )}

          <TextField
            disabled={locked}
            label="Chỉ tính đơn từ (đ) — để trống = mọi đơn"
            value={form.minOrderTotal ?? ''}
            onChange={(e) => set('minOrderTotal', parseAmount(e.target.value))}
          />
          <FormControlLabel
            disabled={locked}
            control={
              <Switch checked={form.excludeDiscountRatio != null} onChange={(e) => set('excludeDiscountRatio', e.target.checked ? 0.3 : null)} />
            }
            label="Bỏ hàng xả (dòng giảm từ 30%)"
          />

          <Stack>
            <Typography variant="subtitle2">Ai nhận thưởng</Typography>
            <RadioGroup value={form.recipient} onChange={(e) => set('recipient', e.target.value as BonusRecipient)}>
              {(Object.keys(BONUS_RECIPIENT_LABEL) as BonusRecipient[]).map((r) => (
                <FormControlLabel key={r} value={r} disabled={locked} control={<Radio />} label={BONUS_RECIPIENT_LABEL[r]} />
              ))}
            </RadioGroup>
          </Stack>

          <TextField
            disabled={locked}
            label="Hạn đổi trả (ngày) — đơn được tính sau ngần này ngày"
            value={form.returnDays}
            onChange={(e) => set('returnDays', Number(e.target.value) || 0)}
            inputProps={{ inputMode: 'numeric' }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="date"
              disabled={locked}
              label="Đơn từ ngày"
              value={form.startOn}
              onChange={(e) => set('startOn', e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              type="date"
              label="Đến ngày (trống = chưa kết thúc)"
              value={form.endOn ?? ''}
              onChange={(e) => set('endOn', e.target.value || null)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
          <TextField
            type="date"
            disabled={locked}
            label="Trả vào lương từ ngày (trống = chỉ tính thử)"
            value={form.payFrom ?? ''}
            onChange={(e) => set('payFrom', e.target.value || null)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField label="Ghi chú" value={form.note ?? ''} onChange={(e) => set('note', e.target.value || null)} multiline minRows={2} />
          <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />} label="Đang dùng" />
          <Typography variant="caption" color="text.secondary">
            Quy chế Điều 29: đổi tỷ lệ / mức thưởng công bố trước ít nhất 15 ngày; Quy chế Điều 27: hoa hồng đơn online áp dụng
            chính thức từ Quý I/2027 — trước đó để trống ngày trả vào lương để chỉ tính thử.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!valid} onClick={submit}>
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

function ProgramsTab({ programs, onChanged }: { programs: IBonusProgram[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<IBonusProgram | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ p: 2 }}>
        <Button
          variant="contained"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Thêm chương trình
        </Button>
      </Stack>
      {programs.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 3, pt: 0 }}>
          Chưa có chương trình thưởng theo đơn nào.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Chương trình</TableCell>
                <TableCell>Nguồn đơn</TableCell>
                <TableCell>Cách tính</TableCell>
                <TableCell>Thời gian</TableCell>
                <TableCell>Vào lương</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {programs.map((p) => (
                <TableRow
                  key={p.id}
                  hover
                  sx={{ cursor: 'pointer', opacity: p.isActive ? 1 : 0.55 }}
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                >
                  <TableCell>
                    {p.name}
                    {p.noticeWarning && (
                      <Typography variant="caption" color="warning.main" display="block">
                        {p.noticeWarning}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {p.sources.map((s) => (
                        <Chip key={s} size="small" label={BONUS_SOURCE_LABEL[s]} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {describe(p)}
                    <Typography variant="caption" color="text.secondary" display="block">
                      {p.recipient === 'Closer' ? 'Người chốt' : 'Chia cho ca'} · đổi trả {p.returnDays} ngày
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {fDate(p.startOn, 'dd/MM/yyyy')} → {p.endOn ? fDate(p.endOn, 'dd/MM/yyyy') : '…'}
                  </TableCell>
                  <TableCell>
                    {p.payFrom ? (
                      <Chip size="small" color="success" label={`Từ ${fDate(p.payFrom, 'dd/MM/yyyy')}`} />
                    ) : (
                      <Chip size="small" label="Tính thử" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <ProgramDialog program={editing} open={open} onClose={() => setOpen(false)} onSaved={onChanged} />
    </>
  );
}

// ── Kết quả tháng ───────────────────────────────────────────────────────

function MonthTab({ programs }: { programs: IBonusProgram[] }) {
  const { enqueueSnackbar } = useSnackbar();
  const [programId, setProgramId] = useState('');
  const [month, setMonth] = useState(fDate(new Date(), 'yyyy-MM'));
  const [result, setResult] = useState<IBonusProgramMonth | null>(null);

  useEffect(() => {
    if (!programId && programs.length > 0) setProgramId(programs[0].id);
  }, [programs, programId]);

  useEffect(() => {
    if (!programId || !month) return;
    setResult(null);
    getBonusProgramMonth(programId, `${month}-01`)
      .then(setResult)
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tính được kết quả tháng'), { variant: 'error' }));
  }, [programId, month, enqueueSnackbar]);

  if (programs.length === 0)
    return (
      <Typography color="text.secondary" sx={{ p: 3 }}>
        Thêm chương trình trước.
      </Typography>
    );

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField select label="Chương trình" value={programId} onChange={(e) => setProgramId(e.target.value)} sx={{ minWidth: 260 }}>
          {programs.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField type="month" label="Tháng" value={month} onChange={(e) => setMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
      </Stack>
      {result && (
        <>
          <Alert severity="info">
            Đơn hết hạn đổi trả trong tháng: tổng {fVnd(result.total)}, trong đó vào lương {fVnd(result.paidTotal)} (phần còn lại là
            tính thử).
          </Alert>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nhân viên</TableCell>
                  <TableCell align="right">Số đơn</TableCell>
                  <TableCell align="right">Thưởng</TableCell>
                  <TableCell align="right">Vào lương</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.people.map((p) => (
                  <TableRow key={p.userId}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell align="right">{p.orders}</TableCell>
                    <TableCell align="right">{fVnd(p.amount)}</TableCell>
                    <TableCell align="right">{fVnd(p.paidAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="subtitle2">Đơn được tính ({result.orders.length})</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Hoá đơn</TableCell>
                  <TableCell>Nguồn</TableCell>
                  <TableCell>Hết hạn đổi trả</TableCell>
                  <TableCell align="right">Doanh thu tính</TableCell>
                  <TableCell align="right">Thưởng</TableCell>
                  <TableCell>Người nhận</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.orders.map((o) => (
                  <TableRow key={o.orderId}>
                    <TableCell>
                      {o.code}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {fDate(o.atVn, 'dd/MM HH:mm')}
                      </Typography>
                    </TableCell>
                    <TableCell>{BONUS_SOURCE_LABEL[o.source]}</TableCell>
                    <TableCell>{fDate(o.eligibleOn, 'dd/MM')}</TableCell>
                    <TableCell align="right">{fVnd(o.base)}</TableCell>
                    <TableCell align="right">
                      {fVnd(o.amount)}
                      {!o.paid && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          tính thử
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {o.shares.map((s) => s.name).join(', ') || '—'}
                      {o.toShift && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          chia cho ca đang làm
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Stack>
  );
}

// ── Đánh dấu đơn online / người chốt ────────────────────────────────────

function OrderRow({ order, staff, onSaved }: { order: IBonusOrder; staff: { id: string; name: string }[]; onSaved: (o: IBonusOrder) => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [busy, setBusy] = useState(false);
  const closer = staff.find((s) => s.id === order.closerUserId) ?? null;

  const save = async (isOnline: boolean, closerUserId: string | null) => {
    setBusy(true);
    try {
      onSaved(await setBonusOrderAttribution(order.id, { isOnline, closerUserId }));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <TableRow>
      <TableCell>
        {order.code}
        <Typography variant="caption" color="text.secondary" display="block">
          {fDate(order.atVn, 'dd/MM HH:mm')}
        </Typography>
      </TableCell>
      <TableCell align="right">{fVnd(order.total)}</TableCell>
      <TableCell>{BONUS_SOURCE_LABEL[order.source]}</TableCell>
      <TableCell>
        <Switch
          size="small"
          checked={order.markedOnline}
          disabled={busy || order.source === 'Web'}
          onChange={(e) => save(e.target.checked, order.closerSetByAdmin ? order.closerUserId ?? null : null)}
        />
      </TableCell>
      <TableCell sx={{ minWidth: 240 }}>
        <Autocomplete
          size="small"
          disabled={busy}
          options={staff}
          value={closer}
          getOptionLabel={(o) => o.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(_, v) => save(order.markedOnline, v?.id ?? null)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={order.closerName ?? 'Ca đang làm'}
              helperText={order.closerSetByAdmin ? 'Admin đặt' : order.closerName ? 'Người lập hoá đơn' : 'Không có — chia cho ca'}
            />
          )}
        />
      </TableCell>
    </TableRow>
  );
}

function OrdersTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [from, setFrom] = useState(fDate(new Date(Date.now() - 6 * 86_400_000), 'yyyy-MM-dd'));
  const [to, setTo] = useState(fDate(new Date(), 'yyyy-MM-dd'));
  const [orders, setOrders] = useState<IBonusOrder[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    getActiveStaffUsers()
      .then((list) => setStaff(list.map((u) => ({ id: u.id, name: u.fullName || `${u.firstName} ${u.lastName}`.trim() }))))
      .catch(() => setStaff([]));
  }, []);

  const load = useCallback(async () => {
    try {
      setOrders(await getBonusOrders(from, to));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được hoá đơn'), { variant: 'error' });
    }
  }, [from, to, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => orders.filter((o) => !keyword.trim() || o.code.toLowerCase().includes(keyword.trim().toLowerCase())),
    [orders, keyword]
  );

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2 }}>
        <TextField type="date" label="Từ ngày" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField type="date" label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="Mã hoá đơn" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </Stack>
      <Alert severity="info" sx={{ mx: 2, mb: 1 }}>
        Bật &quot;Đơn online&quot; cho hoá đơn chốt qua inbox (đơn online không tính vào thưởng doanh số tuần). Người chốt để trống thì
        thưởng chia cho người đang làm ca lúc bán. Chỉ Admin sửa được.
      </Alert>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Hoá đơn</TableCell>
              <TableCell align="right">Tổng</TableCell>
              <TableCell>Nguồn</TableCell>
              <TableCell>Đơn online</TableCell>
              <TableCell>Người chốt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((o) => (
              <OrderRow key={o.id} order={o} staff={staff} onSaved={(n) => setOrders((list) => list.map((x) => (x.id === n.id ? n : x)))} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

// ── Trang ───────────────────────────────────────────────────────────────

export function BonusProgramsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState<'programs' | 'month' | 'orders'>('programs');
  const [programs, setPrograms] = useState<IBonusProgram[]>([]);

  const load = useCallback(async () => {
    try {
      setPrograms(await getBonusPrograms());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được chương trình thưởng'), { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Chương trình thưởng"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Lương' }, { name: 'Chương trình thưởng' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        Thưởng theo đơn (hoa hồng đơn online…): đơn được tính khi hết hạn đổi trả, trả vào kỳ lương cuối tháng. Thưởng doanh số tuần
        cấu hình ở trang Chính sách ngày lễ.
      </Alert>
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab value="programs" label="Chương trình" />
          <Tab value="month" label="Kết quả tháng" />
          <Tab value="orders" label="Đánh dấu đơn" />
        </Tabs>
        {tab === 'programs' && <ProgramsTab programs={programs} onChanged={load} />}
        {tab === 'month' && <MonthTab programs={programs} />}
        {tab === 'orders' && <OrdersTab />}
      </Card>
    </Container>
  );
}
