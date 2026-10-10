'use client';

import type { FnbDocStatus, FnbCountScope, IFnbStockCount, IFnbStockCountLine, IFnbStockIngredient } from 'src/types/fnb';

import { useRef, useState, useEffect, useCallback } from 'react';

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
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import {
  getFnbStock,
  getFnbStockCount,
  saveFnbStockCount,
  getFnbStockCounts,
  createFnbStockCount,
  reviewFnbStockCount,
} from 'src/api/fnb';

import { useFnbBranches } from 'src/sections/fnb-pos/use-fnb-branches';

import { fQty } from './lib/stock';
import { DOC_STATUS, biggestUnit, countParts } from './lib/documents';

// ----------------------------------------------------------------------
// Phiếu kiểm kho nguyên liệu: lập phiếu (phạm vi) → đếm (tự lưu, nhập "2 hộp + 150 ml"; nhân viên đếm mù) → nộp → chủ /
// quản lý xem chênh lệch so với tồn LÚC ĐẾM, ghi lý do dòng chênh lớn, chốt → kho cập nhật phần chênh.
// ----------------------------------------------------------------------

type StatusTab = 'Draft' | 'Pending' | 'Completed' | 'All';

const SAVE_DELAY_MS = 800;

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

export default function FnbStockCountsView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const manager = ['Admin', 'Manager'].some((r) => user?.role === r || (user?.roles ?? []).includes(r));
  const { branches, branchId, setBranchId } = useFnbBranches();

  const [tab, setTab] = useState<StatusTab>('Draft');
  const [counts, setCounts] = useState<IFnbStockCount[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    try {
      setCounts(await getFnbStockCounts(branchId, tab === 'All' ? undefined : (tab as FnbDocStatus)));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được phiếu kiểm kho'), { variant: 'error' });
      setCounts([]);
    }
  }, [branchId, tab, enqueueSnackbar]);

  useEffect(() => {
    setCounts(null);
    load();
  }, [load]);

  // Mở thẳng một phiếu qua ?id= (link từ thông báo).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setOpenId(id);
  }, []);

  if (openId) {
    return (
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <FnbStockCountScreen
          id={openId}
          manager={manager}
          userId={user?.id ?? ''}
          onBack={() => {
            setOpenId(null);
            load();
          }}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Kiểm kho nguyên liệu"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho nguyên liệu', href: paths.dashboard.fnb.stock },
          { name: 'Kiểm kho' },
        ]}
        action={
          <Stack direction="row" spacing={1}>
            {branches && branches.length > 1 && (
              <TextField select size="small" label="Chi nhánh" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.branchName}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              disabled={!branchId}
              onClick={() => setCreateOpen(true)}
            >
              Lập phiếu kiểm
            </Button>
          </Stack>
        }
        sx={{ mb: 3 }}
      />

      {branches?.length === 0 && <Alert severity="info">Chưa có chi nhánh F&amp;B nào bạn được làm.</Alert>}

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab value="Draft" label="Đang đếm" />
          <Tab value="Pending" label="Chờ chốt" />
          <Tab value="Completed" label="Hoàn tất" />
          <Tab value="All" label="Tất cả" />
        </Tabs>
        {counts === null ? (
          <Stack alignItems="center" sx={{ py: 5 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Phiếu</TableCell>
                  <TableCell>Phạm vi</TableCell>
                  <TableCell align="right">Đã đếm</TableCell>
                  {manager && <TableCell align="right">Chênh lệch</TableCell>}
                  <TableCell>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {counts.map((c) => (
                  <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpenId(c.id)}>
                    <TableCell>
                      <Typography variant="subtitle2">{c.code}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {time(c.createdAt)} · {c.createdByName}
                      </Typography>
                    </TableCell>
                    <TableCell>{c.scope}</TableCell>
                    <TableCell align="right">
                      {c.countedLines}/{c.totalLines}
                    </TableCell>
                    {manager && (
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={(c.totalVarianceValue ?? 0) < 0 ? 'error.main' : 'text.primary'}
                        >
                          {c.totalVarianceValue == null ? '—' : fCurrency(c.totalVarianceValue)}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Chip size="small" variant="soft" color={DOC_STATUS[c.status].color} label={DOC_STATUS[c.status].label} />
                    </TableCell>
                  </TableRow>
                ))}
                {counts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                        Không có phiếu.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <FnbStockCountCreateDialog
        open={createOpen}
        branchId={branchId}
        onClose={() => setCreateOpen(false)}
        onCreated={(count) => {
          setCreateOpen(false);
          setOpenId(count.id);
        }}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

type CreateProps = { open: boolean; branchId: string; onClose: VoidFunction; onCreated: (count: IFnbStockCount) => void };

function FnbStockCountCreateDialog({ open, branchId, onClose, onCreated }: CreateProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [scope, setScope] = useState<FnbCountScope>('Recipe');
  const [picked, setPicked] = useState<IFnbStockIngredient[]>([]);
  const [ingredients, setIngredients] = useState<IFnbStockIngredient[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScope('Recipe');
    setPicked([]);
    setNote('');
    getFnbStock(branchId)
      .then((r) => setIngredients(r.ingredients))
      .catch(() => setIngredients([]));
  }, [open, branchId]);

  const save = async () => {
    setSaving(true);
    try {
      onCreated(
        await createFnbStockCount({
          branchId,
          scope,
          productIds: scope === 'Products' ? picked.map((p) => p.id) : undefined,
          note: note.trim() || null,
        })
      );
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lập được phiếu kiểm'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={saving ? undefined : onClose}>
      <DialogTitle>Lập phiếu kiểm kho</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <RadioGroup value={scope} onChange={(e) => setScope(e.target.value as FnbCountScope)}>
            <FormControlLabel value="Recipe" control={<Radio />} label="Nguyên liệu có trong định lượng (kiểm hằng ngày)" />
            <FormControlLabel value="All" control={<Radio />} label="Tất cả nguyên liệu (kiểm định kỳ)" />
            <FormControlLabel value="Products" control={<Radio />} label="Chọn từng nguyên liệu" />
          </RadioGroup>
          {scope === 'Products' && (
            <Autocomplete
              multiple
              size="small"
              options={ingredients}
              value={picked}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, v) => setPicked(v)}
              renderInput={(params) => <TextField {...params} label="Nguyên liệu" />}
            />
          )}
          <TextField label="Ghi chú (ca, người đếm…)" value={note} onChange={(e) => setNote(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={scope === 'Products' && picked.length === 0}
          onClick={save}
        >
          Lập phiếu &amp; bắt đầu đếm
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

type Inputs = Record<string, { big: string; base: string }>;

type ScreenProps = { id: string; manager: boolean; userId: string; onBack: VoidFunction };

function FnbStockCountScreen({ id, manager, userId, onBack }: ScreenProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [count, setCount] = useState<IFnbStockCount | null>(null);
  const [inputs, setInputs] = useState<Inputs>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [returnNote, setReturnNote] = useState('');
  const dirty = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getFnbStockCount(id)
      .then((c) => {
        setCount(c);
        setInputs(
          Object.fromEntries(
            (c.lines ?? []).map((l) => [l.lineId, { big: '', base: l.isCounted && l.countedQuantity != null ? String(l.countedQuantity) : '' }])
          )
        );
        setReasons(Object.fromEntries((c.lines ?? []).map((l) => [l.lineId, l.varianceReason ?? ''])));
      })
      .catch(() => enqueueSnackbar('Không tải được phiếu', { variant: 'error' }));
  }, [id, enqueueSnackbar]);

  const editable = !!count && (count.status === 'Draft' || (manager && count.status === 'Pending'));

  const flush = useCallback(async () => {
    if (!count || dirty.current.size === 0) return;
    const lines = (count.lines ?? []).filter((l) => dirty.current.has(l.lineId));
    const entries = lines
      .map((l) => {
        const parts = countParts(biggestUnit(l.units), inputs[l.lineId]?.big ?? '', inputs[l.lineId]?.base ?? '');
        return parts === undefined ? null : { lineId: l.lineId, parts: parts ?? [] };
      })
      .filter((e): e is { lineId: string; parts: { unitId: string | null; quantity: number }[] } => e !== null);
    dirty.current.clear();
    if (entries.length === 0) return;
    setSaving(true);
    try {
      setCount(await saveFnbStockCount(count.id, entries));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lưu được số đếm'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }, [count, inputs, enqueueSnackbar]);

  useEffect(() => {
    if (dirty.current.size === 0) return undefined;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [inputs, flush]);

  const change = (lineId: string, patch: Partial<{ big: string; base: string }>) => {
    dirty.current.add(lineId);
    setInputs((prev) => ({ ...prev, [lineId]: { ...(prev[lineId] ?? { big: '', base: '' }), ...patch } }));
  };

  const act = async (action: 'submit' | 'approve' | 'return' | 'cancel') => {
    if (!count) return;
    if (timer.current) clearTimeout(timer.current);
    await flush();
    setBusy(true);
    try {
      const next = await reviewFnbStockCount(
        count.id,
        action,
        action === 'return' ? returnNote.trim() : null,
        action === 'approve'
          ? Object.entries(reasons)
              .filter(([, r]) => r.trim())
              .map(([lineId, reason]) => ({ lineId, reason: reason.trim() }))
          : undefined
      );
      setCount(next);
      enqueueSnackbar(
        { submit: 'Đã nộp — chờ chủ / quản lý chốt', approve: 'Đã chốt — kho đã cập nhật', return: 'Đã trả lại để đếm lại', cancel: 'Đã huỷ phiếu' }[action]
      );
      if (action !== 'return') onBack();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không thực hiện được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!count) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const lines = count.lines ?? [];
  const missingReason = lines.some((l) => l.needsReason && !(reasons[l.lineId] ?? '').trim());
  const canCancel = (count.status === 'Draft' || count.status === 'Pending') && (manager || count.createdById === userId);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Button startIcon={<Iconify icon="eva:arrow-ios-back-fill" />} onClick={onBack}>
          Danh sách
        </Button>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {count.code}{' '}
          <Chip size="small" variant="soft" color={DOC_STATUS[count.status].color} label={DOC_STATUS[count.status].label} />
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {saving ? 'Đang lưu…' : editable ? 'Đã lưu' : ''}
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        {count.scope} · lập {time(count.createdAt)} bởi {count.createdByName}
        {count.submittedByName ? ` · nộp bởi ${count.submittedByName} ${time(count.submittedAt)}` : ''}
        {count.reviewedByName ? ` · ${count.reviewedByName} ${time(count.reviewedAt)}` : ''}
      </Typography>
      {count.reviewNote && <Alert severity="info">Ghi chú: {count.reviewNote}</Alert>}
      {count.blind && editable && (
        <Alert severity="info">Đếm thực tế từng nguyên liệu rồi nhập vào ô — không cần biết số trên hệ thống. Số được lưu tự động.</Alert>
      )}
      {manager && (
        <Typography variant="subtitle2">
          Đã đếm {count.countedLines}/{count.totalLines} · Tổng chênh lệch:{' '}
          <Typography component="span" color={(count.totalVarianceValue ?? 0) < 0 ? 'error.main' : 'success.main'}>
            {fCurrency(count.totalVarianceValue ?? 0)}
          </Typography>
        </Typography>
      )}

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nguyên liệu</TableCell>
                <TableCell>Đếm được</TableCell>
                {manager && <TableCell align="right">Tồn lúc đếm</TableCell>}
                {manager && <TableCell align="right">Chênh</TableCell>}
                {manager && <TableCell>Lý do chênh</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((l) => (
                <CountRow
                  key={l.lineId}
                  line={l}
                  manager={manager}
                  editable={editable}
                  value={inputs[l.lineId] ?? { big: '', base: '' }}
                  reason={reasons[l.lineId] ?? ''}
                  onChange={(patch) => change(l.lineId, patch)}
                  onReason={(r) => setReasons((p) => ({ ...p, [l.lineId]: r }))}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {manager && count.status === 'Pending' && (
        <TextField size="small" label="Ghi chú khi trả lại để đếm lại" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
      )}
      {missingReason && editable && manager && <Alert severity="warning">Dòng chênh lệch lớn (đánh dấu đỏ) cần ghi lý do trước khi chốt.</Alert>}

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        {canCancel && (
          <LoadingButton color="error" loading={busy} onClick={() => act('cancel')}>
            Huỷ phiếu
          </LoadingButton>
        )}
        {manager && count.status === 'Pending' && (
          <LoadingButton loading={busy} disabled={!returnNote.trim()} onClick={() => act('return')}>
            Trả lại đếm lại
          </LoadingButton>
        )}
        {count.status === 'Draft' && !manager && (
          <LoadingButton variant="contained" loading={busy} disabled={count.countedLines === 0} onClick={() => act('submit')}>
            Nộp để chốt
          </LoadingButton>
        )}
        {manager && (count.status === 'Draft' || count.status === 'Pending') && (
          <LoadingButton
            variant="contained"
            loading={busy}
            disabled={count.countedLines === 0 || missingReason}
            onClick={() => act('approve')}
          >
            Chốt &amp; cập nhật kho
          </LoadingButton>
        )}
      </Stack>
    </Stack>
  );
}

type RowProps = {
  line: IFnbStockCountLine;
  manager: boolean;
  editable: boolean;
  value: { big: string; base: string };
  reason: string;
  onChange: (patch: Partial<{ big: string; base: string }>) => void;
  onReason: (reason: string) => void;
};

function CountRow({ line, manager, editable, value, reason, onChange, onReason }: RowProps) {
  const big = biggestUnit(line.units);
  const invalid = countParts(big, value.big, value.base) === undefined;
  const negative = (line.variance ?? 0) < 0;
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="subtitle2">{line.productName}</Typography>
        <Typography variant="caption" color="text.secondary">
          {line.isCounted ? `${line.countEntry ?? ''} · ${line.countedByName ?? ''} ${time(line.countedAt)}` : 'Chưa đếm'}
        </Typography>
      </TableCell>
      <TableCell>
        {editable ? (
          <Stack direction="row" spacing={1}>
            {big && (
              <TextField
                size="small"
                type="number"
                value={value.big}
                error={invalid}
                onChange={(e) => onChange({ big: e.target.value })}
                inputProps={{ min: 0, step: 'any' }}
                InputProps={{ endAdornment: <InputAdornment position="end">{big.name}</InputAdornment> }}
                sx={{ width: 130 }}
              />
            )}
            <TextField
              size="small"
              type="number"
              value={value.base}
              error={invalid}
              onChange={(e) => onChange({ base: e.target.value })}
              inputProps={{ min: 0, step: 'any' }}
              InputProps={{ endAdornment: <InputAdornment position="end">{line.unit ?? ''}</InputAdornment> }}
              sx={{ width: 140 }}
            />
          </Stack>
        ) : (
          <Typography variant="body2">
            {line.isCounted ? `${fQty(line.countedQuantity ?? 0)} ${line.unit ?? ''}` : '—'}
          </Typography>
        )}
      </TableCell>
      {manager && (
        <TableCell align="right">{line.systemQuantity == null ? '—' : `${fQty(line.systemQuantity)} ${line.unit ?? ''}`}</TableCell>
      )}
      {manager && (
        <TableCell align="right">
          {line.variance == null ? (
            '—'
          ) : (
            <Stack>
              <Typography variant="body2" color={negative ? 'error.main' : line.variance > 0 ? 'success.main' : 'text.primary'}>
                {line.variance > 0 ? '+' : ''}
                {fQty(line.variance)} {line.unit ?? ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {fCurrency(line.varianceValue ?? 0)}
              </Typography>
            </Stack>
          )}
        </TableCell>
      )}
      {manager && (
        <TableCell>
          {line.isCounted && (line.variance ?? 0) !== 0 && editable ? (
            <TextField
              size="small"
              value={reason}
              error={line.needsReason && !reason.trim()}
              placeholder={line.needsReason ? 'Bắt buộc' : 'Tuỳ chọn'}
              onChange={(e) => onReason(e.target.value)}
              sx={{ minWidth: 160 }}
            />
          ) : (
            <Typography variant="caption">{line.varianceReason ?? ''}</Typography>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}
