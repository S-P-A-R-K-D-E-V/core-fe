'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
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
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getActiveStaffUsers } from 'src/api/users';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import {
  getViolations,
  syncViolations,
  cancelViolation,
  getMyViolations,
  createViolations,
  resolveViolation,
  complainViolation,
  saveViolationRule,
  getViolationCatalog,
  getViolationSummary,
  saveViolationPolicy,
  archiveViolationRule,
} from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type {
  IViolationRule,
  IViolationEntry,
  IViolationMonth,
  IViolationPolicy,
  IViolationSummary,
  ViolationComponent,
  ViolationAutoSource,
  ViolationEntryStatus,
} from 'src/types/hr';
import { VIOLATION_STATUS_LABEL, VIOLATION_COMPONENT_LABEL, VIOLATION_AUTO_SOURCE_LABEL } from 'src/types/hr';

import { MonthField, monthStart } from '../hr-common';

// ----------------------------------------------------------------------
// Vi phạm & điểm trừ: danh mục riêng của cửa hàng (Admin sửa), các lần ghi nhận (hệ thống tự ghi phần có dữ liệu chấm công /
// bảng kiểm / biên bản, quản lý ghi tay phần còn lại), điểm trừ tháng từng người, khiếu nại. Chỉ có điểm — không phạt tiền.
// ----------------------------------------------------------------------

type TabKey = 'mine' | 'store' | 'catalog';

const STATUS_COLOR: Record<ViolationEntryStatus, 'default' | 'warning' | 'error'> = {
  Active: 'error',
  Disputed: 'warning',
  Cancelled: 'default',
};

const MINUTE_SOURCES: ViolationAutoSource[] = ['Late', 'EarlyLeave'];

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Thưởng doanh số tuần theo ngưỡng điểm trừ; trống khi cửa hàng không đặt ngưỡng. */
export function bonusLabel(s: Pick<IViolationSummary, 'weeklyBonusPct' | 'notComplete' | 'losesMonthlyBonus'>): string | null {
  if (s.weeklyBonusPct == null) return s.losesMonthlyBonus ? 'Mất thưởng tháng' : null;
  if (s.weeklyBonusPct >= 100) return 'Nhận đủ thưởng tuần';
  if (s.weeklyBonusPct <= 0) return s.notComplete ? 'Không nhận thưởng · Không hoàn thành' : 'Không nhận thưởng tuần';
  return `Nhận ${s.weeklyBonusPct}% thưởng tuần`;
}

function thresholdsText(p: IViolationPolicy | null): string | null {
  if (!p) return null;
  const parts: string[] = [];
  if (p.halfBonusFromPoints != null) parts.push(`từ ${p.halfBonusFromPoints} điểm: nhận ${p.halfBonusPct ?? 0}% thưởng tuần`);
  if (p.noBonusFromPoints != null) parts.push(`từ ${p.noBonusFromPoints} điểm: không nhận thưởng tuần`);
  if (p.notCompleteFromPoints != null) parts.push(`từ ${p.notCompleteFromPoints} điểm: Không hoàn thành`);
  return parts.length ? `Tổng điểm trừ trong tháng — ${parts.join('; ')}.` : null;
}

/** Bật / tắt nhanh việc áp điểm trừ vào thưởng doanh số tuần (Admin); người khác chỉ thấy trạng thái. */
function BonusToggle({
  policy,
  canEdit,
  onChanged,
}: {
  policy: IViolationPolicy;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [busy, setBusy] = useState(false);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      await saveViolationPolicy({
        effectiveFrom: policy.effectiveFrom,
        halfBonusFromPoints: policy.halfBonusFromPoints ?? null,
        halfBonusPct: policy.halfBonusPct ?? null,
        noBonusFromPoints: policy.noBonusFromPoints ?? null,
        notCompleteFromPoints: policy.notCompleteFromPoints ?? null,
        appliesToBonus: on,
      });
      enqueueSnackbar(on ? 'Đã bật: thưởng tuần nhận theo điểm trừ' : 'Đã tắt: điểm trừ chỉ để xem, thưởng tuần chia đủ theo giờ');
      onChanged();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit)
    return (
      <Chip
        size="small"
        color={policy.appliesToBonus ? 'warning' : 'default'}
        label={policy.appliesToBonus ? 'Đang tính điểm trừ vào thưởng tuần' : 'Điểm trừ chưa tính vào thưởng tuần'}
      />
    );
  return (
    <FormControlLabel
      control={<Switch checked={policy.appliesToBonus} disabled={busy} onChange={(e) => toggle(e.target.checked)} />}
      label={
        <Box>
          <Typography variant="body2">Tính điểm trừ vào thưởng doanh số tuần</Typography>
          <Typography variant="caption" color="text.secondary">
            Bật: mỗi người nhận % thưởng tuần theo ngưỡng điểm trừ của tháng, mất cả tuần / tháng theo vi phạm; phần không nhận chia
            lại cho người nhận đủ theo giờ làm. Áp cho tính thử và bảng lương.
          </Typography>
        </Box>
      }
    />
  );
}

/** Mức thưởng theo điểm trừ, kèm ghi chú khi cửa hàng chưa bật tính vào thưởng. */
function bonusWithState(s: IViolationSummary, policy: IViolationPolicy | null): string | null {
  const label = bonusLabel(s);
  if (!label) return null;
  return policy?.appliesToBonus ? label : `${label} (chưa tính vào thưởng)`;
}

export default function HrViolationsView({ initialTab }: { initialTab?: string }) {
  const settings = useSettingsContext();
  const { user } = useAuthContext();

  const canManage = hasPermission(user, PERMISSIONS.hr.violationManage);
  const canSeeStore = canManage || hasPermission(user, PERMISSIONS.hr.performanceRead);
  const canEditCatalog = hasPermission(user, PERMISSIONS.hr.ruleManage);

  const [tab, setTab] = useState<TabKey>(() => {
    if (initialTab === 'mine' || initialTab === 'catalog') return initialTab;
    return canSeeStore ? 'store' : 'mine';
  });
  const [month, setMonth] = useState(monthStart());

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Vi phạm & điểm trừ"
        links={[{ name: 'Nhân sự' }, { name: 'Vi phạm & điểm trừ' }]}
        sx={{ mb: 2 }}
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        Mỗi lần vi phạm chỉ trừ điểm theo danh mục của cửa hàng — không phạt tiền, không trừ lương. Hệ thống tự ghi phần có dữ
        liệu (chấm công, bảng kiểm, đơn nghỉ, biên bản); phần còn lại quản lý ghi kèm căn cứ. Nhân viên xem từng lần và khiếu
        nại được.
      </Alert>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          {canSeeStore && <Tab value="store" label="Điểm cả cửa hàng" />}
          <Tab value="mine" label="Của tôi" />
          <Tab value="catalog" label="Danh mục" />
        </Tabs>
        {tab !== 'catalog' && <MonthField value={month} onChange={setMonth} />}
      </Stack>

      {tab === 'mine' && <MyViolations month={month} />}
      {tab === 'store' && canSeeStore && <StoreViolations month={month} canManage={canManage} canEditPolicy={canEditCatalog} />}
      {tab === 'catalog' && <Catalog canEdit={canEditCatalog} />}
    </Container>
  );
}

// ----------------------------------------------------------------------

function SummaryCard({ summary, policy }: { summary: IViolationSummary; policy: IViolationPolicy | null }) {
  const bonus = bonusWithState(summary, policy);
  const thresholds = thresholdsText(policy);
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Tổng điểm trừ
            </Typography>
            <Typography variant="h3" color={summary.points > 0 ? 'error.main' : 'success.main'}>
              {summary.points}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Kỷ luật / Đối soát
            </Typography>
            <Typography variant="h5">
              {summary.disciplinePoints} / {summary.reconciliationPoints}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Số lần (đang khiếu nại)
            </Typography>
            <Typography variant="h5">
              {summary.count} ({summary.disputed})
            </Typography>
          </Box>
          {bonus && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Thưởng doanh số
              </Typography>
              <Typography variant="h6">{bonus}</Typography>
            </Box>
          )}
        </Stack>
        {summary.weeksWithoutBonus.length > 0 && (
          <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
            Mất thưởng tuần bắt đầu: {summary.weeksWithoutBonus.map((w) => fDate(w, 'dd/MM')).join(', ')}
          </Typography>
        )}
        {thresholds && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {thresholds}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function EntriesTable({
  entries,
  showName,
  actions,
}: {
  entries: IViolationEntry[];
  showName?: boolean;
  actions?: (e: IViolationEntry) => React.ReactNode;
}) {
  if (entries.length === 0)
    return (
      <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
        Không có lần ghi nhận nào.
      </Typography>
    );
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Ngày</TableCell>
            {showName && <TableCell>Nhân viên</TableCell>}
            <TableCell>Hành vi</TableCell>
            <TableCell align="right">Điểm trừ</TableCell>
            <TableCell>Căn cứ</TableCell>
            <TableCell>Trạng thái</TableCell>
            {actions && <TableCell align="right" />}
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id} sx={{ opacity: e.status === 'Cancelled' ? 0.55 : 1 }}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {fDate(e.occurredOn, 'dd/MM')}
                {e.shiftName && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    {e.shiftName}
                  </Typography>
                )}
              </TableCell>
              {showName && <TableCell>{e.fullName}</TableCell>}
              <TableCell>
                <Typography variant="body2">{e.ruleName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {e.groupName} · {VIOLATION_COMPONENT_LABEL[e.component]}
                  {e.quantity > 1 ? ` · ${e.quantity} lần` : ''}
                  {e.losesWeeklyBonus ? ' · mất thưởng tuần' : ''}
                  {e.losesMonthlyBonus ? ' · mất thưởng tháng' : ''}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="subtitle2" color={e.status === 'Cancelled' ? 'text.disabled' : 'error.main'}>
                  −{e.points}
                </Typography>
              </TableCell>
              <TableCell sx={{ maxWidth: 320 }}>
                <Typography variant="body2">{e.note || '—'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {e.isAuto ? 'Hệ thống tự ghi' : 'Quản lý ghi'}
                </Typography>
                {e.complaintText && (
                  <Typography variant="caption" display="block" color="warning.main">
                    Khiếu nại: {e.complaintText}
                  </Typography>
                )}
                {e.resolutionNote && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    Trả lời: {e.resolutionNote}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Chip size="small" variant="soft" color={STATUS_COLOR[e.status]} label={VIOLATION_STATUS_LABEL[e.status]} />
              </TableCell>
              {actions && (
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {actions(e)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function TextDialog({
  title,
  label,
  hint,
  confirmText,
  open,
  busy,
  onClose,
  onConfirm,
  extra,
}: {
  title: string;
  label: string;
  hint?: string;
  confirmText: string;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (text: string) => void;
  extra?: React.ReactNode;
}) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (open) setText('');
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {hint}
          </Typography>
        )}
        {extra}
        <TextField fullWidth multiline minRows={3} label={label} value={text} onChange={(e) => setText(e.target.value)} sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
        <LoadingButton variant="contained" loading={busy} disabled={!text.trim()} onClick={() => onConfirm(text.trim())}>
          {confirmText}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

function MyViolations({ month }: { month: string }) {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyViolations>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [complaining, setComplaining] = useState<IViolationEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getMyViolations(month));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được điểm trừ'), { variant: 'error' });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const complain = async (text: string) => {
    if (!complaining) return;
    setBusy(true);
    try {
      await complainViolation(complaining.id, text);
      enqueueSnackbar('Đã gửi khiếu nại — quản lý sẽ trả lời');
      setComplaining(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không gửi được khiếu nại'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const canComplain = (e: IViolationEntry) =>
    e.status === 'Active' && !e.complainedAt && (!e.complaintDeadline || e.complaintDeadline >= today());

  if (loading)
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  if (!data) return null;

  return (
    <>
      <SummaryCard summary={data.summary} policy={data.policy} />
      <Card>
        <EntriesTable
          entries={data.entries}
          actions={(e) =>
            canComplain(e) ? (
              <Tooltip describeChild title={e.complaintDeadline ? `Hạn khiếu nại: ${fDate(e.complaintDeadline, 'dd/MM')}` : ''}>
                <Button size="small" color="warning" onClick={() => setComplaining(e)}>
                  Khiếu nại
                </Button>
              </Tooltip>
            ) : null
          }
        />
      </Card>
      <TextDialog
        open={!!complaining}
        busy={busy}
        title="Khiếu nại lần ghi nhận"
        label="Lý do khiếu nại"
        hint={complaining ? `${complaining.ruleName} — ngày ${fDate(complaining.occurredOn, 'dd/MM')}, trừ ${complaining.points} điểm.` : ''}
        confirmText="Gửi khiếu nại"
        onClose={() => setComplaining(null)}
        onConfirm={complain}
      />
    </>
  );
}

// ----------------------------------------------------------------------

function StoreViolations({ month, canManage, canEditPolicy }: { month: string; canManage: boolean; canEditPolicy: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const [summary, setSummary] = useState<IViolationMonth | null>(null);
  const [entries, setEntries] = useState<IViolationEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyDisputed, setOnlyDisputed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<IViolationEntry | null>(null);
  const [resolving, setResolving] = useState<{ entry: IViolationEntry; keep: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([getViolationSummary(month), getViolations({ month })]);
      setSummary(s);
      setEntries(list);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được điểm trừ'), { variant: 'error' });
      setSummary(null);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [month, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = entries.filter((e) => (!selected || e.userId === selected) && (!onlyDisputed || e.status === 'Disputed'));
  const disputedCount = entries.filter((e) => e.status === 'Disputed').length;

  const runSync = async () => {
    setBusy(true);
    try {
      const r = await syncViolations();
      enqueueSnackbar(`Tự ghi: ${r.created} mới, ${r.updated} cập nhật, ${r.cancelled} tự huỷ`);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không chạy được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (note: string) => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await cancelViolation(cancelling.id, note);
      enqueueSnackbar('Đã huỷ — nhân viên được báo');
      setCancelling(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không huỷ được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (note: string) => {
    if (!resolving) return;
    setBusy(true);
    try {
      await resolveViolation(resolving.entry.id, resolving.keep, note);
      enqueueSnackbar('Đã trả lời khiếu nại');
      setResolving(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );

  const thresholds = thresholdsText(summary?.policy ?? null);

  return (
    <>
      {summary && !summary.policy && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Cửa hàng chưa có danh mục vi phạm — Admin thêm ở tab Danh mục.
        </Alert>
      )}
      {canManage && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button variant="contained" onClick={() => setCreating(true)} disabled={!summary?.policy}>
            Ghi vi phạm
          </Button>
          <LoadingButton variant="outlined" loading={busy && !cancelling && !resolving} onClick={runSync}>
            Chạy tự ghi ngay
          </LoadingButton>
        </Stack>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: 0 }}>
          <Typography variant="h6">Điểm trừ tháng {fDate(month, 'MM/yyyy')}</Typography>
          {thresholds && (
            <Typography variant="body2" color="text.secondary">
              {thresholds}
            </Typography>
          )}
          {summary?.policy && (
            <Box sx={{ mt: 1 }}>
              <BonusToggle policy={summary.policy} canEdit={canEditPolicy} onChanged={load} />
            </Box>
          )}
        </CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nhân viên</TableCell>
                <TableCell align="right">Tổng điểm trừ</TableCell>
                <TableCell align="right">Kỷ luật</TableCell>
                <TableCell align="right">Đối soát</TableCell>
                <TableCell align="right">Số lần</TableCell>
                <TableCell>Thưởng doanh số</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(summary?.rows ?? []).map((r) => (
                <TableRow
                  key={r.userId}
                  hover
                  selected={selected === r.userId}
                  onClick={() => setSelected(selected === r.userId ? null : r.userId)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{r.fullName}</TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" color={r.points > 0 ? 'error.main' : 'text.secondary'}>
                      {r.points}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{r.disciplinePoints}</TableCell>
                  <TableCell align="right">{r.reconciliationPoints}</TableCell>
                  <TableCell align="right">
                    {r.count}
                    {r.disputed > 0 && <Chip size="small" color="warning" label={`${r.disputed} khiếu nại`} sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{bonusWithState(r, summary?.policy ?? null) ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Card>
        <CardContent sx={{ pb: 0 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h6">
              Các lần ghi nhận
              {selected && ` — ${summary?.rows.find((r) => r.userId === selected)?.fullName ?? ''}`}
            </Typography>
            {selected && (
              <Button size="small" onClick={() => setSelected(null)}>
                Xem tất cả
              </Button>
            )}
            <FormControlLabel
              control={<Switch checked={onlyDisputed} onChange={(e) => setOnlyDisputed(e.target.checked)} />}
              label={`Chỉ khiếu nại đang chờ (${disputedCount})`}
            />
          </Stack>
        </CardContent>
        <EntriesTable
          entries={shown}
          showName
          actions={
            canManage
              ? (e) => {
                  if (e.status === 'Disputed')
                    return (
                      <>
                        <Button size="small" color="success" onClick={() => setResolving({ entry: e, keep: false })}>
                          Chấp nhận
                        </Button>
                        <Button size="small" onClick={() => setResolving({ entry: e, keep: true })}>
                          Giữ điểm trừ
                        </Button>
                      </>
                    );
                  if (e.status === 'Active')
                    return (
                      <Button size="small" color="inherit" onClick={() => setCancelling(e)}>
                        Huỷ
                      </Button>
                    );
                  return null;
                }
              : undefined
          }
        />
      </Card>

      {creating && (
        <CreateViolationDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      <TextDialog
        open={!!cancelling}
        busy={busy}
        title="Huỷ lần ghi nhận"
        label="Lý do huỷ (nhân viên sẽ thấy)"
        hint={cancelling ? `${cancelling.fullName} — ${cancelling.ruleName}, ngày ${fDate(cancelling.occurredOn, 'dd/MM')}.` : ''}
        confirmText="Huỷ điểm trừ"
        onClose={() => setCancelling(null)}
        onConfirm={cancel}
      />
      <TextDialog
        open={!!resolving}
        busy={busy}
        title={resolving?.keep ? 'Giữ điểm trừ' : 'Chấp nhận khiếu nại (huỷ điểm trừ)'}
        label="Trả lời nhân viên"
        hint={resolving ? `${resolving.entry.fullName}: ${resolving.entry.complaintText ?? ''}` : ''}
        confirmText={resolving?.keep ? 'Giữ điểm trừ' : 'Huỷ điểm trừ'}
        onClose={() => setResolving(null)}
        onConfirm={resolve}
      />
    </>
  );
}

function CreateViolationDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [rules, setRules] = useState<IViolationRule[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [rule, setRule] = useState<IViolationRule | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getViolationCatalog()
      .then((c) => setRules(c.rules.filter((r) => r.isActive)))
      .catch(() => setRules([]));
    getActiveStaffUsers()
      .then((users) => setStaff(users.map((u) => ({ id: u.id, name: u.fullName }))))
      .catch(() => setStaff([]));
  }, []);

  const qty = Number(quantity);
  const valid = !!rule && people.length > 0 && !!date && Number.isInteger(qty) && qty >= 1 && qty <= 50 && !!note.trim();

  const submit = async () => {
    if (!rule) return;
    setBusy(true);
    try {
      await createViolations({ ruleId: rule.id, userIds: people.map((p) => p.id), occurredOn: date, quantity: qty, note: note.trim() });
      enqueueSnackbar('Đã ghi nhận — nhân viên được báo');
      onCreated();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không ghi được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Ghi vi phạm</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete
            options={rules}
            groupBy={(r) => r.groupName}
            getOptionLabel={(r) => `${r.name} (−${r.points})`}
            value={rule}
            onChange={(_, v) => setRule(v)}
            renderInput={(params) => <TextField {...params} label="Hành vi" />}
          />
          {rule?.autoSource && rule.autoSource !== 'None' && (
            <Alert severity="info">Hành vi này hệ thống đã tự ghi theo dữ liệu — chỉ ghi tay khi hệ thống không có dữ liệu.</Alert>
          )}
          {rule?.extraAction && (
            <Typography variant="body2" color="text.secondary">
              Xử lý thêm (ghi chú): {rule.extraAction}
            </Typography>
          )}
          <Autocomplete
            multiple
            options={staff}
            getOptionLabel={(p) => p.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={people}
            onChange={(_, v) => setPeople(v)}
            renderInput={(params) => <TextField {...params} label="Nhân viên" helperText="Chọn nhiều người nếu cả ca cùng vi phạm" />}
          />
          <Stack direction="row" spacing={2}>
            <TextField type="date" label="Ngày" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField
              type="number"
              label="Số lần"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputProps={{ min: 1, max: 50 }}
              sx={{ width: 120 }}
            />
          </Stack>
          <TextField
            multiline
            minRows={2}
            label="Căn cứ"
            placeholder="VD: camera quầy 19:10–19:25; báo cáo ca; tin nhắn khách…"
            helperText="Không có căn cứ thì không ghi. Nhân viên sẽ thấy nội dung này."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {rule && valid && (
            <Typography variant="body2">
              Trừ {rule.points * qty} điểm cho mỗi người ({people.length} người).
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
        <LoadingButton variant="contained" loading={busy} disabled={!valid} onClick={submit}>
          Ghi nhận
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

type RuleDraft = {
  id: string | null;
  groupName: string;
  name: string;
  points: string;
  component: ViolationComponent;
  autoSource: ViolationAutoSource;
  thresholdMinutes: string;
  losesWeeklyBonus: boolean;
  losesMonthlyBonus: boolean;
  extraAction: string;
  sortOrder: string;
  isActive: boolean;
};

function toDraft(r: IViolationRule | null, nextOrder: number): RuleDraft {
  return {
    id: r?.id ?? null,
    groupName: r?.groupName ?? '',
    name: r?.name ?? '',
    points: String(r?.points ?? 1),
    component: r?.component ?? 'Discipline',
    autoSource: r?.autoSource ?? 'None',
    thresholdMinutes: r?.thresholdMinutes != null ? String(r.thresholdMinutes) : '0',
    losesWeeklyBonus: r?.losesWeeklyBonus ?? false,
    losesMonthlyBonus: r?.losesMonthlyBonus ?? false,
    extraAction: r?.extraAction ?? '',
    sortOrder: String(r?.sortOrder ?? nextOrder),
    isActive: r?.isActive ?? true,
  };
}

const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

function Catalog({ canEdit }: { canEdit: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const [rules, setRules] = useState<IViolationRule[]>([]);
  const [policy, setPolicy] = useState<IViolationPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [archiving, setArchiving] = useState<IViolationRule | null>(null);
  const [policyDraft, setPolicyDraft] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getViolationCatalog();
      setRules(c.rules);
      setPolicy(c.policy);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được danh mục'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => [...new Set(rules.map((r) => r.groupName))], [rules]);
  const nextOrder = (rules.reduce((m, r) => Math.max(m, r.sortOrder), 0) || 0) + 10;

  const saveRule = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await saveViolationRule(draft.id, {
        groupName: draft.groupName.trim(),
        name: draft.name.trim(),
        points: Number(draft.points),
        component: draft.component,
        autoSource: draft.autoSource,
        thresholdMinutes: MINUTE_SOURCES.includes(draft.autoSource) ? Number(draft.thresholdMinutes || 0) : null,
        losesWeeklyBonus: draft.losesWeeklyBonus,
        losesMonthlyBonus: draft.losesMonthlyBonus,
        extraAction: draft.extraAction.trim() || null,
        sortOrder: Number(draft.sortOrder || 0),
        isActive: draft.isActive,
      });
      enqueueSnackbar('Đã lưu');
      setDraft(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!archiving) return;
    setBusy(true);
    try {
      await archiveViolationRule(archiving.id);
      enqueueSnackbar('Đã xoá khỏi danh mục (các lần ghi nhận cũ vẫn giữ)');
      setArchiving(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không xoá được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const savePolicy = async () => {
    if (!policyDraft) return;
    setBusy(true);
    try {
      await saveViolationPolicy({
        effectiveFrom: policyDraft.effectiveFrom,
        halfBonusFromPoints: numOrNull(policyDraft.halfBonusFromPoints),
        halfBonusPct: numOrNull(policyDraft.halfBonusPct),
        noBonusFromPoints: numOrNull(policyDraft.noBonusFromPoints),
        notCompleteFromPoints: numOrNull(policyDraft.notCompleteFromPoints),
        appliesToBonus: policy?.appliesToBonus ?? false,
      });
      enqueueSnackbar('Đã lưu');
      setPolicyDraft(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );

  const draftValid =
    !!draft &&
    !!draft.groupName.trim() &&
    !!draft.name.trim() &&
    Number.isInteger(Number(draft.points)) &&
    Number(draft.points) >= 0 &&
    Number(draft.points) <= 100;

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Box>
              <Typography variant="h6">Cách tính</Typography>
              {policy ? (
                <>
                  <Typography variant="body2">
                    Áp dụng từ {fDate(policy.effectiveFrom, 'dd/MM/yyyy')}: hệ thống tự ghi và tính điểm kỷ luật / đối soát theo
                    danh mục.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {thresholdsText(policy) ?? 'Không đặt ngưỡng tổng điểm trừ.'}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <BonusToggle policy={policy} canEdit={canEdit} onChanged={load} />
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Chưa có danh mục. Thêm hành vi đầu tiên để bắt đầu (áp dụng từ ngày 1 tháng sau, sửa được).
                </Typography>
              )}
            </Box>
            {canEdit && policy && (
              <Button
                variant="outlined"
                onClick={() =>
                  setPolicyDraft({
                    effectiveFrom: policy.effectiveFrom,
                    halfBonusFromPoints: policy.halfBonusFromPoints?.toString() ?? '',
                    halfBonusPct: policy.halfBonusPct?.toString() ?? '',
                    noBonusFromPoints: policy.noBonusFromPoints?.toString() ?? '',
                    notCompleteFromPoints: policy.notCompleteFromPoints?.toString() ?? '',
                  })
                }
              >
                Sửa cách tính
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ pb: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Hành vi và điểm trừ ({rules.length})</Typography>
            {canEdit && (
              <Button variant="contained" onClick={() => setDraft(toDraft(null, nextOrder))}>
                Thêm hành vi
              </Button>
            )}
          </Stack>
        </CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nhóm</TableCell>
                <TableCell>Hành vi</TableCell>
                <TableCell align="right">Điểm trừ / lần</TableCell>
                <TableCell>Ghi nhận</TableCell>
                <TableCell>Xử lý thêm</TableCell>
                {canEdit && <TableCell align="right" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id} sx={{ opacity: r.isActive ? 1 : 0.5 }}>
                  <TableCell>{r.groupName}</TableCell>
                  <TableCell>
                    {r.name}
                    {!r.isActive && <Chip size="small" label="Đang tắt" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell align="right">{r.points}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {VIOLATION_AUTO_SOURCE_LABEL[r.autoSource].replace('…', String(r.thresholdMinutes ?? 0))}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {VIOLATION_COMPONENT_LABEL[r.component]}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {[
                      r.losesWeeklyBonus ? 'Mất thưởng tuần' : null,
                      r.losesMonthlyBonus ? 'Mất thưởng tháng' : null,
                      r.extraAction,
                    ]
                      .filter(Boolean)
                      .join('; ') || '—'}
                  </TableCell>
                  {canEdit && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Button size="small" onClick={() => setDraft(toDraft(r, nextOrder))}>
                        Sửa
                      </Button>
                      <Button size="small" color="error" onClick={() => setArchiving(r)}>
                        Xoá
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={!!draft} onClose={() => setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>{draft?.id ? 'Sửa hành vi' : 'Thêm hành vi'}</DialogTitle>
        {draft && (
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Autocomplete
                freeSolo
                options={groups}
                value={draft.groupName}
                onInputChange={(_, v) => setDraft({ ...draft, groupName: v })}
                renderInput={(params) => <TextField {...params} label="Nhóm" />}
              />
              <TextField
                label="Hành vi"
                multiline
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  type="number"
                  label="Điểm trừ mỗi lần"
                  value={draft.points}
                  onChange={(e) => setDraft({ ...draft, points: e.target.value })}
                  inputProps={{ min: 0, max: 100 }}
                />
                <TextField
                  select
                  label="Tính vào"
                  value={draft.component}
                  onChange={(e) => setDraft({ ...draft, component: e.target.value as ViolationComponent })}
                  sx={{ minWidth: 160 }}
                >
                  {(Object.keys(VIOLATION_COMPONENT_LABEL) as ViolationComponent[]).map((c) => (
                    <MenuItem key={c} value={c}>
                      {VIOLATION_COMPONENT_LABEL[c]}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <TextField
                select
                label="Cách ghi nhận"
                value={draft.autoSource}
                onChange={(e) => setDraft({ ...draft, autoSource: e.target.value as ViolationAutoSource })}
              >
                {(Object.keys(VIOLATION_AUTO_SOURCE_LABEL) as ViolationAutoSource[]).map((s) => (
                  <MenuItem key={s} value={s}>
                    {VIOLATION_AUTO_SOURCE_LABEL[s]}
                  </MenuItem>
                ))}
              </TextField>
              {MINUTE_SOURCES.includes(draft.autoSource) && (
                <TextField
                  type="number"
                  label="Trên bao nhiêu phút"
                  helperText="Nhiều bậc cùng loại: lấy bậc cao nhất đã vượt (VD bậc 5, 15, 30 phút)."
                  value={draft.thresholdMinutes}
                  onChange={(e) => setDraft({ ...draft, thresholdMinutes: e.target.value })}
                  inputProps={{ min: 0, max: 600 }}
                />
              )}
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <FormControlLabel
                  control={
                    <Switch checked={draft.losesWeeklyBonus} onChange={(e) => setDraft({ ...draft, losesWeeklyBonus: e.target.checked })} />
                  }
                  label="Mất thưởng doanh số tuần đó"
                />
                <FormControlLabel
                  control={
                    <Switch checked={draft.losesMonthlyBonus} onChange={(e) => setDraft({ ...draft, losesMonthlyBonus: e.target.checked })} />
                  }
                  label="Mất thưởng doanh số cả tháng"
                />
              </Stack>
              <TextField
                label="Xử lý thêm (ghi chú, hệ thống không tự làm)"
                value={draft.extraAction}
                onChange={(e) => setDraft({ ...draft, extraAction: e.target.value })}
              />
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  type="number"
                  label="Thứ tự"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                  sx={{ width: 120 }}
                />
                <FormControlLabel
                  control={<Switch checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />}
                  label="Đang dùng"
                />
              </Stack>
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setDraft(null)}>Đóng</Button>
          <LoadingButton variant="contained" loading={busy} disabled={!draftValid} onClick={saveRule}>
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <Dialog open={!!archiving} onClose={() => setArchiving(null)}>
        <DialogTitle>Xoá hành vi khỏi danh mục?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {archiving?.name} — không ghi nhận mới được nữa; các lần đã ghi trước đây vẫn giữ và vẫn tính điểm.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiving(null)}>Đóng</Button>
          <LoadingButton color="error" variant="contained" loading={busy} onClick={archive}>
            Xoá
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <Dialog open={!!policyDraft} onClose={() => setPolicyDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>Cách tính điểm trừ</DialogTitle>
        {policyDraft && (
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                type="date"
                label="Áp dụng từ ngày"
                helperText="Từ ngày này hệ thống tự ghi vi phạm và tính điểm kỷ luật / đối soát theo danh mục."
                value={policyDraft.effectiveFrom}
                onChange={(e) => setPolicyDraft({ ...policyDraft, effectiveFrom: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <Typography variant="subtitle2">Ngưỡng tổng điểm trừ trong tháng (để trống = không dùng)</Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  type="number"
                  label="Từ … điểm: giảm thưởng tuần"
                  value={policyDraft.halfBonusFromPoints}
                  onChange={(e) => setPolicyDraft({ ...policyDraft, halfBonusFromPoints: e.target.value })}
                />
                <TextField
                  type="number"
                  label="Còn nhận (%)"
                  value={policyDraft.halfBonusPct}
                  onChange={(e) => setPolicyDraft({ ...policyDraft, halfBonusPct: e.target.value })}
                  sx={{ width: 140 }}
                />
              </Stack>
              <TextField
                type="number"
                label="Từ … điểm: không nhận thưởng tuần"
                value={policyDraft.noBonusFromPoints}
                onChange={(e) => setPolicyDraft({ ...policyDraft, noBonusFromPoints: e.target.value })}
              />
              <TextField
                type="number"
                label="Từ … điểm: xếp loại Không hoàn thành"
                value={policyDraft.notCompleteFromPoints}
                onChange={(e) => setPolicyDraft({ ...policyDraft, notCompleteFromPoints: e.target.value })}
              />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setPolicyDraft(null)}>Đóng</Button>
          <LoadingButton variant="contained" loading={busy} disabled={!policyDraft?.effectiveFrom} onClick={savePolicy}>
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
