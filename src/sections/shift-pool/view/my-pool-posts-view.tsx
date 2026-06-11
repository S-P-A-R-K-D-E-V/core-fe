'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { usePageTours, type TourDefinition } from 'src/hooks/use-tour';

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
import { useShiftNotificationRefresh } from 'src/hooks/use-shift-notification-refresh';

import PoolCalendar from './pool-calendar';
import LegendDot from './pool-legend';
import { fmtDate, needTypeLabel, partialCoverSubTypeLabel, poolStatusColor, poolStatusLabel, statusHex } from './pool-helpers';

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
  const [tourMenuAnchor, setTourMenuAnchor] = useState<null | HTMLElement>(null);

  // ── Tour definitions ──
  const MY_POSTS_TOURS: TourDefinition[] = useMemo(
    () => [
      {
        tourKey: 'shift-pool-my-posts-overview',
        label: 'Bài đăng & trạng thái',
        steps: [
          {
            element: '#tour-my-posts-content',
            popover: {
              title: '📌 Bài đăng của bạn',
              description:
                'Liệt kê tất cả bài đăng bạn đã tạo, kèm trạng thái hiện tại.\n\n🔵 Đang mở (Open) — Chưa có ai nhận\n🟠 Chờ duyệt — Đã có người nhận, đang chờ bạn hoặc Admin xác nhận\n🟢 Đã duyệt — Hoàn tất\n⚫ Đã huỷ — Bạn đã huỷ bài đăng',
              side: 'top' as const,
              align: 'center' as const,
            },
          },
          {
            element: '#tour-my-posts-legend',
            popover: {
              title: '🎨 Ý nghĩa màu trên lịch',
              description:
                'Màu sắc trên lịch thể hiện trạng thái bài đăng, giúp bạn theo dõi nhanh mà không cần đọc từng dòng.',
              side: 'top' as const,
              align: 'start' as const,
            },
          },
          {
            popover: {
              title: '⚙️ Thao tác với bài đăng',
              description:
                '• Nhấn vào ca trên lịch để xem chi tiết\n• Khi có người nhận (Chờ duyệt): bạn có thể Xác nhận hoặc Từ chối người nhận đó\n• Khi đang Mở: bạn có thể Huỷ bài đăng\n\nLưu ý: Khi từ chối, bài đăng sẽ tự động mở lại để người khác nhận.',
            },
          },
          {
            popover: {
              title: 'Hoàn thành! 🎉',
              description:
                'Bạn đã hiểu cách theo dõi và quản lý bài đăng của mình. Nhấn ❓ bất kỳ lúc nào để xem lại hướng dẫn.',
            },
          },
        ],
      },
    ],
    []
  );

  const { startTour, resetAndRestartAll, completedMap, tours: tourList } = usePageTours({
    tours: MY_POSTS_TOURS,
  });

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

  useShiftNotificationRefresh(fetchData);

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
          <Stack direction="row" spacing={1} alignItems="center">
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
            <Tooltip title="Hướng dẫn sử dụng">
              <IconButton size="small" onClick={(e) => setTourMenuAnchor(e.currentTarget)}>
                <Iconify icon="solar:question-circle-bold" width={22} />
              </IconButton>
            </Tooltip>
          </Stack>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {/* Tour help menu */}
      <Menu
        anchorEl={tourMenuAnchor}
        open={Boolean(tourMenuAnchor)}
        onClose={() => setTourMenuAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        {tourList.map((t) => (
          <MenuItem
            key={t.tourKey}
            onClick={() => {
              setTourMenuAnchor(null);
              startTour(t.tourKey);
            }}
          >
            <ListItemIcon>
              <Iconify
                icon={completedMap[t.tourKey] ? 'solar:check-circle-bold' : 'solar:play-circle-bold'}
                width={20}
                sx={{ color: completedMap[t.tourKey] ? 'success.main' : 'text.secondary' }}
              />
            </ListItemIcon>
            <ListItemText primary={t.label} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            setTourMenuAnchor(null);
            resetAndRestartAll();
          }}
        >
          <ListItemIcon>
            <Iconify icon="solar:restart-bold" width={20} />
          </ListItemIcon>
          <ListItemText primary="Xem lại tất cả" />
        </MenuItem>
      </Menu>

      {loading ? (
        <Card>
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        </Card>
      ) : viewMode === 'calendar' ? (
        <div id="tour-my-posts-content">
          <PoolCalendar
            posts={posts}
            getColor={(p) => statusHex(p.status)}
            getTitle={(p) => `${needTypeLabel(p.needType)} · ${poolStatusLabel(p.status)}`}
            onClickPost={setSelected}
          />
          <Stack id="tour-my-posts-legend" direction="row" spacing={2} sx={{ mt: 1.5, px: 1 }} flexWrap="wrap">
            <LegendDot color={statusHex('Open')} label="Đang mở" />
            <LegendDot color={statusHex('WaitingApproval')} label="Chờ duyệt" />
            <LegendDot color={statusHex('Approved')} label="Đã duyệt" />
            <LegendDot color={statusHex('Cancelled')} label="Đã huỷ" />
          </Stack>
        </div>
      ) : (
        <Card id="tour-my-posts-content">
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
                <>
                  <Typography variant="body2">
                    Khoảng làm hộ: <strong>{selected.partialStartTime} – {selected.partialEndTime}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {partialCoverSubTypeLabel(
                      selected.partialStartTime,
                      selected.partialEndTime,
                      selected.shiftStartTime,
                      selected.shiftEndTime
                    ).label}{' — '}
                    {partialCoverSubTypeLabel(
                      selected.partialStartTime,
                      selected.partialEndTime,
                      selected.shiftStartTime,
                      selected.shiftEndTime
                    ).hint}
                  </Typography>
                </>
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
