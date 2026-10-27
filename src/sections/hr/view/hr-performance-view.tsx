'use client';

import { useState, useEffect, useCallback } from 'react';

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
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';


import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';
import { getShiftSchedulesByDateRange } from 'src/api/attendance';
import { PERMISSIONS, hasPermission, hasAnyPermission } from 'src/auth/permissions';
import {
  addExcludedShift,
  getMyPerformance,
  getExcludedShifts,
  publishPerformance,
  computePerformance,
  removeExcludedShift,
  getPerformanceMonth,
  requestPerformanceReview,
  respondPerformanceReview,
} from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IShiftSchedule } from 'src/types/corecms-api';
import type { IExcludedShift, IPerformanceMonth, IPerformanceScore } from 'src/types/hr';
import { WORK_TASK_GROUP_LABEL, PERFORMANCE_RATING_COLOR, PERFORMANCE_RATING_LABEL } from 'src/types/hr';

import { fPct, fVnd, monthEnd, MonthField, monthStart, previousMonth } from '../hr-common';

// ----------------------------------------------------------------------
// Điểm hiệu suất (Quy chế Chương V) + xếp loại hoàn thành công việc (Chương VI). Xếp loại theo tỷ lệ đạt target chuẩn hoá
// (bình quân theo giờ các ca đã làm), không theo tổng điểm. Công bố sau ngày cuối tháng; nhân viên có 3 ngày làm việc để
// đề nghị xem xét lại. "Không hoàn thành 2 tháng liên tiếp" chỉ là cờ cho chủ hộ — hệ thống không tự làm gì.
// ----------------------------------------------------------------------

/** Tháng chạy thử (chủ tịch 2026-10-27): tính và công bố như thật nhưng chưa dùng làm căn cứ xếp loại. */
const TRIAL_MONTHS = ['2026-11-01', '2026-12-01'];

const COMPONENTS: { key: keyof IPerformanceScore; label: string; max: string }[] = [
  { key: 'salesPoints', label: 'Doanh số', max: '40 (tối đa 48)' },
  { key: 'qualityPoints', label: 'Chất lượng bán', max: '15' },
  { key: 'taskPoints', label: 'Nhiệm vụ', max: '20' },
  { key: 'disciplinePoints', label: 'Kỷ luật', max: '15' },
  { key: 'reconciliationPoints', label: 'Đối soát', max: '10' },
  { key: 'initiativePoints', label: 'Sáng kiến', max: '+5' },
];

export default function HrPerformanceView({ initialTab }: { initialTab?: string }) {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const [confirm, confirmDialog] = useConfirmDialog();
  const canRead = hasAnyPermission(user, [PERMISSIONS.hr.performanceRead, PERMISSIONS.hr.performanceManage]);
  const canManage = hasPermission(user, PERMISSIONS.hr.performanceManage);

  const [tab, setTab] = useState<'month' | 'mine'>(initialTab === 'mine' || !canRead ? 'mine' : 'month');
  const [month, setMonth] = useState(previousMonth(monthStart()));
  const [data, setData] = useState<IPerformanceMonth | null>(null);
  const [mine, setMine] = useState<IPerformanceScore[]>([]);
  const [excluded, setExcluded] = useState<IExcludedShift[]>([]);
  const [schedules, setSchedules] = useState<IShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<IPerformanceScore | null>(null);
  const [exclude, setExclude] = useState<{ date: string; shiftScheduleId: string; reason: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'mine') {
        setMine(await getMyPerformance());
      } else {
        setData(await getPerformanceMonth(month));
        setExcluded(await getExcludedShifts(month));
      }
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được kết quả'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tab, month, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canManage || tab !== 'month') return;
    getShiftSchedulesByDateRange(month, monthEnd(month))
      .then(setSchedules)
      .catch(() => setSchedules([]));
  }, [canManage, tab, month]);

  const compute = async () => {
    setBusy(true);
    try {
      setData(await computePerformance(month));
      enqueueSnackbar('Đã tính điểm');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tính được điểm'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    const ok = await confirm({
      title: `Công bố kết quả tháng ${fDate(month, 'MM/yyyy')}`,
      content: 'Mỗi nhân viên được báo và xem được điểm, xếp loại kèm số liệu từng ca. Sau khi công bố không tính lại được.',
      confirmText: 'Công bố',
    });
    if (!ok) return;
    setBusy(true);
    try {
      setData(await publishPerformance(month));
      enqueueSnackbar('Đã công bố');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không công bố được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const saveExclude = async () => {
    if (!exclude) return;
    setBusy(true);
    try {
      await addExcludedShift(exclude.date, exclude.shiftScheduleId, exclude.reason.trim());
      setExclude(null);
      enqueueSnackbar('Đã loại ca — bấm "Tính điểm" để áp dụng');
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const published = !!data?.publishedAt;
  const scheduleName = (id: string) => schedules.find((s) => s.id === id)?.templateName ?? 'Ca';

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Điểm & xếp loại"
        links={[{ name: 'Nhân sự' }, { name: 'Điểm & xếp loại' }]}
        action={
          canManage &&
          tab === 'month' && (
            <Stack direction="row" spacing={1}>
              <LoadingButton variant="outlined" loading={busy} disabled={published} onClick={compute}>
                Tính điểm
              </LoadingButton>
              <LoadingButton variant="contained" loading={busy} disabled={published || !data?.computedAt} onClick={publish}>
                Công bố
              </LoadingButton>
            </Stack>
          )
        }
        sx={{ mb: 2 }}
      />

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        {canRead && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab value="month" label="Kết quả tháng" />
            <Tab value="mine" label="Của tôi" />
          </Tabs>
        )}
        {tab === 'month' && <MonthField value={month} onChange={setMonth} />}
        {tab === 'month' && data && (
          <Typography variant="body2" color="text.secondary">
            {data.publishedAt
              ? `Đã công bố ${fDateTime(data.publishedAt, 'HH:mm dd/MM')}`
              : data.computedAt
                ? `Tính lúc ${fDateTime(data.computedAt, 'HH:mm dd/MM')} · chưa công bố`
                : 'Chưa tính'}
          </Typography>
        )}
      </Stack>

      {tab === 'month' && TRIAL_MONTHS.includes(month) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Tháng {fDate(month, 'MM/yyyy')} là tháng chạy thử — kết quả để nhân viên làm quen, chưa dùng làm căn cứ cảnh báo hay
          chấm dứt hợp đồng.
        </Alert>
      )}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : tab === 'mine' ? (
        mine.length === 0 ? (
          <Card>
            <Typography color="text.secondary" sx={{ p: 3 }}>
              Chưa có kết quả nào được công bố.
            </Typography>
          </Card>
        ) : (
          <Stack spacing={2}>
            {mine.map((s) => (
              <MyScoreCard key={s.id} score={s} onChanged={load} />
            ))}
          </Stack>
        )
      ) : (
        <Stack spacing={2}>
          <Card>
            {!data || data.scores.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 3 }}>
                {canManage ? 'Chưa có kết quả — bấm "Tính điểm".' : 'Chưa có kết quả.'}
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nhân viên</TableCell>
                      <TableCell align="right">Ca</TableCell>
                      <TableCell align="right">Đạt target</TableCell>
                      {COMPONENTS.map((c) => (
                        <TableCell key={c.key} align="right">
                          {c.label}
                        </TableCell>
                      ))}
                      <TableCell align="right">Tổng</TableCell>
                      <TableCell>Xếp loại</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.scores.map((s) => (
                      <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetail(s)}>
                        <TableCell>
                          {s.fullName}
                          {s.reviewRequestedAt && !s.reviewResponse && (
                            <Chip size="small" color="warning" label="Đề nghị xem lại" sx={{ ml: 1 }} />
                          )}
                        </TableCell>
                        <TableCell align="right">{s.shiftCount}</TableCell>
                        <TableCell align="right">{fPct(s.targetAchievementPct)}</TableCell>
                        {COMPONENTS.map((c) => (
                          <TableCell key={c.key} align="right">
                            {(s[c.key] as number).toLocaleString('vi-VN')}
                          </TableCell>
                        ))}
                        <TableCell align="right">
                          <strong>{s.total.toLocaleString('vi-VN')}</strong>
                          {s.isDefaultScore && (
                            <Typography component="span" variant="caption" color="text.secondary">
                              {' '}
                              (mặc định)
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" color={PERFORMANCE_RATING_COLOR[s.rating]} label={PERFORMANCE_RATING_LABEL[s.rating]} />
                          {s.consecutiveNotComplete && (
                            <Chip size="small" color="error" variant="outlined" label="2 tháng liên tiếp" sx={{ ml: 0.5 }} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>

          <Card>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, pb: 1 }}>
              <Box>
                <Typography variant="subtitle1">Ca loại khỏi tỷ lệ đạt target (Điều 19)</Typography>
                <Typography variant="caption" color="text.secondary">
                  Mất điện, sự cố phần mềm bán hàng, đóng cửa đột xuất, thời tiết cực đoan có cảnh báo.
                </Typography>
              </Box>
              {canManage && !published && (
                <Button size="small" onClick={() => setExclude({ date: month, shiftScheduleId: '', reason: '' })}>
                  Loại một ca
                </Button>
              )}
            </Stack>
            {excluded.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
                Không có ca nào bị loại.
              </Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {excluded.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{fDate(e.date, 'EEE dd/MM')}</TableCell>
                      <TableCell>{scheduleName(e.shiftScheduleId)}</TableCell>
                      <TableCell>{e.reason}</TableCell>
                      <TableCell align="right">
                        {canManage && !published && (
                          <Button
                            size="small"
                            color="inherit"
                            onClick={async () => {
                              await removeExcludedShift(e.id).catch((err) =>
                                enqueueSnackbar(apiErrorMessage(err, 'Không bỏ được'), { variant: 'error' })
                              );
                              load();
                            }}
                          >
                            Bỏ
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </Stack>
      )}

      <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="md">
        <DialogTitle>
          {detail?.fullName} · tháng {detail && fDate(detail.month, 'MM/yyyy')}
        </DialogTitle>
        <DialogContent>
          {detail && (
            <ScoreDetails
              score={detail}
              canRespond={canManage}
              onResponded={(s) => {
                setDetail(s);
                load();
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!exclude} onClose={() => !busy && setExclude(null)} fullWidth maxWidth="xs">
        <DialogTitle>Loại một ca khỏi tỷ lệ đạt target</DialogTitle>
        <DialogContent>
          {exclude && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                type="date"
                label="Ngày"
                value={exclude.date}
                onChange={(e) => setExclude({ ...exclude, date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                select
                label="Ca"
                value={exclude.shiftScheduleId}
                onChange={(e) => setExclude({ ...exclude, shiftScheduleId: e.target.value })}
              >
                {schedules.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.templateName} · {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Lý do khách quan"
                value={exclude.reason}
                onChange={(e) => setExclude({ ...exclude, reason: e.target.value })}
                multiline
                minRows={2}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExclude(null)} disabled={busy}>
            Đóng
          </Button>
          <LoadingButton
            variant="contained"
            loading={busy}
            disabled={!exclude?.shiftScheduleId || !exclude?.reason.trim()}
            onClick={saveExclude}
          >
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {confirmDialog}
    </Container>
  );
}

// ----------------------------------------------------------------------

function ScoreDetails({
  score: s,
  canRespond,
  onResponded,
}: {
  score: IPerformanceScore;
  canRespond: boolean;
  onResponded?: (s: IPerformanceScore) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [response, setResponse] = useState(s.reviewResponse ?? '');
  const [saving, setSaving] = useState(false);
  const d = s.details ?? {};

  const respond = async () => {
    setSaving(true);
    try {
      onResponded?.(await respondPerformanceReview(s.id, response.trim()));
      enqueueSnackbar('Đã trả lời');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="h4">{s.total.toLocaleString('vi-VN')}</Typography>
        <Chip color={PERFORMANCE_RATING_COLOR[s.rating]} label={PERFORMANCE_RATING_LABEL[s.rating]} />
        {s.isDefaultScore && <Chip variant="outlined" label="Điểm mặc định nhân viên mới" />}
        {s.consecutiveNotComplete && <Chip color="error" variant="outlined" label="Không hoàn thành 2 tháng liên tiếp" />}
      </Stack>
      {s.ratingReason && <Typography variant="body2">{s.ratingReason}</Typography>}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {COMPONENTS.map((c) => (
          <Chip key={c.key} variant="outlined" label={`${c.label}: ${(s[c.key] as number).toLocaleString('vi-VN')} / ${c.max}`} />
        ))}
      </Stack>

      <Typography variant="body2" color="text.secondary">
        {s.shiftCount} ca · {s.hoursWorked.toLocaleString('vi-VN')} giờ · đạt target {fPct(s.targetAchievementPct)} · đi muộn{' '}
        {s.lateCount} · quên chấm ra {s.missedCheckoutCount} · lỗi bảng kiểm {s.inspectionFaults} · chênh lệch lỗi cá nhân{' '}
        {s.discrepancyFaults}
      </Typography>

      {(d.notes?.length ?? 0) > 0 && (
        <Alert severity="info">
          {d.notes!.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </Alert>
      )}

      {d.quality && (
        <Typography variant="body2">
          Chất lượng bán (ca của bạn / cả cửa hàng): đơn trung bình {fVnd(d.quality.mine.avgOrderValue)} /{' '}
          {fVnd(d.quality.store.avgOrderValue)} · số món / đơn {d.quality.mine.itemsPerOrder} / {d.quality.store.itemsPerOrder} · đơn
          có khách {fPct(d.quality.mine.customerShare * 100)} / {fPct(d.quality.store.customerShare * 100)}
        </Typography>
      )}

      {(d.tasks?.length ?? 0) > 0 && (
        <Typography variant="body2">
          Nhiệm vụ:{' '}
          {d.tasks!.map((t) => `${WORK_TASK_GROUP_LABEL[t.group] ?? t.group} ${t.approvedOnTime}/${t.assigned}`).join(' · ')}
          {d.initiatives && ` · sáng kiến ${d.initiatives.approved} (triển khai ${d.initiatives.implemented})`}
        </Typography>
      )}

      {(d.shifts?.length ?? 0) > 0 && (
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Ngày</TableCell>
                <TableCell>Ca</TableCell>
                <TableCell align="right">Giờ</TableCell>
                <TableCell align="right">Doanh thu ca</TableCell>
                <TableCell align="right">Target ca</TableCell>
                <TableCell align="right">Đạt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {d.shifts!.map((x, i) => (
                <TableRow key={`${x.date}-${i}`}>
                  <TableCell>{fDate(x.date, 'EEE dd/MM')}</TableCell>
                  <TableCell>{x.shift}</TableCell>
                  <TableCell align="right">{x.hours}</TableCell>
                  {x.excluded ? (
                    <TableCell colSpan={3}>
                      <Typography variant="caption" color="text.secondary">
                        Loại: {x.excluded}
                      </Typography>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell align="right">{fVnd(x.revenue)}</TableCell>
                      <TableCell align="right">{x.target ? fVnd(x.target) : 'Chưa có'}</TableCell>
                      <TableCell align="right">{fPct(x.pct)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {s.reviewRequestedAt && (
        <Alert severity="warning">
          Đề nghị xem xét lại ({fDateTime(s.reviewRequestedAt, 'HH:mm dd/MM')}): {s.reviewRequestNote}
        </Alert>
      )}
      {s.reviewRequestedAt &&
        (canRespond ? (
          <Stack spacing={1}>
            <TextField
              label="Trả lời nhân viên"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              multiline
              minRows={2}
            />
            <LoadingButton
              variant="contained"
              loading={saving}
              disabled={!response.trim()}
              onClick={respond}
              sx={{ alignSelf: 'flex-end' }}
            >
              Gửi trả lời
            </LoadingButton>
          </Stack>
        ) : (
          s.reviewResponse && <Alert severity="info">Trả lời: {s.reviewResponse}</Alert>
        ))}
    </Stack>
  );
}

function MyScoreCard({ score, onChanged }: { score: IPerformanceScore; onChanged: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const canRequest =
    !score.reviewRequestedAt && !!score.reviewDeadline && new Date(score.reviewDeadline).getTime() > Date.now();

  const send = async () => {
    setSaving(true);
    try {
      await requestPerformanceReview(score.id, note.trim());
      enqueueSnackbar('Đã gửi đề nghị xem xét lại');
      setOpen(false);
      onChanged();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không gửi được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">Tháng {fDate(score.month, 'MM/yyyy')}</Typography>
          {canRequest && (
            <Button size="small" onClick={() => setOpen(true)}>
              Đề nghị xem xét lại
            </Button>
          )}
        </Stack>
        {TRIAL_MONTHS.includes(score.month) && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Tháng chạy thử — để làm quen, chưa dùng làm căn cứ đánh giá.
          </Alert>
        )}
        <ScoreDetails score={score} canRespond={false} />
        {canRequest && score.reviewDeadline && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Hạn đề nghị xem xét lại: hết {fDateTime(new Date(new Date(score.reviewDeadline).getTime() - 1), 'dd/MM')}
          </Typography>
        )}
      </CardContent>
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Đề nghị xem xét lại</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            sx={{ mt: 1 }}
            label="Điểm nào cần xem lại, vì sao (vd ca nào bị ảnh hưởng)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={4}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Đóng
          </Button>
          <LoadingButton variant="contained" loading={saving} disabled={!note.trim()} onClick={send}>
            Gửi
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
