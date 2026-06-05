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
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import { TableHeadCustom, TableNoData } from 'src/components/table';

import type { IShiftAssignment, IShiftPoolPost } from 'src/types/corecms-api';

import { getShiftAssignments } from 'src/api/attendance';
import { claimShiftPoolPost, getOpenShiftPoolPosts } from 'src/api/shiftPool';

import { fmtDate, needTypeLabel, poolStatusColor } from './pool-helpers';

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
  const { user: authUser } = useAuthContext();

  const [posts, setPosts] = useState<IShiftPoolPost[]>([]);
  const [loading, setLoading] = useState(true);

  // claim dialog
  const [target, setTarget] = useState<IShiftPoolPost | null>(null);
  const [offerDate, setOfferDate] = useState(toDateStr(new Date()));
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

  // load my shifts for swap-offer when date changes
  useEffect(() => {
    if (!target || target.needType !== 'Swap' || !authUser?.id || !offerDate) return;
    setLoadingMine(true);
    setOfferedId('');
    getShiftAssignments(offerDate, offerDate, authUser.id)
      .then(setMyAssignments)
      .catch(() => setMyAssignments([]))
      .finally(() => setLoadingMine(false));
  }, [target, offerDate, authUser?.id]);

  const handleOpenClaim = (post: IShiftPoolPost) => {
    setTarget(post);
    setOfferDate(post.shiftDate || toDateStr(new Date()));
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
      enqueueSnackbar('Đã nhận ca! Chờ quản lý duyệt.', { variant: 'success' });
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
    return `${name} (${a.startTime?.slice(0, 5)} - ${a.endTime?.slice(0, 5)})`;
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
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        ) : (
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
        )}
      </Card>

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
                    Đổi ca 2 chiều — chọn 1 ca của bạn để đưa đổi lại:
                  </Typography>
                  <TextField
                    fullWidth
                    type="date"
                    label="Ngày ca của bạn"
                    value={offerDate}
                    onChange={(e) => setOfferDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
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
                        ? 'Bạn không có ca nào trong ngày này'
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
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Bạn sẽ làm hộ {target.needType === 'FullCover' ? 'cả ca' : 'khoảng thời gian'} này.
                  Yêu cầu sẽ được gửi cho quản lý duyệt.
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
