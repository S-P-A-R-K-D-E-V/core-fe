'use client';

import type { IPaymentChannels, ITransferRouting, IRoutingRule, TransferStrategy } from 'src/types/online-shop';
import type { IBranchLocation, IKiotVietBankAccount, IPosAccountCapability } from 'src/types/corecms-api';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import ToggleButton from '@mui/material/ToggleButton';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { apiErrorMessage } from 'src/utils/api-error';
import {
  whenText,
  configFor,
  DAY_LABELS,
  routingNote,
  planTransfer,
  strategyShort,
  rankCandidates,
  STRATEGY_HELP,
  STRATEGY_LABELS,
} from 'src/utils/transfer-routing';

import { getBranchLocations } from 'src/api/attendance';
import { getPaymentChannels, updateTransferRouting } from 'src/api/online-shop';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { loadPosBankAccounts, AccountCapabilityTag, capabilityLabel } from 'src/components/account-capability';

import RoutingRuleDialog from './routing-rule-dialog';
import {
  setScope,
  upsertRule,
  removeRule,
  setWeight,
  payloadOf,
  moveAccount,
  scopeConfig,
  draftProblem,
  routingDraft,
  accountLabel,
  isOtherHolder,
  toggleAccount,
  BRANCH_PREFIX,
  primaryHolder,
  initialConfig,
  changeStrategy,
  branchesPayload,
  routingCapabilities,
  type RoutingDraft,
} from './transfer-routing-utils';

// ----------------------------------------------------------------------
// Thanh toán → Cài đặt → Tài khoản nhận theo kênh. CiCi chọn tài khoản theo cài đặt ở đây (kênh, chi nhánh, giá trị hoá đơn,
// khung giờ, ưu tiên / luân phiên / tỷ lệ, dự phòng); S Payment chọn kênh báo tiền về (ApiPay, payOS, GPMPay…) của tài khoản
// đó. Trên cùng: ma trận tài khoản × kênh để nhìn tổng quan và tích nhanh; dưới: thẻ cấu hình từng kênh + ô "Thử".
// Tài liệu: docs\cici\plans\payment-account-routing-plan.md.
// ----------------------------------------------------------------------

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

type Scope = { key: string; label: string; online: boolean; branchId?: string };

type Pending = { title: string; content: string; run: () => void } | null;

export default function TransferRoutingCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<IPaymentChannels | null>(null);
  const [accounts, setAccounts] = useState<IKiotVietBankAccount[]>([]);
  const [caps, setCaps] = useState<Record<string, IPosAccountCapability>>({});
  const [branches, setBranches] = useState<IBranchLocation[]>([]);
  const [draft, setDraft] = useState<RoutingDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [channels, pos, branchList] = await Promise.all([
        getPaymentChannels(),
        loadPosBankAccounts(),
        getBranchLocations().catch(() => [] as IBranchLocation[]),
      ]);
      setData(channels);
      setDraft(routingDraft(channels));
      setAccounts(pos.accounts.filter((a) => a.isActive !== false && !!a.accountNumber));
      setCaps(pos.capabilities);
      setBranches(branchList.filter((b) => b.isActive !== false));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được cài đặt tài khoản nhận'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const primary = useMemo(() => primaryHolder(accounts), [accounts]);
  const byId = useCallback((id: string) => accounts.find((a) => a.id === id), [accounts]);

  const scopes: Scope[] = useMemo(() => {
    const list: Scope[] = [{ key: 'pos', label: 'Quầy · mọi chi nhánh', online: false }];
    Object.keys(draft?.branches ?? {}).forEach((id) =>
      list.push({
        key: `${BRANCH_PREFIX}${id}`,
        label: `Quầy · ${branches.find((b) => b.id.toLowerCase() === id.toLowerCase())?.branchName ?? 'chi nhánh'}`,
        online: false,
        branchId: id,
      })
    );
    if (data?.paymentServiceEnabled) list.push({ key: 'online', label: 'Bán online', online: true });
    return list;
  }, [draft?.branches, branches, data?.paymentServiceEnabled]);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }
  if (!data || !draft) {
    return (
      <Alert severity="error" action={<Button onClick={load}>Thử lại</Button>}>
        Không tải được cài đặt tài khoản nhận.
      </Alert>
    );
  }

  const update = (scope: string, cfg: ITransferRouting | null) => setDraft((d) => (d ? setScope(d, scope, cfg) : d));

  /** Thêm tài khoản đứng tên người khác → hỏi trước (tiền về nhầm người). */
  const confirmHolder = (id: string, run: () => void) => {
    const a = byId(id);
    if (!isOtherHolder(a, primary)) {
      run();
      return;
    }
    setPending({
      title: 'Tài khoản đứng tên người khác',
      content: `${accountLabel(a)} đứng tên ${a?.accountHolder} — khác chủ tài khoản chính (${primary}). Tiền khách chuyển sẽ vào tài khoản này. Vẫn thêm?`,
      run,
    });
  };

  const toggleCell = (scope: Scope, id: string) => {
    const cfg = scopeConfig(draft, scope.key);
    const base = cfg && cfg.strategy !== 'cashier' ? cfg : initialConfig('priority', [], caps, scope.online);
    const adding = !base.accounts.some((a) => a.id === id);
    const apply = () => update(scope.key, toggleAccount(base, id));
    if (adding) confirmHolder(id, apply);
    else apply();
  };

  const posProblem = draftProblem(draft.pos, false) ?? Object.values(draft.branches).map((b) => draftProblem(b, false)).find(Boolean) ?? null;
  const onlineProblem = draftProblem(draft.online, true);
  const original = routingDraft(data);
  const posDirty =
    JSON.stringify(payloadOf(draft.pos)) !== JSON.stringify(payloadOf(original.pos)) ||
    JSON.stringify(branchesPayload(draft)) !== JSON.stringify(branchesPayload(original));
  const onlineDirty = JSON.stringify(draft.online) !== JSON.stringify(original.online);

  const save = async () => {
    setSaving(true);
    try {
      let res = data;
      if (posDirty) res = await updateTransferRouting('pos', payloadOf(draft.pos), branchesPayload(draft));
      if (onlineDirty) res = await updateTransferRouting('online', payloadOf(draft.online));
      setData(res);
      setDraft(routingDraft(res));
      enqueueSnackbar('Đã lưu tài khoản nhận theo kênh');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const freeBranches = branches.filter((b) => !draft.branches[b.id] && !draft.branches[b.id.toLowerCase()]);

  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title="Tài khoản nhận theo kênh"
          subheader="CiCi chọn tài khoản nhận chuyển khoản theo cài đặt dưới đây; S Payment chọn kênh báo tiền về (ApiPay, payOS, GPMPay…) của tài khoản đó. Tắt tài khoản, trần ngày / tháng, chặn kênh tính phí đặt ở S Payment vẫn được tôn trọng."
        />
        <Stack spacing={2} sx={{ p: 3, pt: 2 }}>
          {!data.paymentServiceEnabled && (
            <Alert severity="info">
              S Payment chưa bật: quầy vẫn tự chọn tài khoản theo cài đặt nhưng thu ngân tự kiểm tra tiền về; bán online cần S Payment.
            </Alert>
          )}
          {accounts.length === 0 && <Alert severity="warning">Chưa có tài khoản ngân hàng nào đang bật.</Alert>}

          <TableContainer sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 1 }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Tài khoản</TableCell>
                  {scopes.map((s) => (
                    <TableCell key={s.key} align="center" sx={{ whiteSpace: 'nowrap' }}>
                      {s.label}
                    </TableCell>
                  ))}
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>S Payment</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>
                      <AccountName account={a} primary={primary} />
                    </TableCell>
                    {scopes.map((s) => (
                      <TableCell key={s.key} align="center">
                        <MatrixCell
                          cfg={scopeConfig(draft, s.key)}
                          id={a.id}
                          usable={!s.online || caps[a.id]?.confirmation !== 'manual'}
                          onToggle={() => toggleCell(s, a.id)}
                        />
                      </TableCell>
                    ))}
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant="caption" color="text.secondary">
                        {caps[a.id] ? capabilityLabel(caps[a.id]) : '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 240 }}>
              ① ② = thứ tự ưu tiên · bấm ô để thêm / bỏ · &quot;QT&quot; = chỉ dùng trong quy tắc · &quot;—&quot; = bán online cần tài khoản tự xác nhận.
            </Typography>
            {freeBranches.length > 0 && (
              <TextField
                select
                size="small"
                label="+ Cấu hình riêng chi nhánh"
                value=""
                sx={{ minWidth: 240 }}
                onChange={(e) => {
                  const base = draft.pos && draft.pos.strategy !== 'cashier' ? draft.pos : initialConfig('priority', accounts, caps, false);
                  update(`${BRANCH_PREFIX}${e.target.value}`, { ...base, rules: [...(base.rules ?? [])] });
                }}
              >
                {freeBranches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.branchName}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </Stack>
      </Card>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        {scopes.map((s) => (
          <ScopeEditor
            key={s.key}
            scope={s}
            cfg={scopeConfig(draft, s.key)}
            accounts={accounts}
            caps={caps}
            primary={primary}
            onChange={(cfg) => update(s.key, cfg)}
            onConfirmAdd={confirmHolder}
            onRemoveScope={s.branchId ? () => update(s.key, null) : undefined}
          />
        ))}
      </Box>

      <Card sx={{ p: 2, position: 'sticky', bottom: 16, zIndex: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <Typography variant="body2" color={posProblem || onlineProblem ? 'error' : 'text.secondary'} sx={{ flex: 1 }}>
            {posProblem || onlineProblem || (posDirty || onlineDirty ? 'Có thay đổi chưa lưu.' : 'Đã lưu.')}
          </Typography>
          <Button color="inherit" disabled={saving || (!posDirty && !onlineDirty)} onClick={() => setDraft(routingDraft(data))}>
            Hoàn tác
          </Button>
          <LoadingButton
            variant="contained"
            loading={saving}
            disabled={!!posProblem || !!onlineProblem || (!posDirty && !onlineDirty)}
            onClick={save}
          >
            Lưu
          </LoadingButton>
        </Stack>
      </Card>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.title}
        content={pending?.content}
        cancelText="Không"
        action={
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              pending?.run();
              setPending(null);
            }}
          >
            Vẫn thêm
          </Button>
        }
      />
    </Stack>
  );
}

// ----------------------------------------------------------------------

function AccountName({ account, primary }: { account?: IKiotVietBankAccount; primary: string | null }) {
  const other = isOtherHolder(account, primary);
  return (
    <Stack spacing={0}>
      <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        {accountLabel(account)}
      </Typography>
      <Typography variant="caption" color={other ? 'error.main' : 'text.secondary'} sx={{ fontWeight: other ? 600 : 400 }}>
        {account?.accountHolder ?? ''}
        {other ? ' · chủ khác' : ''}
      </Typography>
    </Stack>
  );
}

function MatrixCell({ cfg, id, usable, onToggle }: { cfg: ITransferRouting | null; id: string; usable: boolean; onToggle: () => void }) {
  if (!usable) {
    return (
      <Tooltip title="Bán online cần tài khoản tự xác nhận">
        <Typography variant="body2" color="text.disabled">
          —
        </Typography>
      </Tooltip>
    );
  }
  const active = cfg && cfg.strategy !== 'cashier' ? cfg : null;
  const index = active?.accounts.findIndex((a) => a.id === id) ?? -1;
  const rule = active?.rules?.find((r) => r.accounts.some((a) => a.id === id));
  let label = '+';
  let color: 'default' | 'success' | 'info' = 'default';
  if (index >= 0) {
    label = CIRCLED[index] ?? String(index + 1);
    color = 'success';
  } else if (active?.fallbackId === id) {
    label = 'Dự phòng';
  } else if (rule) {
    label = `QT "${rule.name ?? ''}"`;
    color = 'info';
  }
  return (
    <Chip
      size="small"
      label={label}
      color={color}
      variant={index >= 0 || rule ? 'soft' : 'outlined'}
      onClick={active?.fallbackId === id && index < 0 ? undefined : onToggle}
      sx={{ minWidth: 36, fontWeight: 700 }}
    />
  );
}

// ----------------------------------------------------------------------

type EditorProps = {
  scope: Scope;
  cfg: ITransferRouting | null;
  accounts: IKiotVietBankAccount[];
  caps: Record<string, IPosAccountCapability>;
  primary: string | null;
  onChange: (cfg: ITransferRouting | null) => void;
  onConfirmAdd: (id: string, run: () => void) => void;
  onRemoveScope?: () => void;
};

function ScopeEditor({ scope, cfg, accounts, caps, primary, onChange, onConfirmAdd, onRemoveScope }: EditorProps) {
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editing, setEditing] = useState<IRoutingRule | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const strategy: TransferStrategy = cfg?.strategy ?? (scope.online ? 'priority' : 'cashier');
  const active = cfg && cfg.strategy !== 'cashier' ? cfg : null;
  const byId = (id: string) => accounts.find((a) => a.id === id);
  const usable = (id: string) => !scope.online || caps[id]?.confirmation !== 'manual';
  const others = accounts.filter((a) => usable(a.id) && !active?.accounts.some((x) => x.id === a.id));

  const pickStrategy = (s: TransferStrategy) => {
    if (s === 'cashier') {
      onChange(scope.branchId ? { strategy: 'cashier', accounts: [] } : null);
      return;
    }
    onChange(active ? changeStrategy(active, s) : initialConfig(s, accounts, caps, scope.online));
  };

  return (
    <Card>
      <CardHeader
        title={scope.label}
        action={
          onRemoveScope && (
            <Button size="small" color="inherit" onClick={onRemoveScope} startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}>
              Dùng như quầy chung
            </Button>
          )
        }
      />
      <Stack spacing={2} sx={{ p: 3, pt: 2 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={strategy}
          onChange={(_, v) => v && pickStrategy(v)}
          sx={{ flexWrap: 'wrap' }}
        >
          {(Object.keys(STRATEGY_LABELS) as TransferStrategy[])
            .filter((s) => !scope.online || s !== 'cashier')
            .map((s) => (
              <ToggleButton key={s} value={s} sx={{ px: 1.5 }}>
                {STRATEGY_LABELS[s]}
              </ToggleButton>
            ))}
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary">
          {scope.online && !cfg
            ? 'Chưa chọn: bán online dùng lần lượt mọi tài khoản tự xác nhận được (tài khoản mặc định trước). Chọn một cách để tự đặt danh sách.'
            : STRATEGY_HELP[strategy]}
        </Typography>

        {active && (
          <>
            <Stack spacing={1}>
              {active.accounts.map((a, i) => (
                <Stack
                  key={a.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom !== null) onChange(moveAccount(active, dragFrom, i));
                    setDragFrom(null);
                  }}
                  sx={{ p: 1, border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 1, opacity: dragFrom === i ? 0.5 : 1 }}
                >
                  <Iconify icon="mdi:drag" sx={{ color: 'text.disabled', cursor: 'grab', flexShrink: 0 }} />
                  <Chip size="small" color="success" variant="soft" label={i + 1} sx={{ minWidth: 28 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <AccountName account={byId(a.id)} primary={primary} />
                  </Box>
                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                    <AccountCapabilityTag capability={caps[a.id]} />
                  </Box>
                  {active.strategy === 'weighted' && (
                    <TextField
                      size="small"
                      type="number"
                      value={a.weight ?? 0}
                      onChange={(e) => onChange(setWeight(active, a.id, Number(e.target.value)))}
                      InputProps={{ endAdornment: '%' }}
                      sx={{ width: 90 }}
                    />
                  )}
                  <IconButton size="small" onClick={() => onChange(moveAccount(active, i, i - 1))} disabled={i === 0}>
                    <Iconify icon="eva:arrow-ios-upward-fill" />
                  </IconButton>
                  <IconButton size="small" onClick={() => onChange(moveAccount(active, i, i + 1))} disabled={i === active.accounts.length - 1}>
                    <Iconify icon="eva:arrow-ios-downward-fill" />
                  </IconButton>
                  <IconButton size="small" onClick={() => onChange(toggleAccount(active, a.id))}>
                    <Iconify icon="mingcute:close-line" />
                  </IconButton>
                </Stack>
              ))}
              {others.length > 0 && (
                <TextField
                  select
                  size="small"
                  label="+ Thêm tài khoản"
                  value=""
                  onChange={(e) => onConfirmAdd(e.target.value, () => onChange(toggleAccount(active, e.target.value)))}
                  sx={{ maxWidth: 360 }}
                >
                  {others.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {accountLabel(a)} — {a.accountHolder}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>

            <Divider />
            <Stack spacing={1}>
              <Typography variant="subtitle2">Quy tắc (xét trước danh sách, khớp quy tắc đầu tiên)</Typography>
              {(active.rules ?? []).map((r, i) => (
                <Stack
                  key={r.id}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ p: 1, borderRadius: 1, bgcolor: 'background.neutral' }}
                >
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    <b>
                      {i + 1}. {r.name || 'Quy tắc'}:
                    </b>{' '}
                    {whenText(r.when)} → {strategyShort(r.strategy)} {r.accounts.map((x) => accountLabel(byId(x.id))).join(', ')}
                    {r.thenDefault ? ', rồi danh sách kênh' : ''}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditing(r);
                      setRuleOpen(true);
                    }}
                  >
                    <Iconify icon="solar:pen-bold" />
                  </IconButton>
                  <IconButton size="small" onClick={() => onChange(removeRule(active, r.id))}>
                    <Iconify icon="mingcute:close-line" />
                  </IconButton>
                </Stack>
              ))}
              <Box>
                <Button
                  size="small"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={() => {
                    setEditing(null);
                    setRuleOpen(true);
                  }}
                  disabled={(active.rules ?? []).length >= 10}
                >
                  Thêm quy tắc
                </Button>
              </Box>
            </Stack>

            <Divider />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Dự phòng (khi không tài khoản nào ở trên dùng được)"
                value={active.fallbackId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  if (id) onConfirmAdd(id, () => onChange({ ...active, fallbackId: id }));
                  else onChange({ ...active, fallbackId: null });
                }}
              >
                {scope.online && <MenuItem value="">Không có (tạm không nhận chuyển khoản)</MenuItem>}
                {accounts
                  .filter((a) => usable(a.id))
                  .map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {accountLabel(a)} — {caps[a.id]?.confirmation === 'manual' ? 'xác nhận tay' : 'tự xác nhận'}
                    </MenuItem>
                  ))}
              </TextField>
              {!scope.online && (
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Thu ngân đổi tài khoản ở quầy"
                  value={active.cashierOverride ?? 'pool'}
                  onChange={(e) => onChange({ ...active, cashierOverride: e.target.value as ITransferRouting['cashierOverride'] })}
                >
                  <MenuItem value="pool">Trong danh sách này + dự phòng</MenuItem>
                  <MenuItem value="any">Mọi tài khoản</MenuItem>
                  <MenuItem value="none">Không cho đổi</MenuItem>
                </TextField>
              )}
            </Stack>
            {active.strategy === 'weighted' && (
              <TextField
                select
                size="small"
                label="Tỷ lệ tính theo (trong ngày)"
                value={active.weightBasis ?? 'amount'}
                onChange={(e) => onChange({ ...active, weightBasis: e.target.value as 'amount' | 'count' })}
                sx={{ maxWidth: 320 }}
              >
                <MenuItem value="amount">Số tiền đã nhận</MenuItem>
                <MenuItem value="count">Số giao dịch</MenuItem>
              </TextField>
            )}
            {scope.online && !active.fallbackId && (
              <Alert severity="info">
                Không có dự phòng: khi mọi tài khoản trên hết lượt và S Payment chặn tính phí, trang bán online tạm không nhận chuyển khoản.
              </Alert>
            )}

            <TryBox cfg={active} caps={caps} accounts={accounts} online={scope.online} />
          </>
        )}
      </Stack>

      <RoutingRuleDialog
        open={ruleOpen}
        rule={editing}
        accounts={accounts.filter((a) => usable(a.id))}
        onClose={() => setRuleOpen(false)}
        onSave={(rule) => {
          if (active) onChange(upsertRule(active, rule));
          setRuleOpen(false);
        }}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------

/** Ô "Thử": hoá đơn X lúc Y sẽ vào tài khoản nào (cùng hàm chọn với máy chủ, khả năng tài khoản theo S Payment lúc mở trang). */
function TryBox({
  cfg,
  caps,
  accounts,
  online,
}: {
  cfg: ITransferRouting;
  caps: Record<string, IPosAccountCapability>;
  accounts: IKiotVietBankAccount[];
  online: boolean;
}) {
  const now = new Date();
  const vn = new Date(now.getTime() + 7 * 3600 * 1000);
  const [amount, setAmount] = useState(online ? 350_000 : 150_000);
  const [timeOfDay, setTimeOfDay] = useState(`${String(vn.getUTCHours()).padStart(2, '0')}:${String(vn.getUTCMinutes()).padStart(2, '0')}`);
  const [day, setDay] = useState(vn.getUTCDay());

  // Ngày gần nhất có thứ `day` lúc `timeOfDay` giờ VN (chỉ để hàm chọn đọc giờ / thứ).
  const at = useMemo(() => {
    const [h, m] = timeOfDay.split(':').map(Number);
    const base = new Date(Date.UTC(2026, 10, 15 + day, (h || 0) - 7, m || 0)); // 15/11/2026 là Chủ nhật
    return base;
  }, [timeOfDay, day]);

  const { config } = configFor(cfg, null, null);
  const plan = planTransfer(config, { amount, now: at });
  const ranked = plan ? rankCandidates(plan, routingCapabilities(caps), online) : [];
  const pick = ranked[0];
  const account = accounts.find((a) => a.id === pick);
  const skipped = plan && pick ? plan.candidates.slice(0, plan.candidates.indexOf(pick)) : [];

  return (
    <Box sx={{ p: 2, border: (t) => `1px dashed ${t.palette.primary.main}`, borderRadius: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <Typography variant="subtitle2">Thử</Typography>
        <TextField
          size="small"
          label="Hoá đơn (đ)"
          value={amount.toLocaleString('vi-VN')}
          onChange={(e) => setAmount(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
          sx={{ width: 160 }}
        />
        <TextField size="small" type="time" label="Lúc" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 120 }} />
        <TextField select size="small" label="Thứ" value={day} onChange={(e) => setDay(Number(e.target.value))} sx={{ width: 100 }}>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <MenuItem key={d} value={d}>
              {DAY_LABELS[d]}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 600 }}>
        → {account ? `${accountLabel(account)} · ${account.accountHolder ?? ''}` : 'Không có tài khoản dùng được'}
      </Typography>
      {plan && pick && (
        <Typography variant="caption" color="text.secondary">
          {routingNote(plan, pick, accountLabel(account))}
          {skipped.length > 0 &&
            ` · bỏ qua ${skipped
              .map((id) => {
                const c = caps[id];
                const why = !c ? 'chưa có trên S Payment' : c.confirmation === 'auto_paid' ? 'hết lượt miễn phí' : 'xác nhận tay';
                return `${accountLabel(accounts.find((a) => a.id === id))} (${why})`;
              })
              .join(', ')}`}
        </Typography>
      )}
    </Box>
  );
}
