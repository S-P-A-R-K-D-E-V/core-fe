'use client';

import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Label from 'src/components/label';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import { TableHeadCustom, TableNoData } from 'src/components/table';

import type { IShiftPoolPost } from 'src/types/corecms-api';

import { getPendingShiftPoolPosts, reviewShiftPoolPost } from 'src/api/shiftPool';

import { fmtDate, needTypeLabel } from './pool-helpers';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'poster', label: 'Người đăng', width: 140 },
  { id: 'shift', label: 'Ca', width: 150 },
  { id: 'date', label: 'Ngày', width: 100 },
  { id: 'need', label: 'Nhu cầu', width: 120 },
  { id: 'claimer', label: 'Người nhận', width: 140 },
  { id: 'offered', label: 'Ca đổi lại', width: 150 },
  { id: 'action', label: '', width: 160 },
];

// ----------------------------------------------------------------------

export default function PendingPoolView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [posts, setPosts] = useState<IShiftPoolPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState<IShiftPoolPost | null>(null);
  const [approve, setApprove] = useState(true);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setPosts(await getPendingShiftPoolPosts());
    } catch {
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openReview = (post: IShiftPoolPost, isApprove: boolean) => {
    setTarget(post);
    setApprove(isApprove);
    setNote('');
  };

  const handleSubmit = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      await reviewShiftPoolPost(target.id, {
        status: approve ? 'Approved' : 'Rejected',
        reviewNote: note || undefined,
      });
      enqueueSnackbar(approve ? 'Đã duyệt!' : 'Đã từ chối.', { variant: 'success' });
      setTarget(null);
      fetchData();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Thao tác thất bại!', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Duyệt đổi ca & làm hộ"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đổi ca & Làm hộ' },
          { name: 'Duyệt' },
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
                      <td style={{ padding: '16px' }}>
                        {row.shiftName}
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {row.needType === 'PartialCover' && row.partialStartTime
                            ? `${row.partialStartTime} - ${row.partialEndTime}`
                            : `${row.shiftStartTime} - ${row.shiftEndTime}`}
                        </Typography>
                      </td>
                      <td style={{ padding: '16px' }}>{fmtDate(row.shiftDate)}</td>
                      <td style={{ padding: '16px' }}>
                        <Label color="info">{needTypeLabel(row.needType)}</Label>
                      </td>
                      <td style={{ padding: '16px' }}>{row.claimerName || '-'}</td>
                      <td style={{ padding: '16px' }}>
                        {row.needType === 'Swap'
                          ? `${row.claimerOfferedShiftName || '-'} (${fmtDate(row.claimerOfferedShiftDate)})`
                          : '-'}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => openReview(row, true)}
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => openReview(row, false)}
                          >
                            Từ chối
                          </Button>
                        </Stack>
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

      {/* Review dialog */}
      <Dialog open={!!target} onClose={() => setTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{approve ? 'Duyệt yêu cầu' : 'Từ chối yêu cầu'}</DialogTitle>
        <DialogContent>
          {target && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="subtitle2">
                  {needTypeLabel(target.needType)} · {target.shiftName} · {fmtDate(target.shiftDate)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {target.posterName} → {target.claimerName}
                </Typography>
              </Box>

              {approve && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {target.needType === 'Swap' && <Chip size="small" label="Hoán đổi 2 ca" color="info" />}
                  {target.needType === 'FullCover' && (
                    <Chip size="small" label="Chuyển cả ca sang người nhận" color="info" />
                  )}
                  {target.needType === 'PartialCover' && (
                    <Chip size="small" label="Tính phụ cấp làm hộ theo giờ" color="warning" />
                  )}
                </Stack>
              )}

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Ghi chú (tuỳ chọn)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setTarget(null)}>
            Đóng
          </Button>
          <Button
            variant="contained"
            color={approve ? 'success' : 'error'}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {approve ? 'Duyệt' : 'Từ chối'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
