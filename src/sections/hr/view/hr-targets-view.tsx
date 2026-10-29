'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Collapse from '@mui/material/Collapse';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import { useActiveHrRules } from 'src/api/hr-rules';
import {
  getWeeklyBonus,
  getSalesTargets,
  updateSalesTarget,
  generateSalesTargets,
  publishSalesTargets,
  unpublishSalesTargets,
} from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { ISalesTarget, IWeeklyBonus } from 'src/types/hr';
import { WEEKDAY_LABEL } from 'src/types/hr';

import { fPct, fVnd, monthEnd, MonthField, monthStart } from '../hr-common';

// ----------------------------------------------------------------------
// Target doanh thu tuần + khung giờ: tự tính (khi cửa hàng bật ở Cấu hình luật), sửa tay, công bố / thu hồi; chia xuống từng
// ca theo tỷ trọng 8 tuần gần nhất. Nhân viên chỉ thấy tuần đã công bố, không thấy doanh thu thực tế.
// ----------------------------------------------------------------------

function nextMonth(): string {
  const d = new Date();
  return monthStart(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

function weekEnd(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + 6);
  return d.toISOString();
}

export default function HrTargetsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const canManage = hasPermission(user, PERMISSIONS.hr.targetManage);
  const rules = useActiveHrRules();
  const autoTargets = rules?.targetGrowthPct != null;
  const weeklyBonusOn = rules?.weeklyBonusEnabled ?? false;

  const [month, setMonth] = useState(canManage ? nextMonth() : monthStart());
  const [tab, setTab] = useState<'targets' | 'bonus'>('targets');
  const [targets, setTargets] = useState<ISalesTarget[]>([]);
  const [bonus, setBonus] = useState<IWeeklyBonus[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ target: ISalesTarget; amount: string; note: string } | null>(null);

  const from = month;
  const to = monthEnd(month);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'targets') setTargets(await getSalesTargets(from, to));
      else setBonus(await getWeeklyBonus(from, to));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được target'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, enqueueSnackbar]);

  useEffect(() => {
    setNotes([]);
    load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    try {
      const result = await generateSalesTargets(from, to);
      setTargets(result);
      setNotes(Array.from(new Set(result.flatMap((t) => t.notes))));
      enqueueSnackbar('Đã tính target');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tính được target'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      const count = await publishSalesTargets(from, to);
      enqueueSnackbar(count > 0 ? `Đã công bố ${count} tuần — nhân viên được báo` : 'Không còn tuần nào chưa công bố');
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không công bố được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async (weekStart: string) => {
    setBusy(true);
    try {
      await unpublishSalesTargets(weekStart, weekStart);
      enqueueSnackbar('Đã thu hồi — nhân viên không thấy target tuần này nữa');
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không thu hồi được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (revert: boolean) => {
    if (!edit) return;
    setBusy(true);
    try {
      const amount = revert ? null : Number(edit.amount.replace(/\D/g, ''));
      await updateSalesTarget(edit.target.weekStart, amount, edit.note.trim());
      setEdit(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const unpublished = targets.filter((t) => !t.publishedAt).length;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Target tuần"
        links={[{ name: 'Nhân sự' }, { name: 'Target tuần' }]}
        action={
          canManage &&
          tab === 'targets' && (
            <Stack direction="row" spacing={1}>
              {autoTargets && (
                <LoadingButton variant="outlined" loading={busy} onClick={generate}>
                  Tính target
                </LoadingButton>
              )}
              <LoadingButton variant="contained" loading={busy} disabled={unpublished === 0} onClick={publish}>
                Công bố {unpublished > 0 ? `(${unpublished} tuần)` : ''}
              </LoadingButton>
            </Stack>
          )
        }
        sx={{ mb: 2 }}
      />
      {!canManage && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Target từng ca để bạn xem trước khi đăng ký ca.
        </Typography>
      )}

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <MonthField value={month} onChange={setMonth} />
        {canManage && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab value="targets" label="Target" />
            {weeklyBonusOn && <Tab value="bonus" label="Thưởng tuần" />}
          </Tabs>
        )}
      </Stack>

      {notes.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotes([])}>
          {notes.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </Alert>
      )}

      <Card>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : tab === 'targets' ? (
          targets.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 3 }}>
              {canManage
                ? autoTargets
                  ? 'Chưa có target — bấm "Tính target".'
                  : 'Chưa có target. Bật tự tính target ở Nhân sự → Cấu hình luật.'
                : 'Chưa có target đã công bố cho tháng này.'}
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tuần</TableCell>
                    <TableCell align="right">Target</TableCell>
                    {canManage && (
                      <>
                        <TableCell align="right">Tự tính</TableCell>
                        <TableCell align="right">Năm trước</TableCell>
                        <TableCell align="right">Hệ số</TableCell>
                        <TableCell align="right">Sàn</TableCell>
                        <TableCell align="right">Doanh thu</TableCell>
                        <TableCell align="right">Đạt</TableCell>
                      </>
                    )}
                    <TableCell>Trạng thái</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {targets.map((t) => {
                    const open = expanded === t.weekStart;
                    return (
                      <Fragment key={t.weekStart}>
                        <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => setExpanded(open ? null : t.weekStart)}>
                          <TableCell>
                            {fDate(t.weekStart, 'dd/MM')}–{fDate(weekEnd(t.weekStart), 'dd/MM')}
                          </TableCell>
                          <TableCell align="right">
                            <strong>{fVnd(t.targetAmount)}</strong>
                          </TableCell>
                          {canManage && (
                            <>
                              <TableCell align="right">{fVnd(t.autoAmount)}</TableCell>
                              <TableCell align="right">{fVnd(t.lastYearRevenue)}</TableCell>
                              <TableCell align="right">{t.trendFactor?.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</TableCell>
                              <TableCell align="right">{fVnd(t.floorAmount)}</TableCell>
                              <TableCell align="right">{fVnd(t.revenue)}</TableCell>
                              <TableCell align="right">
                                {t.revenue != null && t.targetAmount > 0 ? fPct((t.revenue / t.targetAmount) * 100) : '—'}
                              </TableCell>
                            </>
                          )}
                          <TableCell>
                            <Stack direction="row" spacing={0.5}>
                              <Chip
                                size="small"
                                color={t.publishedAt ? 'success' : 'default'}
                                label={t.publishedAt ? 'Đã công bố' : 'Nháp'}
                              />
                              {t.isManual && <Chip size="small" color="warning" variant="outlined" label="Sửa tay" />}
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            {canManage && (
                              <Button
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEdit({ target: t, amount: String(t.targetAmount), note: t.note ?? '' });
                                }}
                              >
                                Sửa
                              </Button>
                            )}
                            {canManage && t.publishedAt && (
                              <Button
                                size="small"
                                color="warning"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unpublish(t.weekStart);
                                }}
                              >
                                Thu hồi
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={canManage ? 11 : 4} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
                            <Collapse in={open} unmountOnExit>
                              <SlotTable target={t} showRevenue={canManage} />
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )
        ) : (
          <BonusTable weeks={bonus} />
        )}
      </Card>

      <Dialog open={!!edit} onClose={() => !busy && setEdit(null)} fullWidth maxWidth="xs">
        <DialogTitle>Sửa target tuần {edit && fDate(edit.target.weekStart, 'dd/MM')}</DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Tự tính: {fVnd(edit.target.autoAmount)}. Target từng ca được chia lại theo tỷ trọng cũ.
                {edit.target.publishedAt && ' Tuần đã công bố — nhân viên sẽ thấy số mới.'}
              </Typography>
              <TextField
                label="Target tuần (đồng)"
                value={edit.amount}
                onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
                inputMode="numeric"
              />
              <TextField
                label="Ghi chú (vd tuần Tết, chương trình riêng)"
                value={edit.note}
                onChange={(e) => setEdit({ ...edit, note: e.target.value })}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {edit?.target.isManual && (
            <Button color="inherit" disabled={busy} onClick={() => saveEdit(true)}>
              Dùng lại số tự tính
            </Button>
          )}
          <Button onClick={() => setEdit(null)} disabled={busy}>
            Đóng
          </Button>
          <LoadingButton
            variant="contained"
            loading={busy}
            disabled={!edit || !(Number(edit.amount.replace(/\D/g, '')) > 0)}
            onClick={() => saveEdit(false)}
          >
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

// ----------------------------------------------------------------------

function SlotTable({ target, showRevenue }: { target: ISalesTarget; showRevenue: boolean }) {
  if (target.slots.length === 0)
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        Chưa có ca chính nào trong tuần.
      </Typography>
    );
  return (
    <Table size="small" sx={{ my: 1 }}>
      <TableHead>
        <TableRow>
          <TableCell>Ngày</TableCell>
          <TableCell>Ca</TableCell>
          <TableCell align="right">Tỷ trọng</TableCell>
          <TableCell align="right">Target ca</TableCell>
          {showRevenue && <TableCell align="right">Doanh thu</TableCell>}
          {showRevenue && <TableCell align="right">Đạt</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {target.slots.map((s) => (
          <TableRow key={`${s.date}-${s.shiftScheduleId}`}>
            <TableCell>
              {WEEKDAY_LABEL[s.weekday]} {fDate(s.date, 'dd/MM')}
            </TableCell>
            <TableCell>
              {s.shiftName} · {s.start.slice(0, 5)}–{s.end.slice(0, 5)}
            </TableCell>
            <TableCell align="right">{fPct(s.share * 100)}</TableCell>
            <TableCell align="right">{fVnd(s.target)}</TableCell>
            {showRevenue && <TableCell align="right">{fVnd(s.revenue)}</TableCell>}
            {showRevenue && (
              <TableCell align="right">{s.revenue != null && s.target > 0 ? fPct((s.revenue / s.target) * 100) : '—'}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BonusTable({ weeks }: { weeks: IWeeklyBonus[] }) {
  if (weeks.length === 0)
    return (
      <Typography color="text.secondary" sx={{ p: 3 }}>
        Chưa có target cho tháng này.
      </Typography>
    );
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Alert severity="info">
        Vào bảng lương (kỳ cuối tháng) khi đã đặt ngày ở trang Chính sách ngày lễ › Thưởng doanh số tuần vào lương.
      </Alert>
      {weeks.map((w) => (
        <Card key={w.weekStart} variant="outlined">
          <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ p: 2 }} useFlexGap>
            <Typography variant="subtitle1">
              {fDate(w.weekStart, 'dd/MM')}–{fDate(weekEnd(w.weekStart), 'dd/MM')}
            </Typography>
            <Chip label={`Target ${fVnd(w.target)}`} />
            <Chip label={`Doanh thu ${fVnd(w.revenue)}`} />
            <Chip color={w.achievementPct >= 100 ? 'success' : 'default'} label={`Đạt ${fPct(w.achievementPct)}`} />
            <Chip color={w.fund > 0 ? 'primary' : 'default'} label={`Quỹ ${fVnd(w.fund)}`} />
          </Stack>
          {w.fund > 0 && w.shares.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nhân viên</TableCell>
                  <TableCell align="right">Giờ làm</TableCell>
                  <TableCell align="right">Thưởng</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {w.shares.map((s) => (
                  <TableRow key={s.userId}>
                    <TableCell>{s.fullName}</TableCell>
                    <TableCell align="right">{s.hours.toLocaleString('vi-VN')}</TableCell>
                    <TableCell align="right">
                      {fVnd(s.amount)}
                      {s.appliedPct != null && s.baseAmount != null && s.amount !== s.baseAmount && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {s.appliedPct < 100
                            ? `Nhận ${s.appliedPct}% (điểm trừ ${s.deductionPoints ?? 0}) · chia theo giờ ${fVnd(s.baseAmount)}`
                            : `Gồm phần chia lại ${fVnd(s.amount - s.baseAmount)}`}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      ))}
    </Stack>
  );
}
