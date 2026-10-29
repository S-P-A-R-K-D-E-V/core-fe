'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { getActiveStaffUsers } from 'src/api/users';
import { getAllPayrollCycles } from 'src/api/payrollCycle';
import {
  AiBonusError,
  getAiBonusRuns,
  applyAiBonusRun,
  streamAiBonusRun,
  discardAiBonusRun,
} from 'src/api/ai-bonus';
import type { IAiBonusRun, AiBonusPeriodKind, AiBonusRunStatus } from 'src/api/ai-bonus';

import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Agent AI tính thưởng: Admin mô tả cách tính, chọn kỳ và người được xét → Agent đọc số liệu (ca, chấm công, doanh thu,
// target, điểm trừ) và trả từng khoản kèm công thức số, hệ thống tự tính lại. Kết quả là bản nháp: sửa số, bỏ người, rồi
// Áp dụng vào một kỳ lương (thành thưởng nhập tay). AI chỉ thấy mã nhân viên, không thấy tên.
// ----------------------------------------------------------------------

const PERIOD_LABEL: Record<AiBonusPeriodKind, string> = { Day: 'Ngày', Week: 'Tuần', Month: 'Tháng', Custom: 'Tuỳ chọn' };
const STATUS: Record<AiBonusRunStatus, { label: string; color: 'default' | 'success' | 'warning' | 'error' }> = {
  Draft: { label: 'Bản nháp', color: 'warning' },
  Applied: { label: 'Đã áp dụng', color: 'success' },
  Discarded: { label: 'Đã bỏ', color: 'default' },
  Failed: { label: 'Lỗi', color: 'error' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

/** Khoảng ngày theo loại kỳ: tuần = thứ Hai → Chủ nhật chứa ngày chọn; tháng = cả tháng. */
export function periodRange(kind: AiBonusPeriodKind, anchor: string, customTo: string): { from: string; to: string } {
  const d = new Date(`${anchor}T00:00:00`);
  if (kind === 'Day') return { from: anchor, to: anchor };
  if (kind === 'Week') {
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: iso(monday), to: iso(sunday) };
  }
  if (kind === 'Month') {
    return { from: iso(new Date(d.getFullYear(), d.getMonth(), 1)), to: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }
  return { from: anchor, to: customTo };
}

const EXAMPLE =
  'Ví dụ: Mỗi ca Tối có doanh thu vượt target của ca thì mỗi người làm ca đó được thưởng 2% phần vượt, chia theo giờ làm ' +
  'thực tế. Người có từ 6 điểm trừ trong tháng chỉ nhận một nửa. Trưởng ca được thêm 20.000đ mỗi ca vượt target.';

export default function AiBonusTab() {
  const { enqueueSnackbar } = useSnackbar();
  const today = iso(new Date());
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [kind, setKind] = useState<AiBonusPeriodKind>('Week');
  const [anchor, setAnchor] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [cycles, setCycles] = useState<{ id: string; name: string }[]>([]);

  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [run, setRun] = useState<IAiBonusRun | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [cycleId, setCycleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<IAiBonusRun[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await getAiBonusRuns());
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    getActiveStaffUsers()
      .then((users) => setStaff(users.map((u) => ({ id: u.id, name: u.fullName }))))
      .catch(() => setStaff([]));
    getAllPayrollCycles()
      .then((list) => setCycles(list.filter((c) => !c.isLocked).map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCycles([]));
  }, [loadHistory]);

  const open = (r: IAiBonusRun) => {
    setRun(r);
    setAmounts(Object.fromEntries(r.lines.map((l) => [l.userId, String(Math.round(l.amount))])));
    setIncluded(Object.fromEntries(r.lines.map((l) => [l.userId, true])));
  };

  const range = periodRange(kind, anchor, customTo);
  const valid = !!prompt.trim() && range.from <= range.to;

  const start = async () => {
    setRunning(true);
    setSteps([]);
    setRun(null);
    setDropped([]);
    try {
      const result = await streamAiBonusRun(
        {
          title: title.trim() || 'Thưởng theo mô tả',
          prompt: prompt.trim(),
          periodKind: kind,
          from: range.from,
          to: range.to,
          staffIds: people.length ? people.map((p) => p.id) : null,
        },
        (text) => setSteps((s) => (s[s.length - 1] === text ? s : [...s, text]))
      );
      open(result.run);
      setDropped(result.dropped);
      loadHistory();
    } catch (err) {
      enqueueSnackbar(err instanceof AiBonusError ? err.message : 'Agent chưa tính được — thử lại.', { variant: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const chosen = (run?.lines ?? [])
    .filter((l) => included[l.userId])
    .map((l) => ({ userId: l.userId, amount: Number((amounts[l.userId] ?? '').replace(/\D/g, '')) }))
    .filter((l) => l.amount > 0);
  const total = chosen.reduce((s, l) => s + l.amount, 0);

  const apply = async () => {
    if (!run) return;
    setBusy(true);
    try {
      const applied = await applyAiBonusRun(run.id, cycleId, chosen);
      enqueueSnackbar(`Đã áp dụng ${chosen.length} khoản (${vnd(total)}) — tính lại kỳ lương để cộng vào bảng lương`);
      open(applied);
      loadHistory();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không áp dụng được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!run) return;
    setBusy(true);
    try {
      open(await discardAiBonusRun(run.id));
      loadHistory();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không bỏ được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const editable = run?.status === 'Draft';

  return (
    <Stack spacing={3} sx={{ p: 2 }}>
      <Alert severity="info">
        Mô tả cách tính thưởng bằng lời; Agent AI tự lấy số liệu (ca làm, chấm công, doanh thu ngày / ca, target, điểm trừ) và
        tính từng người, mỗi khoản kèm công thức để bạn kiểm. Kết quả chỉ là bản nháp — sửa số rồi bấm Áp dụng mới vào lương.
        AI chỉ thấy mã nhân viên, nên mô tả theo ca / vai trò (trưởng ca, ca Tối…), không theo tên.
      </Alert>

      <Stack spacing={2}>
        <TextField label="Tên đợt thưởng" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Thưởng ca Tối tuần 2/11" />
        <TextField
          label="Cách tính thưởng"
          multiline
          minRows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={EXAMPLE}
          inputProps={{ maxLength: 4000 }}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField select label="Kỳ" value={kind} onChange={(e) => setKind(e.target.value as AiBonusPeriodKind)} sx={{ minWidth: 140 }}>
            {(Object.keys(PERIOD_LABEL) as AiBonusPeriodKind[]).map((k) => (
              <MenuItem key={k} value={k}>
                {PERIOD_LABEL[k]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label={kind === 'Custom' ? 'Từ ngày' : kind === 'Day' ? 'Ngày' : 'Chọn một ngày trong kỳ'}
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          {kind === 'Custom' && (
            <TextField type="date" label="Đến ngày" value={customTo} onChange={(e) => setCustomTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          )}
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
            {fDate(range.from, 'dd/MM/yyyy')} – {fDate(range.to, 'dd/MM/yyyy')}
          </Typography>
        </Stack>
        <Autocomplete
          multiple
          options={staff}
          getOptionLabel={(p) => p.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          value={people}
          onChange={(_, v) => setPeople(v)}
          renderInput={(params) => <TextField {...params} label="Áp cho" helperText="Để trống = mọi người có ca trong kỳ" />}
        />
        <Box>
          <LoadingButton variant="contained" loading={running} disabled={!valid} onClick={start}>
            Chạy Agent tính thưởng
          </LoadingButton>
        </Box>
        {running && (
          <Box>
            <LinearProgress sx={{ mb: 1 }} />
            {steps.map((s, i) => (
              <Typography key={i} variant="caption" display="block" color="text.secondary">
                {s}
              </Typography>
            ))}
          </Box>
        )}
      </Stack>

      {run && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">{run.title}</Typography>
            <Chip size="small" color={STATUS[run.status].color} label={STATUS[run.status].label} />
            <Typography variant="body2" color="text.secondary">
              {fDate(run.from, 'dd/MM')} – {fDate(run.to, 'dd/MM/yyyy')}
            </Typography>
          </Stack>
          {run.summary && <Alert severity="success">{run.summary}</Alert>}
          {dropped.length > 0 && (
            <Alert severity="warning">
              Hệ thống bỏ {dropped.length} khoản AI đề xuất: {dropped.join(' ')}
            </Alert>
          )}
          {run.lines.length === 0 ? (
            <Typography color="text.secondary">Không ai được thưởng theo cách tính này.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {editable && <TableCell padding="checkbox" />}
                    <TableCell>Nhân viên</TableCell>
                    <TableCell>Công thức (hệ thống tự tính lại)</TableCell>
                    <TableCell>Giải thích</TableCell>
                    <TableCell align="right">Thưởng</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {run.lines.map((l) => (
                    <TableRow key={l.userId} sx={{ opacity: editable && !included[l.userId] ? 0.5 : 1 }}>
                      {editable && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={!!included[l.userId]}
                            onChange={(e) => setIncluded((s) => ({ ...s, [l.userId]: e.target.checked }))}
                          />
                        </TableCell>
                      )}
                      <TableCell>{l.fullName}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 280, wordBreak: 'break-all' }}>{l.formula}</TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>{l.explanation}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 140 }}>
                        {editable ? (
                          <TextField
                            size="small"
                            value={amounts[l.userId] ?? ''}
                            onChange={(e) => setAmounts((s) => ({ ...s, [l.userId]: e.target.value }))}
                            inputProps={{ inputMode: 'numeric', style: { textAlign: 'right' } }}
                            helperText={Number((amounts[l.userId] ?? '').replace(/\D/g, '')) !== Math.round(l.amount) ? `AI: ${vnd(l.amount)}` : ' '}
                          />
                        ) : (
                          vnd(l.amount)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {editable && run.lines.length > 0 && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <TextField select label="Áp vào kỳ lương" value={cycleId} onChange={(e) => setCycleId(e.target.value)} sx={{ minWidth: 260 }}>
                {cycles.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              <LoadingButton variant="contained" loading={busy} disabled={!cycleId || chosen.length === 0} onClick={apply}>
                Áp dụng {chosen.length} khoản ({vnd(total)})
              </LoadingButton>
              <Button color="inherit" disabled={busy} onClick={discard}>
                Bỏ bản nháp
              </Button>
            </Stack>
          )}
          {run.status === 'Applied' && (
            <Typography variant="body2" color="text.secondary">
              Đã áp dụng {vnd(run.appliedTotal ?? 0)} lúc {fDate(run.appliedAt ?? run.createdAt, 'dd/MM/yyyy HH:mm')} — xem / huỷ từng
              khoản ở phiếu lương (thưởng nhập tay).
            </Typography>
          )}
        </Stack>
      )}

      {history.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Các lần tính gần đây
          </Typography>
          <Table size="small">
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id} hover sx={{ cursor: 'pointer' }} onClick={() => open(h)}>
                  <TableCell>{fDate(h.createdAt, 'dd/MM HH:mm')}</TableCell>
                  <TableCell>{h.title}</TableCell>
                  <TableCell>
                    {fDate(h.from, 'dd/MM')} – {fDate(h.to, 'dd/MM')}
                  </TableCell>
                  <TableCell align="right">{vnd(h.appliedTotal ?? h.total)}</TableCell>
                  <TableCell>
                    <Chip size="small" color={STATUS[h.status].color} label={STATUS[h.status].label} />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTitle(h.title);
                        setPrompt(h.prompt);
                        setKind(h.periodKind);
                      }}
                    >
                      Dùng lại mô tả
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Stack>
  );
}
