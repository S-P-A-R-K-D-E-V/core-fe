'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid2';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useAuthContext } from 'src/auth/hooks';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';

import type { IShiftAssignment, IShiftPoolPost } from 'src/types/corecms-api';

import { getMySchedule } from 'src/api/attendance';
import {
  cancelShiftPoolPost,
  claimShiftPoolPost,
  getMyShiftPoolClaims,
  getMyShiftPoolPosts,
  getOpenShiftPoolPosts,
  getPendingShiftPoolPosts,
  reviewShiftPoolPost,
} from 'src/api/shiftPool';

import PoolCalendar from './pool-calendar';
import LegendDot from './pool-legend';
import {
  fmtDate,
  needTypeHex,
  needTypeLabel,
  partialCoverSubTypeLabel,
  poolStatusColor,
  poolStatusLabel,
  statusHex,
} from './pool-helpers';

// ── Types ──────────────────────────────────────────────────────────────────

type TabKey = 'browse' | 'my-posts' | 'my-claims' | 'pending';
type NeedTypeFilter = '' | 'Swap' | 'FullCover' | 'PartialCover';
type StatusFilter = '' | 'Open' | 'WaitingApproval' | 'Approved' | 'Cancelled';

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

// ── Post Card ─────────────────────────────────────────────────────────────

interface PostCardProps {
  post: IShiftPoolPost;
  tab: TabKey;
  onAction: (p: IShiftPoolPost) => void;
}

function PostCard({ post, tab, onAction }: PostCardProps) {
  const timeRange =
    post.needType === 'PartialCover' && post.partialStartTime
      ? `${post.partialStartTime.slice(0, 5)} – ${post.partialEndTime?.slice(0, 5)}`
      : `${post.shiftStartTime?.slice(0, 5)} – ${post.shiftEndTime?.slice(0, 5)}`;

  const canCancel =
    tab === 'my-posts' &&
    (post.status === 'Open' || post.status === 'WaitingApproval');

  const actionLabel =
    tab === 'browse' ? 'Nhận ca' :
    canCancel ? 'Xem & huỷ' :
    tab === 'my-posts' ? 'Xem chi tiết' :
    tab === 'pending' ? 'Duyệt' :
    'Xem chi tiết';

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: (t) => `1px solid ${t.palette.divider}`,
        transition: 'transform 0.15s, box-shadow 0.15s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (t) => t.shadows[4],
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Stack spacing={1.5}>
          {/* Badges */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={0.5} flexWrap="wrap">
            <Label
              sx={{
                bgcolor: `${needTypeHex(post.needType)}1a`,
                color: needTypeHex(post.needType),
                fontWeight: 600,
              }}
            >
              {needTypeLabel(post.needType)}
            </Label>
            {tab !== 'browse' && (
              <Label color={poolStatusColor(post.status)} variant="soft">
                {poolStatusLabel(post.status)}
              </Label>
            )}
          </Stack>

          {/* Shift info */}
          <Box>
            <Typography variant="subtitle2" noWrap title={post.shiftName}>
              {post.shiftName}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
              <Iconify icon="solar:calendar-bold" width={13} sx={{ color: 'text.disabled', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary">
                {fmtDate(post.shiftDate)}
              </Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Iconify icon="solar:clock-circle-bold" width={13} sx={{ color: 'text.disabled', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary">
                {timeRange}
              </Typography>
            </Stack>
          </Box>

          <Divider />

          {/* People */}
          {tab === 'browse' && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Iconify icon="solar:user-bold" width={14} sx={{ color: 'text.disabled' }} />
              <Typography variant="caption" noWrap>{post.posterName}</Typography>
            </Stack>
          )}
          {tab === 'my-posts' && post.claimerName && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Iconify icon="solar:user-check-bold" width={14} sx={{ color: 'warning.main' }} />
              <Typography variant="caption" noWrap>Người nhận: {post.claimerName}</Typography>
            </Stack>
          )}
          {tab === 'my-claims' && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Iconify icon="solar:user-bold" width={14} sx={{ color: 'text.disabled' }} />
              <Typography variant="caption" noWrap>Người đăng: {post.posterName}</Typography>
            </Stack>
          )}
          {tab === 'pending' && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Iconify icon="solar:users-group-two-rounded-bold" width={14} sx={{ color: 'text.disabled' }} />
              <Typography variant="caption" noWrap>
                {post.posterName} → {post.claimerName}
              </Typography>
            </Stack>
          )}

          {/* Note */}
          {post.note && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {post.note}
            </Typography>
          )}

          {/* Extra pay badge */}
          {post.needType === 'PartialCover' && post.extraPayAmount != null && (
            <Chip
              size="small"
              icon={<Iconify icon="solar:money-bag-bold" width={13} />}
              label={`Phụ cấp: ${post.extraPayAmount.toLocaleString('vi-VN')}đ`}
              color="warning"
              variant="outlined"
              sx={{ alignSelf: 'flex-start', fontSize: 11, height: 22 }}
            />
          )}

          {/* Rejected note */}
          {post.lastClaimRejectedNote && tab === 'my-posts' && (
            <Alert severity="info" sx={{ py: 0.25, fontSize: 11 }}>
              Từ chối lần trước: {post.lastClaimRejectedNote}
            </Alert>
          )}
        </Stack>
      </CardContent>

      <CardActions sx={{ px: 1.5, pb: 1.5, pt: 0 }}>
        <Button size="small" variant="contained" fullWidth onClick={() => onAction(post)}>
          {actionLabel}
        </Button>
      </CardActions>
    </Card>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: TabKey }) {
  const messages: Record<TabKey, { icon: string; text: string }> = {
    browse: { icon: 'solar:shop-bold-duotone', text: 'Chưa có bài đăng nào đang mở' },
    'my-posts': { icon: 'solar:document-add-bold-duotone', text: 'Bạn chưa đăng ca nào' },
    'my-claims': { icon: 'solar:hand-check-bold-duotone', text: 'Bạn chưa nhận ca nào' },
    pending: { icon: 'solar:checklist-minimalistic-bold-duotone', text: 'Không có yêu cầu chờ duyệt' },
  };
  const { icon, text } = messages[tab];
  return (
    <Card>
      <Stack alignItems="center" justifyContent="center" sx={{ py: 12 }} spacing={1}>
        <Iconify icon={icon} width={56} sx={{ color: 'text.disabled' }} />
        <Typography variant="body2" color="text.secondary">{text}</Typography>
      </Stack>
    </Card>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────

export default function ShiftPoolUnifiedView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const isManager = user?.role === 'Admin' || user?.role === 'Manager';

  const [tab, setTab] = useState<TabKey>('browse');
  const [viewMode, setViewMode] = useState<'calendar' | 'grid'>('calendar');
  const [needTypeFilter, setNeedTypeFilter] = useState<NeedTypeFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [loading, setLoading] = useState(false);

  // Per-tab data cache
  const [browsePosts, setBrowsePosts] = useState<IShiftPoolPost[]>([]);
  const [myPosts, setMyPosts] = useState<IShiftPoolPost[]>([]);
  const [myClaims, setMyClaims] = useState<IShiftPoolPost[]>([]);
  const [pendingPosts, setPendingPosts] = useState<IShiftPoolPost[]>([]);

  // Dialog state
  const [claimTarget, setClaimTarget] = useState<IShiftPoolPost | null>(null);
  const [detailTarget, setDetailTarget] = useState<IShiftPoolPost | null>(null);
  const [reviewTarget, setReviewTarget] = useState<IShiftPoolPost | null>(null);

  // Claim dialog helpers
  const [myAssignments, setMyAssignments] = useState<IShiftAssignment[]>([]);
  const [offeredId, setOfferedId] = useState('');
  const [loadingMine, setLoadingMine] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Review dialog
  const [reviewNote, setReviewNote] = useState('');

  // ── Data loading ────────────────────────────────────────────────────────

  const loadTab = useCallback(async (t: TabKey) => {
    setLoading(true);
    try {
      switch (t) {
        case 'browse': setBrowsePosts(await getOpenShiftPoolPosts()); break;
        case 'my-posts': setMyPosts(await getMyShiftPoolPosts()); break;
        case 'my-claims': setMyClaims(await getMyShiftPoolClaims()); break;
        case 'pending': setPendingPosts(await getPendingShiftPoolPosts()); break;
        default: break;
      }
    } catch {
      enqueueSnackbar('Không thể tải dữ liệu', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  // Load my upcoming assignments when Swap claim dialog opens
  useEffect(() => {
    if (!claimTarget || claimTarget.needType !== 'Swap') return;
    setLoadingMine(true);
    setOfferedId('');
    const from = toDateStr(new Date());
    const to = toDateStr(new Date(Date.now() + 60 * 24 * 3_600_000));
    getMySchedule(from, to)
      .then((all) => {
        const now = Date.now();
        setMyAssignments(all.filter((a) => {
          const dateStr = (a.date ?? '').split('T')[0];
          const start = a.startTime || (a as any).shiftStartTime || '00:00';
          return (
            new Date(`${dateStr}T${start}`).getTime() > now &&
            (a.id || (a as any).assignmentId) !== claimTarget.shiftAssignmentId
          );
        }));
      })
      .catch(() => setMyAssignments([]))
      .finally(() => setLoadingMine(false));
  }, [claimTarget]);

  // ── Filtered posts ───────────────────────────────────────────────────────

  const rawPosts: IShiftPoolPost[] = {
    browse: browsePosts,
    'my-posts': myPosts,
    'my-claims': myClaims,
    pending: pendingPosts,
  }[tab];

  const filteredPosts = useMemo(
    () =>
      rawPosts.filter(
        (p) =>
          (!needTypeFilter || p.needType === needTypeFilter) &&
          (!statusFilter || p.status === statusFilter)
      ),
    [rawPosts, needTypeFilter, statusFilter]
  );

  // ── Calendar helpers ─────────────────────────────────────────────────────

  const getColor = useCallback(
    (p: IShiftPoolPost) => (tab === 'browse' ? needTypeHex(p.needType) : statusHex(p.status)),
    [tab]
  );

  const getTitle = useCallback(
    (p: IShiftPoolPost): string => {
      if (tab === 'browse') return `${needTypeLabel(p.needType)} · ${p.posterName}`;
      if (tab === 'my-posts') return `${needTypeLabel(p.needType)} · ${poolStatusLabel(p.status)}`;
      if (tab === 'my-claims') return `${needTypeLabel(p.needType)} · ${p.posterName}`;
      return `${p.posterName}→${p.claimerName ?? ''}`;
    },
    [tab]
  );

  // ── Action handlers ──────────────────────────────────────────────────────

  const handleClickPost = useCallback((p: IShiftPoolPost) => {
    if (tab === 'browse') {
      setClaimTarget(p);
      setMyAssignments([]);
      setOfferedId('');
    } else if (tab === 'pending') {
      setReviewTarget(p);
      setReviewNote('');
    } else {
      setDetailTarget(p);
    }
  }, [tab]);

  const handleClaim = async () => {
    if (!claimTarget || (claimTarget.needType === 'Swap' && !offeredId)) return;
    setSubmitting(true);
    try {
      await claimShiftPoolPost(claimTarget.id, {
        offeredAssignmentId: claimTarget.needType === 'Swap' ? offeredId : undefined,
      });
      enqueueSnackbar('Đã nhận ca! Chờ xác nhận.', { variant: 'success' });
      setClaimTarget(null);
      loadTab('browse');
    } catch (e: any) {
      enqueueSnackbar(e?.title || e?.message || 'Nhận ca thất bại!', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!detailTarget) return;
    setSubmitting(true);
    try {
      await cancelShiftPoolPost(detailTarget.id);
      enqueueSnackbar('Đã huỷ bài đăng.', { variant: 'success' });
      setDetailTarget(null);
      loadTab('my-posts');
    } catch (e: any) {
      enqueueSnackbar(e?.title || e?.message || 'Huỷ thất bại!', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (approve: boolean) => {
    if (!reviewTarget) return;
    setSubmitting(true);
    try {
      await reviewShiftPoolPost(reviewTarget.id, {
        action: approve ? 'Approve' : 'RejectClaim',
        reviewNote: reviewNote || undefined,
      });
      enqueueSnackbar(approve ? 'Đã duyệt!' : 'Đã từ chối.', { variant: 'success' });
      setReviewTarget(null);
      loadTab('pending');
    } catch (e: any) {
      enqueueSnackbar(e?.title || e?.message || 'Thao tác thất bại!', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Legends ──────────────────────────────────────────────────────────────

  const legend =
    tab === 'browse' ? (
      <Stack direction="row" spacing={2} sx={{ mt: 1.5, px: 1 }} flexWrap="wrap">
        <LegendDot color={needTypeHex('Swap')} label="Đổi ca" />
        <LegendDot color={needTypeHex('FullCover')} label="Làm hộ cả ca" />
        <LegendDot color={needTypeHex('PartialCover')} label="Làm hộ 1 phần" />
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
          · Click vào ca để nhận
        </Typography>
      </Stack>
    ) : (
      <Stack direction="row" spacing={2} sx={{ mt: 1.5, px: 1 }} flexWrap="wrap">
        <LegendDot color={statusHex('Open')} label="Đang mở" />
        <LegendDot color={statusHex('WaitingApproval')} label="Chờ duyệt" />
        <LegendDot color={statusHex('Approved')} label="Đã duyệt" />
        <LegendDot color={statusHex('Cancelled')} label="Đã huỷ" />
        {tab === 'pending' && (
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
            · Click vào ca để duyệt
          </Typography>
        )}
      </Stack>
    );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      {/* Header */}
      <CustomBreadcrumbs
        heading="Đổi ca & Làm hộ"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đổi ca & Làm hộ' },
        ]}
        action={
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
          >
            <Tooltip title="Dạng lịch">
              <ToggleButton value="calendar">
                <Iconify icon="eva:calendar-fill" width={18} />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Dạng lưới">
              <ToggleButton value="grid">
                <Iconify icon="solar:widget-2-bold-duotone" width={18} />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        }
        sx={{ mb: 3 }}
      />

      {/* Tab bar + Filter bar */}
      <Card sx={{ mb: 2.5 }}>
        <Tabs
          value={tab}
          onChange={(_, v: TabKey) => {
            setTab(v);
            setNeedTypeFilter('');
            setStatusFilter('');
          }}
          sx={{ px: 2.5, borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            value="browse"
            label="Chợ ca"
            icon={<Iconify icon="solar:shop-bold-duotone" width={18} />}
            iconPosition="start"
          />
          <Tab
            value="my-posts"
            label="Bài đăng của tôi"
            icon={<Iconify icon="solar:document-add-bold-duotone" width={18} />}
            iconPosition="start"
          />
          <Tab
            value="my-claims"
            label="Ca tôi nhận"
            icon={<Iconify icon="solar:hand-check-bold-duotone" width={18} />}
            iconPosition="start"
          />
          {isManager && (
            <Tab
              value="pending"
              label="Duyệt"
              icon={<Iconify icon="solar:checklist-minimalistic-bold-duotone" width={18} />}
              iconPosition="start"
            />
          )}
        </Tabs>

        {/* Filters */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ px: 2.5, py: 1.5 }}
          flexWrap="wrap"
        >
          <TextField
            select
            size="small"
            label="Loại nhu cầu"
            value={needTypeFilter}
            onChange={(e) => setNeedTypeFilter(e.target.value as NeedTypeFilter)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Tất cả loại</MenuItem>
            <MenuItem value="Swap">Đổi ca</MenuItem>
            <MenuItem value="FullCover">Làm hộ cả ca</MenuItem>
            <MenuItem value="PartialCover">Làm hộ 1 phần</MenuItem>
          </TextField>

          {tab !== 'browse' && tab !== 'pending' && (
            <TextField
              select
              size="small"
              label="Trạng thái"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">Tất cả trạng thái</MenuItem>
              <MenuItem value="Open">Đang mở</MenuItem>
              <MenuItem value="WaitingApproval">Chờ duyệt</MenuItem>
              <MenuItem value="Approved">Đã duyệt</MenuItem>
              <MenuItem value="Cancelled">Đã huỷ</MenuItem>
            </TextField>
          )}

          {/* Results count */}
          {!loading && (
            <Typography variant="caption" color="text.secondary">
              {filteredPosts.length} kết quả
            </Typography>
          )}

          <Box sx={{ flexGrow: 1 }} />

          <Button
            size="small"
            startIcon={<Iconify icon="solar:refresh-bold" width={16} />}
            onClick={() => loadTab(tab)}
            disabled={loading}
          >
            Làm mới
          </Button>
        </Stack>
      </Card>

      {/* Content */}
      {loading ? (
        <Card>
          <Stack alignItems="center" justifyContent="center" sx={{ py: 12 }}>
            <CircularProgress />
          </Stack>
        </Card>
      ) : filteredPosts.length === 0 ? (
        <EmptyState tab={tab} />
      ) : viewMode === 'calendar' ? (
        <>
          <PoolCalendar
            posts={filteredPosts}
            getColor={getColor}
            getTitle={getTitle}
            onClickPost={handleClickPost}
          />
          {legend}
        </>
      ) : (
        // Grid view
        <>
          <Grid container spacing={2}>
            {filteredPosts.map((post) => (
              <Grid key={post.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <PostCard post={post} tab={tab} onAction={handleClickPost} />
              </Grid>
            ))}
          </Grid>
          {legend}
        </>
      )}

      {/* ── Claim Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!claimTarget} onClose={() => !submitting && setClaimTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Nhận ca</DialogTitle>
        <DialogContent>
          {claimTarget && (
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {needTypeLabel(claimTarget.needType)} · {claimTarget.posterName}
                </Typography>
                <Typography variant="subtitle2">
                  {claimTarget.shiftName} · {fmtDate(claimTarget.shiftDate)} ·{' '}
                  {claimTarget.needType === 'PartialCover' && claimTarget.partialStartTime
                    ? `${claimTarget.partialStartTime} – ${claimTarget.partialEndTime}`
                    : `${claimTarget.shiftStartTime} – ${claimTarget.shiftEndTime}`}
                </Typography>
              </Box>

              {claimTarget.needType === 'Swap' ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Đổi ca 2 chiều — chọn 1 ca sắp tới của bạn để đổi lại:
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
                        ? 'Không có ca sắp tới để đổi'
                        : 'Bắt buộc chọn ca để đổi'
                    }
                  >
                    {myAssignments.map((a) => {
                      const id = a.id || (a as any).assignmentId;
                      const name = (a as any).scheduleName || (a as any).shiftName || 'Ca làm việc';
                      const d = (a.date ?? '').split('T')[0]
                        ? new Date((a.date ?? '').split('T')[0]).toLocaleDateString('vi-VN')
                        : '';
                      return (
                        <MenuItem key={id} value={id}>
                          {`${d} · ${name} (${a.startTime?.slice(0, 5)} – ${a.endTime?.slice(0, 5)})`}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                </>
              ) : claimTarget.needType === 'PartialCover' ? (
                (() => {
                  const sub = partialCoverSubTypeLabel(
                    claimTarget.partialStartTime,
                    claimTarget.partialEndTime,
                    claimTarget.shiftStartTime,
                    claimTarget.shiftEndTime
                  );
                  return (
                    <Stack spacing={1}>
                      <Typography variant="body2" fontWeight={600}>{sub.label}</Typography>
                      <Typography variant="body2" color="text.secondary">{sub.hint}</Typography>
                    </Stack>
                  );
                })()
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Bạn sẽ làm hộ toàn bộ ca này. Người đăng sẽ xác nhận sau khi bạn nhận.
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setClaimTarget(null)} disabled={submitting}>
            Huỷ
          </Button>
          <Button
            variant="contained"
            onClick={handleClaim}
            disabled={submitting || (claimTarget?.needType === 'Swap' && !offeredId)}
          >
            {submitting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            Xác nhận nhận
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Detail / Cancel Dialog ───────────────────────────────────────── */}
      <Dialog open={!!detailTarget} onClose={() => !submitting && setDetailTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Chi tiết bài đăng</DialogTitle>
        <DialogContent>
          {detailTarget && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Label
                  sx={{ bgcolor: `${needTypeHex(detailTarget.needType)}1a`, color: needTypeHex(detailTarget.needType) }}
                >
                  {needTypeLabel(detailTarget.needType)}
                </Label>
                <Label color={poolStatusColor(detailTarget.status)} variant="soft">
                  {poolStatusLabel(detailTarget.status)}
                </Label>
              </Stack>

              <Box>
                <Typography variant="subtitle2">{detailTarget.shiftName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {fmtDate(detailTarget.shiftDate)} ·{' '}
                  {detailTarget.needType === 'PartialCover' && detailTarget.partialStartTime
                    ? `${detailTarget.partialStartTime} – ${detailTarget.partialEndTime}`
                    : `${detailTarget.shiftStartTime} – ${detailTarget.shiftEndTime}`}
                </Typography>
              </Box>

              {tab === 'my-posts' && detailTarget.claimerName && (
                <Typography variant="body2">
                  Người nhận: <strong>{detailTarget.claimerName}</strong>
                </Typography>
              )}
              {tab === 'my-claims' && (
                <Typography variant="body2">
                  Người đăng: <strong>{detailTarget.posterName}</strong>
                </Typography>
              )}

              {detailTarget.needType === 'Swap' && detailTarget.claimerOfferedShiftName && (
                <Typography variant="body2">
                  Ca đổi lại: {detailTarget.claimerOfferedShiftName}{' '}
                  ({fmtDate(detailTarget.claimerOfferedShiftDate)})
                </Typography>
              )}

              {detailTarget.note && (
                <Typography variant="body2" color="text.secondary">
                  Ghi chú: {detailTarget.note}
                </Typography>
              )}

              {detailTarget.needType === 'PartialCover' && detailTarget.extraPayAmount != null && (
                <Chip
                  size="small"
                  label={`Phụ cấp ước tính: ${detailTarget.extraPayAmount.toLocaleString('vi-VN')}đ`}
                  color="warning"
                  variant="outlined"
                />
              )}

              {detailTarget.lastClaimRejectedNote && (
                <Alert severity="info">
                  Từ chối lần trước: {detailTarget.lastClaimRejectedNote}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDetailTarget(null)} disabled={submitting}>
            Đóng
          </Button>
          {tab === 'my-posts' &&
            (detailTarget?.status === 'Open' || detailTarget?.status === 'WaitingApproval') && (
              <Button
                color="error"
                variant="outlined"
                onClick={handleCancel}
                disabled={submitting}
              >
                {submitting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Huỷ bài đăng
              </Button>
            )}
        </DialogActions>
      </Dialog>

      {/* ── Review Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!reviewTarget} onClose={() => !submitting && setReviewTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Duyệt yêu cầu</DialogTitle>
        <DialogContent>
          {reviewTarget && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="subtitle2">
                  {needTypeLabel(reviewTarget.needType)} · {reviewTarget.shiftName} ·{' '}
                  {fmtDate(reviewTarget.shiftDate)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {reviewTarget.posterName} → {reviewTarget.claimerName}
                </Typography>
              </Box>

              {reviewTarget.needType === 'Swap' && reviewTarget.claimerOfferedShiftName && (
                <Typography variant="body2">
                  Ca đổi lại: {reviewTarget.claimerOfferedShiftName}{' '}
                  ({fmtDate(reviewTarget.claimerOfferedShiftDate)})
                </Typography>
              )}

              {reviewTarget.needType === 'PartialCover' && reviewTarget.partialStartTime && (
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    Khoảng làm hộ:{' '}
                    <strong>{reviewTarget.partialStartTime} – {reviewTarget.partialEndTime}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {partialCoverSubTypeLabel(
                      reviewTarget.partialStartTime,
                      reviewTarget.partialEndTime,
                      reviewTarget.shiftStartTime,
                      reviewTarget.shiftEndTime
                    ).hint}
                  </Typography>
                  {reviewTarget.extraPayAmount != null && (
                    <Chip
                      size="small"
                      label={`Phụ cấp: ${reviewTarget.extraPayAmount.toLocaleString('vi-VN')}đ`}
                      color="warning"
                      variant="outlined"
                      sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                    />
                  )}
                </Stack>
              )}

              <Stack direction="row" spacing={1} flexWrap="wrap">
                {reviewTarget.needType === 'Swap' && (
                  <Chip size="small" label="Hoán đổi 2 ca" color="info" />
                )}
                {reviewTarget.needType === 'FullCover' && (
                  <Chip size="small" label="Chuyển cả ca sang người nhận" color="info" />
                )}
                {reviewTarget.needType === 'PartialCover' && (
                  <Chip size="small" label="Tính phụ cấp làm hộ theo giờ" color="warning" />
                )}
              </Stack>

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Ghi chú (tuỳ chọn)"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setReviewTarget(null)} disabled={submitting}>
            Đóng
          </Button>
          <Button
            color="error"
            variant="outlined"
            onClick={() => handleReview(false)}
            disabled={submitting}
          >
            Từ chối
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleReview(true)}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            Duyệt
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
