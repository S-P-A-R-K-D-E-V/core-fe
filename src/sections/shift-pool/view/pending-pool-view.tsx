'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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
import TextField from '@mui/material/TextField';
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

import { getPendingShiftPoolPosts, reviewShiftPoolPost } from 'src/api/shiftPool';
import { useShiftNotificationRefresh } from 'src/hooks/use-shift-notification-refresh';

import PoolCalendar from './pool-calendar';
import LegendDot from './pool-legend';
import { fmtDate, needTypeHex, needTypeLabel, partialCoverSubTypeLabel, partialSideLabel } from './pool-helpers';

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
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

  const [target, setTarget] = useState<IShiftPoolPost | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tourMenuAnchor, setTourMenuAnchor] = useState<null | HTMLElement>(null);

  // ── Tour definitions ──
  const PENDING_TOURS: TourDefinition[] = useMemo(
    () => [
      {
        tourKey: 'shift-pool-pending-overview',
        label: 'Tổng quan hàng chờ duyệt',
        steps: [
          {
            element: '#tour-pending-content',
            popover: {
              title: '⏳ Danh sách chờ duyệt',
              description:
                'Hiển thị tất cả yêu cầu đổi ca / làm hộ đang ở trạng thái "Chờ duyệt" — tức là đã có người nhận và đang chờ Admin/Manager phê duyệt.\n\n🔵 Xanh = Đổi ca\n🟣 Tím = Làm hộ cả ca\n🟠 Cam = Làm hộ 1 phần',
              side: 'top' as const,
              align: 'center' as const,
            },
          },
          {
            element: '#tour-pending-legend',
            popover: {
              title: '🎨 Màu sắc theo loại yêu cầu',
              description:
                'Màu thể hiện loại nhu cầu của bài đăng, giúp bạn nhận biết nhanh mà không cần đọc từng chi tiết.',
              side: 'top' as const,
              align: 'start' as const,
            },
          },
          {
            popover: {
              title: 'Hoàn thành! 🎉',
              description:
                'Tiếp theo, hãy xem hướng dẫn "Quy trình duyệt" để biết các bước phê duyệt và hệ quả với từng loại.',
            },
          },
        ],
      },
      {
        tourKey: 'shift-pool-pending-review',
        label: 'Quy trình duyệt',
        steps: [
          {
            element: '#tour-pending-review-btn',
            popover: {
              title: '👆 Mở hộp thoại duyệt',
              description:
                'Nhấn vào ca trên lịch (hoặc nút "Xem & duyệt" trong bảng) để mở dialog chi tiết yêu cầu.',
              side: 'left' as const,
              align: 'center' as const,
            },
          },
          {
            popover: {
              title: '✅ Duyệt — Hệ quả theo loại',
              description:
                '• Đổi ca (Swap): hoán đổi StaffId giữa 2 ca — mỗi người sẽ làm ca của người kia\n• Làm hộ cả ca (FullCover): ca chuyển hoàn toàn sang người nhận\n• Làm hộ 1 phần (PartialCover): người nhận được cộng phụ cấp giờ vào bảng lương\n\nCả 2 bên đều nhận thông báo khi được duyệt.',
            },
          },
          {
            popover: {
              title: '❌ Từ chối — Bài đăng mở lại',
              description:
                'Khi từ chối, bài đăng sẽ tự động chuyển về trạng thái Mở (Open) và người khác có thể nhận lại.\n\nBạn có thể điền ghi chú để thông báo lý do từ chối cho cả người đăng và người nhận.',
            },
          },
          {
            popover: {
              title: '🔒 Ca bị khoá (IsDirected)',
              description:
                'Nếu bạn dùng chức năng "Chỉ định trực tiếp" (Directed Resolve), các ca liên quan sẽ bị khoá — staff không thể tái đăng lên pool.\n\nChỉ nên dùng khi cần can thiệp khẩn cấp mà không thể chờ quy trình pool thông thường.',
            },
          },
          {
            popover: {
              title: 'Hoàn thành! 🎉',
              description:
                'Bạn đã nắm đầy đủ quy trình duyệt đổi ca & làm hộ. Nhấn ❓ bất kỳ lúc nào để xem lại.',
            },
          },
        ],
      },
    ],
    []
  );

  const { startTour, resetAndRestartAll, completedMap, tours: tourList } = usePageTours({
    tours: PENDING_TOURS,
  });

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

  useShiftNotificationRefresh(fetchData);

  const openReview = (post: IShiftPoolPost) => {
    setTarget(post);
    setNote('');
  };

  const handleReview = async (approve: boolean) => {
    if (!target) return;
    setSubmitting(true);
    try {
      await reviewShiftPoolPost(target.id, {
        action: approve ? 'Approve' : 'RejectClaim',
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
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
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
        <div id="tour-pending-content">
          <PoolCalendar
            posts={posts}
            getColor={(p) => needTypeHex(p.needType)}
            getTitle={(p) => `${needTypeLabel(p.needType)} · ${p.posterName}→${p.claimerName ?? ''}`}
            onClickPost={openReview}
          />
          <Stack id="tour-pending-legend" direction="row" spacing={2} sx={{ mt: 1.5, px: 1 }} flexWrap="wrap">
            <LegendDot color={needTypeHex('Swap')} label="Đổi ca" />
            <LegendDot color={needTypeHex('FullCover')} label="Làm hộ cả ca" />
            <LegendDot color={needTypeHex('PartialCover')} label="Làm hộ 1 phần" />
            <Typography variant="caption" color="text.secondary">
              · Click vào ca để duyệt
            </Typography>
          </Stack>
        </div>
      ) : (
        <Card id="tour-pending-content">
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
                          {row.needType === 'PartialCover' && row.partialSide
                            ? partialSideLabel(row.partialSide)
                            : row.needType === 'PartialCover' && row.partialStartTime
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
                        <Button id="tour-pending-review-btn" size="small" variant="contained" onClick={() => openReview(row)}>
                          Xem & duyệt
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

      {/* Review dialog */}
      <Dialog open={!!target} onClose={() => setTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Duyệt yêu cầu</DialogTitle>
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

              {target.needType === 'Swap' && target.claimerOfferedShiftName && (
                <Typography variant="body2">
                  Ca đổi lại: {target.claimerOfferedShiftName} ({fmtDate(target.claimerOfferedShiftDate)})
                </Typography>
              )}
              {target.needType === 'PartialCover' && target.partialSide && (
                <>
                  <Typography variant="body2">
                    Loại làm hộ: <strong>{partialSideLabel(target.partialSide)}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {target.partialSide === 'LateArrive'
                      ? 'Người làm hộ ở ca liền trước. Phụ cấp = giờ từ đầu ca đến lúc người nhờ check-in, tính tại kỳ lương.'
                      : 'Người làm hộ ở ca liền sau. Phụ cấp = giờ từ lúc người nhờ check-out đến hết ca, tính tại kỳ lương.'}
                  </Typography>
                  {target.actualCoverStart && target.actualCoverEnd && (
                    <Typography variant="caption" color="text.secondary">
                      Khoảng đã làm hộ (chấm công): {target.actualCoverStart} → {target.actualCoverEnd}
                    </Typography>
                  )}
                </>
              )}
              {target.needType === 'PartialCover' && !target.partialSide && target.partialStartTime && (
                <Typography variant="body2">
                  Khoảng làm hộ: <strong>{target.partialStartTime} – {target.partialEndTime}</strong>
                </Typography>
              )}

              <Stack direction="row" spacing={1} flexWrap="wrap">
                {target.needType === 'Swap' && <Chip size="small" label="Hoán đổi 2 ca" color="info" />}
                {target.needType === 'FullCover' && (
                  <Chip size="small" label="Chuyển cả ca sang người nhận" color="info" />
                )}
                {target.needType === 'PartialCover' && (
                  <Chip size="small" label="Tính phụ cấp làm hộ theo giờ" color="warning" />
                )}
              </Stack>

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
          <Button color="error" onClick={() => handleReview(false)} disabled={submitting}>
            Từ chối
          </Button>
          <Button variant="contained" color="success" onClick={() => handleReview(true)} disabled={submitting}>
            Duyệt
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
