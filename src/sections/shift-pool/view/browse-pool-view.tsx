'use client';

import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import { TableHeadCustom, TableNoData } from 'src/components/table';

import type { IShiftAssignment, IShiftPoolPost } from 'src/types/corecms-api';

import { getMySchedule } from 'src/api/attendance';
import { claimShiftPoolPost, getOpenShiftPoolPosts } from 'src/api/shiftPool';

import PoolCalendar from './pool-calendar';
import LegendDot from './pool-legend';
import { fmtDate, needTypeHex, needTypeLabel, partialCoverSubTypeLabel, poolStatusColor } from './pool-helpers';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'poster', label: 'Người đăng', width: 150 },
  { id: 'shift', label: 'Ca', width: 160 },
  { id: 'date', label: 'Ngày', width: 110 },
  { id: 'time', label: 'Giờ', width: 120 },
  { id: 'need', label: 'Nhu cầu', width: 130 },
  { id: 'note', label: 'Ghi chú', width: 160 },
  { id: 'action', label: '', width: 100 },
];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ----------------------------------------------------------------------

export default function BrowsePoolView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [posts, setPosts] = useState<IShiftPoolPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

  // claim dialog
  const [target, setTarget] = useState<IShiftPoolPost | null>(null);
  const [myAssignments, setMyAssignments] = useState<IShiftAssignment[]>([]);
  const [offeredId, setOfferedId] = useState('');
  const [loadingMine, setLoadingMine] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setPosts(await getOpenShiftPoolPosts());
    } catch {
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Khi mở dialog nhận ca dạng Swap: tải các ca SẮP TỚI của chính mình (dùng my-schedule
  // vì endpoint /range chỉ cho Admin/Manager). Lọc bỏ ca đã bắt đầu và ca trùng đúng ca đang đăng.
  useEffect(() => {
    if (!target || target.needType !== 'Swap') return;
    setLoadingMine(true);
    setOfferedId('');
    const from = toDateStr(new Date());
    const to = toDateStr(new Date(Date.now() + 60 * 24 * 3600 * 1000));
    getMySchedule(from, to)
      .then((all) => {
        const now = Date.now();
        const upcoming = all.filter((a) => {
          const dateStr = (a.date ?? '').split('T')[0];
          const start = a.startTime || (a as any).shiftStartTime || '00:00';
          const startMs = new Date(`${dateStr}T${start}`).getTime();
          const aid = a.id || (a as any).assignmentId;
          // chỉ ca chưa bắt đầu, và không phải đúng ca đang được đăng
          return startMs > now && aid !== target.shiftAssignmentId;
        });
        setMyAssignments(upcoming);
      })
      .catch(() => setMyAssignments([]))
      .finally(() => setLoadingMine(false));
  }, [target]);

  const handleOpenClaim = (post: IShiftPoolPost) => {
    setTarget(post);
    setMyAssignments([]);
    setOfferedId('');
  };

  const handleCloseClaim = () => setTarget(null);

  const handleSubmitClaim = async () => {
    if (!target) return;
    if (target.needType === 'Swap' && !offeredId) return;
    setSubmitting(true);
    try {
      await claimShiftPoolPost(target.id, {
        offeredAssignmentId: target.needType === 'Swap' ? offeredId : undefined,
      });
      enqueueSnackbar('Đã nhận ca! Chờ người đăng xác nhận.', { variant: 'success' });
      setTarget(null);
      fetchData();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Nhận ca thất bại!', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const fmtAssignment = (a: IShiftAssignment) => {
    const name = (a as any).scheduleName || (a as any).shiftName || 'Ca làm việc';
    const dateStr = (a.date ?? '').split('T')[0];
    const d = dateStr ? new Date(dateStr).toLocaleDateString('vi-VN') : '';
    return `${d} · ${name} (${a.startTime?.slice(0, 5)} - ${a.endTime?.slice(0, 5)})`;
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Chợ ca (đổi ca & làm hộ)"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đổi ca & Làm hộ' },
          { name: 'Chợ ca' },
        ]}
        action={
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
          >
            <ToggleButton value="calendar">
              <Iconify icon="eva:calendar-fill" />
            </ToggleButton>
            <ToggleButton value="table">
              <Iconify icon="eva:list-fill" />
            </ToggleButton>
          </ToggleButtonGroup>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {loading ? (
        <Card>
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        </Card>
      ) : viewMode === 'calendar' ? (
        <>
          <PoolCalendar
            posts={posts}
            getColor={(p) => needTypeHex(p.needType)}
            getTitle={(p) => `${needTypeLabel(p.needType)} · ${p.posterName}`}
            onClickPost={handleOpenClaim}
          />
          <Stack direction="row" spacing={2} sx={{ mt: 1.5, px: 1 }} flexWrap="wrap">
            <LegendDot color={needTypeHex('Swap')} label="Đổi ca" />
            <LegendDot color={needTypeHex('FullCover')} label="Làm hộ cả ca" />
            <LegendDot color={needTypeHex('PartialCover')} label="Làm hộ 1 phần" />
            <Typography variant="caption" color="text.secondary">
              · Click vào ca để nhận
            </Typography>
          </Stack>
        </>
      ) : (
        <Card>
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table>
                <TableHeadCustom headLabel={TABLE_HEAD} />
                <TableBody>
                  {posts.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: '16px' }}>{row.posterName}</td>
                      <td style={{ padding: '16px' }}>{row.shiftName}</td>
                      <td style={{ padding: '16px' }}>{fmtDate(row.shiftDate)}</td>
                      <td style={{ padding: '16px' }}>
                        {row.needType === 'PartialCover' && row.partialStartTime
                          ? `${row.partialStartTime} - ${row.partialEndTime}`
                          : `${row.shiftStartTime} - ${row.shiftEndTime}`}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <Label color={poolStatusColor(row.status)}>{needTypeLabel(row.needType)}</Label>
                      </td>
                      <td style={{ padding: '16px' }}>{row.note || '-'}</td>
                      <td style={{ padding: '16px' }}>
                        <Button size="small" variant="contained" onClick={() => handleOpenClaim(row)}>
                          Nhận
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {posts.length === 0 && <TableNoData notFound />}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        </Card>
      )}

      {/* Claim dialog */}
      <Dialog open={!!target} onClose={handleCloseClaim} maxWidth="xs" fullWidth>
        <DialogTitle>Nhận ca</DialogTitle>
        <DialogContent>
          {target && (
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {needTypeLabel(target.needType)} · {target.posterName}
                </Typography>
                <Typography variant="subtitle2">
                  {target.shiftName} · {fmtDate(target.shiftDate)} ·{' '}
                  {target.needType === 'PartialCover' && target.partialStartTime
                    ? `${target.partialStartTime} - ${target.partialEndTime}`
                    : `${target.shiftStartTime} - ${target.shiftEndTime}`}
                </Typography>
              </Box>

              {target.needType === 'Swap' ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Đổi ca 2 chiều — chọn 1 ca sắp tới của bạn để đưa đổi lại:
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    label="Ca của bạn đưa đổi"
                    value={offeredId}
                    onChange={(e) => setOfferedId(e.target.value)}
                    disabled={loadingMine}
                    helperText={
                      loadingMine
                        ? 'Đang tải...'
                        : myAssignments.length === 0
                        ? 'Bạn không có ca sắp tới nào để đổi'
                        : 'Bắt buộc chọn ca để đổi'
                    }
                  >
                    {myAssignments.map((a) => (
                      <MenuItem key={a.id || (a as any).assignmentId} value={a.id || (a as any).assignmentId}>
                        {fmtAssignment(a)}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              ) : target.needType === 'PartialCover' ? (
                (() => {
                  const sub = partialCoverSubTypeLabel(
                    target.partialStartTime,
                    target.partialEndTime,
                    target.shiftStartTime,
                    target.shiftEndTime
                  );
                  return (
                    <Stack spacing={1}>
                      <Typography variant="body2" fontWeight={600}>
                        {sub.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {sub.hint} Người đăng sẽ xác nhận sau khi bạn nhận.
                      </Typography>
                    </Stack>
                  );
                })()
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Bạn sẽ làm hộ cả ca này. Người đăng sẽ xác nhận sau khi bạn nhận.
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={handleCloseClaim}>
            Huỷ
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitClaim}
            disabled={submitting || (target?.needType === 'Swap' && !offeredId)}
          >
            Xác nhận nhận
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
