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
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
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

import type { IShiftPoolPost } from 'src/types/corecms-api';

import { cancelShiftPoolPost, getMyShiftPoolPosts, reviewShiftPoolPost } from 'src/api/shiftPool';

import PoolCalendar from './pool-calendar';
import LegendDot from './pool-legend';
import { fmtDate, needTypeLabel, poolStatusColor, poolStatusLabel, statusHex } from './pool-helpers';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'shift', label: 'Ca', width: 160 },
  { id: 'date', label: 'Ngày', width: 110 },
  { id: 'need', label: 'Nhu cầu', width: 130 },
  { id: 'claimer', label: 'Người nhận', width: 150 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: 'reviewNote', label: 'Phản hồi', width: 150 },
  { id: 'action', label: '', width: 90 },
];

function isCancellable(s: string) {
  return s === 'Open' || s === 'WaitingApproval';
}

// ----------------------------------------------------------------------

export default function MyPoolPostsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [posts, setPosts] = useState<IShiftPoolPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [selected, setSelected] = useState<IShiftPoolPost | null>(null);
  const [acting, setActing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setPosts(await getMyShiftPoolPosts());
    } catch {
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCancel = async (id: string) => {
    try {
      await cancelShiftPoolPost(id);
      enqueueSnackbar('Đã huỷ bài đăng.', { variant: 'success' });
      setSelected(null);
      fetchData();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Huỷ thất bại!', { variant: 'error' });
    }
  };

  // Người đăng (staff 1) xác nhận người nhận → thực hiện đổi ca / làm hộ
  const handleConfirm = async (id: string, accept: boolean) => {
    setActing(true);
    try {
      await reviewShiftPoolPost(id, { action: accept ? 'Approve' : 'RejectClaim' });
      enqueueSnackbar(accept ? 'Đã xác nhận đổi ca / làm hộ!' : 'Đã từ chối người nhận.', {
        variant: 'success',
      });
      setSelected(null);
      fetchData();
    } catch (error: any) {
      enqueueSnackbar(error?.title || error?.message || 'Thao tác thất bại!', { variant: 'error' });
    } finally {
      setActing(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Bài đăng của tôi"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đổi ca & Làm hộ' },
          { name: 'Bài đăng của tôi' },
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
            getColor={(p) => statusHex(p.status)}
            getTitle={(p) => `${needTypeLabel(p.needType)} · ${poolStatusLabel(p.status)}`}
            onClickPost={setSelected}
          />
          <Stack direction="row" spacing={2} sx={{ mt: 1.5, px: 1 }} flexWrap="wrap">
            <LegendDot color={statusHex('Open')} label="Đang mở" />
            <LegendDot color={statusHex('WaitingApproval')} label="Chờ duyệt" />
            <LegendDot color={statusHex('Approved')} label="Đã duyệt" />
            <LegendDot color={statusHex('Cancelled')} label="Đã huỷ" />
            <LegendDot color={statusHex('Cancelled')} label="Đã huỷ" />
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
                      <td style={{ padding: '16px' }}>{row.shiftName}</td>
                      <td style={{ padding: '16px' }}>{fmtDate(row.shiftDate)}</td>
                      <td style={{ padding: '16px' }}>{needTypeLabel(row.needType)}</td>
                      <td style={{ padding: '16px' }}>{row.claimerName || '-'}</td>
                      <td style={{ padding: '16px' }}>
                        <Label color={poolStatusColor(row.status)}>{poolStatusLabel(row.status)}</Label>
                      </td>
                      <td style={{ padding: '16px' }}>{row.reviewNote || '-'}</td>
                      <td style={{ padding: '16px' }}>
                        <Stack direction="row" spacing={1}>
                          {row.status === 'WaitingApproval' && (
                            <Button size="small" variant="contained" onClick={() => setSelected(row)}>
                              Xác nhận
                            </Button>
                          )}
                          {isCancellable(row.status) && (
                            <Button size="small" color="error" onClick={() => handleCancel(row.id)}>
                              Huỷ
                            </Button>
                          )}
                        </Stack>
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

      {/* Detail / cancel dialog (calendar click) */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Bài đăng của tôi</DialogTitle>
        <DialogContent>
          {selected && (
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="subtitle2">
                {needTypeLabel(selected.needType)} · {selected.shiftName} · {fmtDate(selected.shiftDate)}
              </Typography>
              <Box>
                <Label color={poolStatusColor(selected.status)}>{poolStatusLabel(selected.status)}</Label>
              </Box>
              {selected.claimerName && (
                <Typography variant="body2">Người nhận: {selected.claimerName}</Typography>
              )}
              {selected.needType === 'Swap' && selected.claimerOfferedShiftName && (
                <Typography variant="body2">
                  Ca đổi lại: {selected.claimerOfferedShiftName} (
                  {fmtDate(selected.claimerOfferedShiftDate)})
                </Typography>
              )}
              {selected.needType === 'PartialCover' && selected.partialStartTime && (
                <Typography variant="body2">
                  Khoảng làm hộ: {selected.partialStartTime} - {selected.partialEndTime}
                </Typography>
              )}
              {selected.reviewNote && (
                <Typography variant="body2" color="text.secondary">
                  Phản hồi: {selected.reviewNote}
                </Typography>
              )}
              {selected.status === 'WaitingApproval' && (
                <Typography variant="caption" color="text.secondary">
                  Xác nhận để hoàn tất đổi ca / làm hộ với người nhận.
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setSelected(null)}>
            Đóng
          </Button>
          {selected && selected.status === 'WaitingApproval' && (
            <>
              <Button
                color="error"
                onClick={() => handleConfirm(selected.id, false)}
                disabled={acting}
              >
                Từ chối
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={() => handleConfirm(selected.id, true)}
                disabled={acting}
              >
                Xác nhận
              </Button>
            </>
          )}
          {selected && selected.status === 'Open' && (
            <Button color="error" variant="contained" onClick={() => handleCancel(selected.id)}>
              Huỷ bài đăng
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}
