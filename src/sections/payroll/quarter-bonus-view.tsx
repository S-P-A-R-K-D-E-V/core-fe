'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import {
  getQuarterBonus,
  closeQuarterBonus,
  reopenQuarterBonus,
  getQuarterBonusStaff,
  overrideQuarterBonus,
  refreshQuarterBonus,
  saveQuarterBonusStaff,
  saveQuarterBonusPolicy,
  getQuarterBonusPolicies,
} from 'src/api/quarter-bonus';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type {
  QuarterBonusTier,
  IQuarterBonusRun,
  QuarterBonusStatus,
  IQuarterBonusStaff,
  IQuarterBonusPolicy,
  IQuarterBonusPerson,
  QuarterBonusProration,
  ISaveQuarterBonusPolicy,
} from 'src/types/quarter-bonus';

import { fVnd, parseAmount } from '../hr/hr-common';

// ----------------------------------------------------------------------
// Thưởng hoàn thành quý — chỉ Admin: kết quả từng người, đóng quý, chỉnh tay có lý do; mức thưởng theo ngày hiệu lực; ngày vào làm
// và ai là quản lý cửa hàng.
// ----------------------------------------------------------------------

const STATUS: Record<QuarterBonusStatus, { label: string; color: 'success' | 'warning' | 'error' }> = {
  Eligible: { label: 'Đủ điều kiện', color: 'success' },
  AtRisk: { label: 'Rủi ro', color: 'warning' },
  Lost: { label: 'Mất', color: 'error' },
};

const TIER: Record<QuarterBonusTier, string> = { Staff: 'Nhân viên', StoreManager: 'Quản lý cửa hàng' };

/** Ngày đầu quý của date, dạng yyyy-MM-dd theo giờ máy. */
function quarterOf(date: Date): string {
  const month = Math.floor(date.getMonth() / 3) * 3 + 1;
  return `${date.getFullYear()}-${String(month).padStart(2, '0')}-01`;
}

function quarterOptions(now = new Date()): { value: string; label: string }[] {
  return [0, -3, -6, -9].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { value: quarterOf(d), label: `Quý ${Math.floor(d.getMonth() / 3) + 1}/${d.getFullYear()}` };
  });
}

// ── Chỉnh tay ──────────────────────────────────────────────────────────

function OverrideDialog({
  person,
  onClose,
  onSaved,
}: {
  person: IQuarterBonusPerson | null;
  onClose: () => void;
  onSaved: (run: IQuarterBonusRun | null) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAmount(person?.overrideAmount != null ? String(person.overrideAmount) : '');
    setReason(person?.overrideReason ?? '');
  }, [person]);

  const save = async (clear: boolean) => {
    if (!person) return;
    setSaving(true);
    try {
      onSaved(await overrideQuarterBonus(person.id, clear ? null : parseAmount(amount), reason.trim()));
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!person} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Chỉnh tay: {person?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Mức tính được: {fVnd(person?.cappedAmount)}. Mức chỉnh tay không bị giảm theo trần và chiếm trước phần trần của mọi người.
          </Typography>
          <TextField label="Số tiền" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} required />
        </Stack>
      </DialogContent>
      <DialogActions>
        {person?.overrideAmount != null && (
          <Button color="inherit" onClick={() => save(true)} disabled={saving || !reason.trim()} sx={{ mr: 'auto' }}>
            Bỏ chỉnh tay
          </Button>
        )}
        <Button color="inherit" onClick={onClose}>
          Huỷ
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={parseAmount(amount) == null || !reason.trim()}
          onClick={() => save(false)}
        >
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ── Kết quả ────────────────────────────────────────────────────────────

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Box sx={{ minWidth: 150, flex: '1 1 150px' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

function ResultsTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [askConfirm, confirmDialog] = useConfirmDialog();
  const options = useMemo(() => quarterOptions(), []);
  const [quarter, setQuarter] = useState(options[0].value);
  const [run, setRun] = useState<IQuarterBonusRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<IQuarterBonusPerson | null>(null);
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    getQuarterBonus(quarter)
      .then(setRun)
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được kết quả'), { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [quarter, enqueueSnackbar]);

  useEffect(load, [load]);

  const act = async (action: () => Promise<IQuarterBonusRun | null>, done: string) => {
    setBusy(true);
    try {
      setRun(await action());
      enqueueSnackbar(done);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không thực hiện được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    const ok = await askConfirm({
      title: 'Đóng thưởng quý này?',
      content: 'Mức thưởng được chốt và vào kỳ lương kết thúc ngày cuối quý. Sau khi đóng cần tính lại kỳ lương đó để dòng thưởng vào phiếu.',
      confirmText: 'Đóng quý',
      cancelText: 'Huỷ',
    });
    if (ok) await act(() => closeQuarterBonus(quarter), 'Đã đóng quý');
  };

  const closed = run?.status === 'Closed';

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <TextField select size="small" label="Quý" value={quarter} onChange={(e) => setQuarter(e.target.value)} sx={{ minWidth: 150 }}>
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        {run && <Chip color={closed ? 'success' : 'default'} label={closed ? 'Đã đóng' : 'Tạm tính'} />}
        <Box sx={{ flexGrow: 1 }} />
        {!closed && (
          <LoadingButton loading={busy} variant="outlined" onClick={() => act(() => refreshQuarterBonus(quarter), 'Đã tính lại')}>
            Tính lại
          </LoadingButton>
        )}
        {run?.canClose && (
          <LoadingButton loading={busy} variant="contained" onClick={close}>
            Đóng quý
          </LoadingButton>
        )}
        {closed && (
          <Button color="inherit" variant="outlined" onClick={() => setReopening(true)}>
            Mở lại
          </Button>
        )}
      </Stack>

      {loading && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      )}

      {!loading && !run && (
        <Alert severity="info">Chưa có kết quả cho quý này. Kiểm tra mức thưởng ở tab Mức thưởng rồi bấm Tính lại.</Alert>
      )}

      {!loading && run && (
        <>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
            <Figure label="Doanh thu" value={fVnd(run.revenue)} hint={`Từ ${fDate(run.windowStart, 'dd/MM/yyyy')}`} />
            <Figure label="Trần chi phí" value={fVnd(run.capAmount)} />
            <Figure label="Lương, phụ cấp, thưởng khác" value={fVnd(run.otherCost)} />
            <Figure label="Thưởng quý dự kiến" value={fVnd(run.totalPlanned)} />
            <Figure label="Thưởng quý sau trần" value={fVnd(run.totalFinal)} hint={`Hệ số ${Math.round(run.scaleFactor * 1000) / 10}%`} />
          </Stack>
          {run.scaleFactor < 1 && (
            <Alert severity="warning">Chi phí đang vượt trần, thưởng quý của mọi người được giảm đều theo hệ số trên.</Alert>
          )}
          <Typography variant="caption" color="text.secondary">
            Tính lúc {fDate(run.computedAt, 'dd/MM/yyyy HH:mm')}. Giữa quý, hệ số trần chỉ so phần thưởng tương ứng với thời gian đã qua.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nhân viên</TableCell>
                  <TableCell align="right">Giờ</TableCell>
                  <TableCell align="right">Điểm trừ cao nhất</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Dự kiến</TableCell>
                  <TableCell align="right">Sau trần</TableCell>
                  <TableCell align="right">Trả</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {run.people.map((p) => (
                  <TableRow
                    key={p.id}
                    hover={!closed}
                    sx={{ cursor: closed ? 'default' : 'pointer' }}
                    onClick={() => !closed && setEditing(p)}
                  >
                    <TableCell>
                      {p.name}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {TIER[p.tier]}
                        {p.joinedOn ? ` · vào làm ${fDate(p.joinedOn, 'dd/MM/yyyy')}` : ' · chưa có ngày vào làm'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{p.hours}</TableCell>
                    <TableCell align="right">{p.maxMonthlyPoints}</TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS[p.status].color} label={STATUS[p.status].label} />
                      {p.reasons.map((r) => (
                        <Typography key={r} variant="caption" color="text.secondary" display="block">
                          {r}
                        </Typography>
                      ))}
                    </TableCell>
                    <TableCell align="right">{fVnd(p.plannedAmount)}</TableCell>
                    <TableCell align="right">{fVnd(p.cappedAmount)}</TableCell>
                    <TableCell align="right">
                      <strong>{fVnd(p.finalAmount)}</strong>
                      {p.overrideAmount != null && (
                        <Typography variant="caption" color="warning.main" display="block">
                          Chỉnh tay: {p.overrideReason}
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

      <OverrideDialog person={editing} onClose={() => setEditing(null)} onSaved={setRun} />

      <Dialog open={reopening} onClose={() => setReopening(false)} fullWidth maxWidth="xs">
        <DialogTitle>Mở lại quý</DialogTitle>
        <DialogContent>
          <TextField
            sx={{ mt: 1 }}
            fullWidth
            required
            multiline
            minRows={2}
            label="Lý do"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setReopening(false)}>
            Huỷ
          </Button>
          <LoadingButton
            variant="contained"
            loading={busy}
            disabled={!reopenReason.trim()}
            onClick={async () => {
              await act(() => reopenQuarterBonus(quarter, reopenReason.trim()), 'Đã mở lại quý');
              setReopening(false);
              setReopenReason('');
            }}
          >
            Mở lại
          </LoadingButton>
        </DialogActions>
      </Dialog>
      {confirmDialog}
    </Stack>
  );
}

// ── Mức thưởng ─────────────────────────────────────────────────────────

const emptyPolicy = (): ISaveQuarterBonusPolicy => ({
  tier: 'Staff',
  amount: 0,
  minHours: 120,
  monthlyPointsLimit: 10,
  capRevenuePct: 15,
  proration: 'None',
  minTenureMonths: 0,
  windowStart: null,
  effectiveFrom: fDate(new Date(), 'yyyy-MM-dd'),
  effectiveTo: null,
  note: null,
});

function PoliciesTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [policies, setPolicies] = useState<IQuarterBonusPolicy[]>([]);
  const [draft, setDraft] = useState<(ISaveQuarterBonusPolicy & { id: string | null }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    getQuarterBonusPolicies()
      .then(setPolicies)
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được mức thưởng'), { variant: 'error' }));
  }, [enqueueSnackbar]);

  useEffect(load, [load]);

  const save = async () => {
    if (!draft) return;
    const { id, ...body } = draft;
    setSaving(true);
    try {
      await saveQuarterBonusPolicy(id, { ...body, windowStart: body.windowStart || null, effectiveTo: body.effectiveTo || null });
      enqueueSnackbar('Đã lưu');
      setDraft(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const num = (key: 'amount' | 'minHours' | 'monthlyPointsLimit' | 'capRevenuePct' | 'minTenureMonths', label: string) =>
    draft && (
      <TextField
        label={label}
        type="number"
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
      />
    );

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={() => setDraft({ ...emptyPolicy(), id: null })}>
          Thêm mức thưởng
        </Button>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nhóm</TableCell>
              <TableCell>Hiệu lực</TableCell>
              <TableCell align="right">Mức thưởng</TableCell>
              <TableCell align="right">Giờ tối thiểu</TableCell>
              <TableCell>Thiếu giờ</TableCell>
              <TableCell align="right">Thâm niên</TableCell>
              <TableCell align="right">Mất từ (điểm/tháng)</TableCell>
              <TableCell align="right">Trần</TableCell>
              <TableCell>Xét từ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policies.map((p) => (
              <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDraft({ ...p })}>
                <TableCell>{TIER[p.tier]}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {fDate(p.effectiveFrom, 'dd/MM/yyyy')} → {p.effectiveTo ? fDate(p.effectiveTo, 'dd/MM/yyyy') : '…'}
                </TableCell>
                <TableCell align="right">{fVnd(p.amount)}</TableCell>
                <TableCell align="right">{p.minHours}</TableCell>
                <TableCell>{p.proration === 'ByHours' ? 'Tính theo giờ' : 'Không thưởng'}</TableCell>
                <TableCell align="right">{p.minTenureMonths ? `${p.minTenureMonths} tháng` : '—'}</TableCell>
                <TableCell align="right">{p.monthlyPointsLimit}</TableCell>
                <TableCell align="right">{p.capRevenuePct}%</TableCell>
                <TableCell>{p.windowStart ? fDate(p.windowStart, 'dd/MM/yyyy') : 'Đầu quý'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {policies.length === 0 && (
        <Typography color="text.secondary">Chưa có mức thưởng nào, cửa hàng chưa áp dụng thưởng quý.</Typography>
      )}

      <Dialog open={!!draft} onClose={() => setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>{draft?.id ? 'Sửa mức thưởng' : 'Thêm mức thưởng'}</DialogTitle>
        <DialogContent>
          {draft && (
            <Box sx={{ pt: 1, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              <TextField
                select
                label="Nhóm"
                value={draft.tier}
                onChange={(e) => setDraft({ ...draft, tier: e.target.value as QuarterBonusTier })}
              >
                <MenuItem value="Staff">{TIER.Staff}</MenuItem>
                <MenuItem value="StoreManager">{TIER.StoreManager}</MenuItem>
              </TextField>
              <TextField
                select
                label="Khi thiếu giờ"
                value={draft.proration}
                onChange={(e) => setDraft({ ...draft, proration: e.target.value as QuarterBonusProration })}
              >
                <MenuItem value="None">Không thưởng</MenuItem>
                <MenuItem value="ByHours">Tính theo giờ đã làm</MenuItem>
              </TextField>
              {num('amount', 'Mức thưởng (đ)')}
              {num('minHours', 'Giờ tối thiểu')}
              {num('monthlyPointsLimit', 'Mất thưởng từ (điểm trừ/tháng)')}
              {num('capRevenuePct', 'Trần (% doanh thu)')}
              {num('minTenureMonths', 'Thâm niên tối thiểu (tháng)')}
              <TextField
                label="Xét từ ngày (trống = đầu quý)"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={draft.windowStart ?? ''}
                onChange={(e) => setDraft({ ...draft, windowStart: e.target.value })}
              />
              <TextField
                label="Hiệu lực từ"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={draft.effectiveFrom}
                onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })}
              />
              <TextField
                label="Hiệu lực đến (trống = không hạn)"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={draft.effectiveTo ?? ''}
                onChange={(e) => setDraft({ ...draft, effectiveTo: e.target.value })}
              />
              <TextField
                sx={{ gridColumn: '1 / -1' }}
                label="Ghi chú"
                value={draft.note ?? ''}
                onChange={(e) => setDraft({ ...draft, note: e.target.value || null })}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDraft(null)}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={saving} onClick={save}>
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// ── Nhân viên ──────────────────────────────────────────────────────────

function StaffTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [staff, setStaff] = useState<IQuarterBonusStaff[]>([]);

  useEffect(() => {
    getQuarterBonusStaff()
      .then(setStaff)
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được nhân viên'), { variant: 'error' }));
  }, [enqueueSnackbar]);

  const save = async (person: IQuarterBonusStaff, change: Partial<IQuarterBonusStaff>) => {
    const next = { ...person, ...change };
    try {
      const saved = await saveQuarterBonusStaff(person.userId, {
        joinedOn: next.joinedOn || null,
        isStoreManager: next.isStoreManager,
      });
      setStaff((list) => list.map((p) => (p.userId === saved.userId ? saved : p)));
      enqueueSnackbar('Đã lưu');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    }
  };

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Alert severity="info">
        Ngày vào làm được điền sẵn từ hợp đồng hoặc lần chấm công đầu, cần rà lại vì quyết định ai đủ thâm niên. Kết quả tính lại sau khi lưu.
      </Alert>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nhân viên</TableCell>
              <TableCell>Ngày vào làm</TableCell>
              <TableCell>Quản lý cửa hàng</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.map((p) => (
              <TableRow key={p.userId}>
                <TableCell>{p.name}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="date"
                    defaultValue={p.joinedOn ?? ''}
                    key={p.joinedOn ?? 'empty'}
                    onBlur={(e) => {
                      if ((e.target.value || null) !== (p.joinedOn ?? null)) save(p, { joinedOn: e.target.value || null });
                    }}
                  />
                </TableCell>
                <TableCell>
                  <FormControlLabel
                    label={p.isStoreManager ? 'Có' : 'Không'}
                    control={<Switch checked={p.isStoreManager} onChange={(e) => save(p, { isStoreManager: e.target.checked })} />}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

export function QuarterBonusView() {
  const settings = useSettingsContext();
  const [tab, setTab] = useState(0);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs heading="Thưởng quý" links={[{ name: 'Lương' }, { name: 'Thưởng quý' }]} sx={{ mb: 2 }} />
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab label="Kết quả" />
          <Tab label="Mức thưởng" />
          <Tab label="Nhân viên" />
        </Tabs>
        {tab === 0 && <ResultsTab />}
        {tab === 1 && <PoliciesTab />}
        {tab === 2 && <StaffTab />}
      </Card>
    </Container>
  );
}
