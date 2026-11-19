'use client';

import type { IAgentAction, AgentActionStatusFilter } from 'src/api/agent-actions';

import type { ReactNode } from 'react';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { useSearchParams } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { apiErrorMessage, hasApiErrorCode } from 'src/utils/api-error';

import {
  rejectAgentAction,
  useAgentActions,
  approveAgentAction,
  useAgentPendingCount,
  requestAgentActionRevision,
} from 'src/api/agent-actions';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { ADMIN_ROLES, hasAnyRole, getUserRoles } from 'src/auth/roles';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';

import AgentLogsTab from '../agent-logs-tab';
import AgentActionCard from '../agent-action-card';
import AgentAutonomyTab from '../agent-autonomy-tab';
import { focusState } from '../agent-action-utils';
import { AgentRevisionDialog } from '../agent-revision-dialog';
import {
  type DecisionMode,
  AgentResultDialog,
  AgentDecisionDialog,
} from '../agent-decision-dialog';

// ----------------------------------------------------------------------
// Duyệt việc agent (K3): phiếu agent xin làm (Chờ duyệt / Đã xử lý — quyền agent.approve), Mức tự chủ và Nhật ký (quyền
// agent.manage). Thông báo "agent xin làm" của core-be mở thẳng trang này.
// ----------------------------------------------------------------------

type TabValue = 'pending' | 'history' | 'autonomy' | 'logs';

const TABS: { value: TabValue; label: string; icon: string; manage?: boolean }[] = [
  { value: 'pending', label: 'Chờ duyệt', icon: 'solar:hourglass-bold' },
  { value: 'history', label: 'Đã xử lý', icon: 'solar:history-bold' },
  { value: 'autonomy', label: 'Mức tự chủ', icon: 'solar:tuning-2-bold', manage: true },
  { value: 'logs', label: 'Nhật ký', icon: 'solar:document-text-bold', manage: true },
];

const HISTORY_FILTERS: { value: AgentActionStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'executed', label: 'Đã chạy' },
  { value: 'failed', label: 'Lỗi' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'revision_requested', label: 'Yêu cầu sửa' },
  { value: 'expired', label: 'Hết hạn' },
  { value: 'executing', label: 'Đang chạy' },
];

function ListSkeleton() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="rounded" height={200} />
      <Skeleton variant="rounded" height={200} />
    </Stack>
  );
}

// ----------------------------------------------------------------------

/** Khung quanh phiếu được mở từ link `?id=`: cuộn tới một lần + viền nổi bật. */
function FocusFrame({ focused, children }: { focused: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (!focused || scrolled.current) return;
    scrolled.current = true;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focused]);

  if (!focused) return <>{children}</>;
  return (
    <Box
      ref={ref}
      data-testid="agent-action-focused"
      sx={{ borderRadius: 2, outline: (theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: 4 }}
    >
      {children}
    </Box>
  );
}

type PendingTabProps = {
  onCountChange: VoidFunction;
  focusId?: string | null;
  onShowHistory?: VoidFunction;
};

function PendingTab({ onCountChange, focusId, onShowHistory }: PendingTabProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { actions, loading, error, refresh } = useAgentActions('pending');
  const [now, setNow] = useState(() => Date.now());
  const [target, setTarget] = useState<{ action: IAgentAction; mode: DecisionMode } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IAgentAction | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<IAgentAction | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const focus = focusState(actions, focusId, loading || !!error);

  // Cập nhật "còn bao lâu" mỗi 30 giây.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (note: string) => {
    if (!target) return;
    const { action, mode } = target;
    setSubmitting(true);
    try {
      if (mode === 'approve') {
        const done = await approveAgentAction(action.id, note);
        setResult(done);
      } else {
        await rejectAgentAction(action.id, note);
        enqueueSnackbar('Đã từ chối — lệnh không chạy');
      }
      setTarget(null);
    } catch (err: any) {
      const conflict = err?.status === 409;
      enqueueSnackbar(
        apiErrorMessage(
          err,
          conflict
            ? 'Phiếu này đã được người khác xử lý hoặc đã hết hạn'
            : mode === 'approve'
              ? 'Duyệt thất bại'
              : 'Từ chối thất bại'
        ),
        { variant: conflict ? 'warning' : 'error' }
      );
      if (conflict || err?.status === 404) setTarget(null);
    } finally {
      setSubmitting(false);
      refresh();
      onCountChange();
    }
  };

  const openRevision = (action: IAgentAction) => {
    setRevisionError(null);
    setRevisionTarget(action);
  };

  const handleRevisionSubmit = async (data: { note: string; imageUrls: string[] }) => {
    if (!revisionTarget) return;
    setSubmitting(true);
    setRevisionError(null);
    try {
      await requestAgentActionRevision(revisionTarget.id, data);
      enqueueSnackbar('Đã gửi yêu cầu sửa — agent sẽ làm lại và gửi phiếu mới');
      setRevisionTarget(null);
    } catch (err: any) {
      const notPending = err?.status === 404 || hasApiErrorCode(err, 'AgentAction.NotPending');
      const message = apiErrorMessage(
        err,
        notPending
          ? 'Phiếu này đã được người khác xử lý hoặc đã hết hạn'
          : 'Gửi yêu cầu sửa thất bại'
      );
      if (notPending) {
        enqueueSnackbar(message, { variant: 'warning' });
        setRevisionTarget(null);
      } else {
        // Lỗi kiểm tra (thiếu ghi chú, ảnh không thuộc phiếu, hết lượt sửa…) — giữ hộp mở, hiện câu của máy chủ.
        setRevisionError(message);
      }
    } finally {
      setSubmitting(false);
      refresh();
      onCountChange();
    }
  };

  return (
    <>
      {error && (
        <Alert severity="error">{apiErrorMessage(error, 'Không tải được phiếu chờ duyệt')}</Alert>
      )}

      {focus === 'missing' && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            onShowHistory && (
              <Button color="inherit" size="small" onClick={onShowHistory}>
                Xem ở Đã xử lý
              </Button>
            )
          }
        >
          Phiếu bạn mở không còn chờ duyệt — đã có người xử lý hoặc đã hết hạn.
        </Alert>
      )}

      {loading && <ListSkeleton />}

      {!loading && !error && actions.length === 0 && (
        <EmptyContent
          filled
          title="Không có việc nào chờ duyệt"
          description="Khi agent tự chạy xin làm một việc ở mức Chờ duyệt, phiếu sẽ hiện ở đây và người có quyền duyệt nhận thông báo."
          sx={{ py: 10 }}
        />
      )}

      {!loading && actions.length > 0 && (
        <Stack spacing={2}>
          {actions.map((action) => (
            <FocusFrame key={action.id} focused={focus === 'found' && action.id === focusId}>
              <AgentActionCard
                action={action}
                now={now}
                busy={submitting}
                onApprove={(a) => setTarget({ action: a, mode: 'approve' })}
                onReject={(a) => setTarget({ action: a, mode: 'reject' })}
                onRequestRevision={openRevision}
              />
            </FocusFrame>
          ))}
        </Stack>
      )}

      <AgentDecisionDialog
        action={target?.action ?? null}
        mode={target?.mode ?? 'approve'}
        submitting={submitting}
        onClose={() => setTarget(null)}
        onSubmit={handleSubmit}
      />

      <AgentRevisionDialog
        action={revisionTarget}
        submitting={submitting}
        error={revisionError}
        onClose={() => setRevisionTarget(null)}
        onSubmit={handleRevisionSubmit}
      />

      <AgentResultDialog action={result} onClose={() => setResult(null)} />
    </>
  );
}

// ----------------------------------------------------------------------

function HistoryTab({ focusId }: { focusId?: string | null }) {
  const [filter, setFilter] = useState<AgentActionStatusFilter>('all');
  const { actions, loading, error, refresh } = useAgentActions(filter, true, 100);
  // "Tất cả" của máy chủ gồm cả phiếu đang chờ — tab này chỉ hiện phiếu đã xử lý.
  const rows = actions.filter((a) => a.status !== 'pending');

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        {HISTORY_FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            color={filter === f.value ? 'primary' : 'default'}
            variant={filter === f.value ? 'filled' : 'outlined'}
            onClick={() => setFilter(f.value)}
          />
        ))}
        <Button
          size="small"
          color="inherit"
          onClick={() => refresh()}
          startIcon={<Iconify icon="solar:restart-bold" />}
          sx={{ ml: 'auto' }}
        >
          Tải lại
        </Button>
      </Stack>

      {error && <Alert severity="error">{apiErrorMessage(error, 'Không tải được lịch sử')}</Alert>}

      {loading && <ListSkeleton />}

      {!loading && !error && rows.length === 0 && (
        <EmptyContent
          filled
          title="Chưa có phiếu nào"
          description="Phiếu đã duyệt, từ chối hoặc hết hạn sẽ hiện ở đây."
          sx={{ py: 10 }}
        />
      )}

      {!loading && rows.length > 0 && (
        <Stack spacing={2}>
          {rows.map((action) => (
            <FocusFrame key={action.id} focused={!!focusId && action.id === focusId}>
              <AgentActionCard action={action} />
            </FocusFrame>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

// ----------------------------------------------------------------------

export function AgentApprovalsView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const canManage = hasPermission(user, PERMISSIONS.agent.manage);
  // Khoá agent nằm ở Cài đặt cửa hàng — chỉ chủ cửa hàng mở được.
  const isOwner = hasAnyRole(getUserRoles(user), ADMIN_ROLES);
  const tabs = TABS.filter((t) => !t.manage || canManage);

  const searchParams = useSearchParams();
  const urlTab = tabs.find((t) => t.value === searchParams.get('tab'))?.value;
  // Link từ thẻ trong nhóm quản trị / thông báo: /dashboard/agent/approvals?id=<phiếu>.
  const focusId = searchParams.get('id');
  const [tab, setTab] = useState<TabValue>(urlTab ?? 'pending');

  useEffect(() => {
    if (urlTab) setTab(urlTab);
  }, [urlTab]);

  // Mất quyền quản lý giữa chừng (tab không còn) → về Chờ duyệt.
  const current = tabs.some((t) => t.value === tab) ? tab : 'pending';

  const { count, refresh: refreshCount } = useAgentPendingCount(true);
  const onCountChange = useCallback(() => {
    refreshCount();
  }, [refreshCount]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Duyệt việc agent"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Cài đặt' },
          { name: 'Duyệt việc agent' },
        ]}
        action={
          isOwner && (
            <Button
              component={RouterLink}
              href={`${paths.dashboard.storeSettings.root}?tab=agent-keys`}
              color="inherit"
              startIcon={<Iconify icon="solar:key-bold" />}
            >
              Khoá agent
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Tabs
        value={current}
        onChange={(_, v: TabValue) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: { xs: 3, md: 4 } }}
      >
        {tabs.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            icon={
              t.value === 'pending' && count > 0 ? (
                <Label color="warning" variant={current === 'pending' ? 'filled' : 'soft'}>
                  {count}
                </Label>
              ) : (
                <Iconify icon={t.icon} width={22} />
              )
            }
            iconPosition={t.value === 'pending' && count > 0 ? 'end' : 'start'}
          />
        ))}
      </Tabs>

      {current === 'pending' && (
        <PendingTab
          onCountChange={onCountChange}
          focusId={focusId}
          onShowHistory={() => setTab('history')}
        />
      )}
      {current === 'history' && <HistoryTab focusId={focusId} />}
      {current === 'autonomy' && <AgentAutonomyTab />}
      {current === 'logs' && <AgentLogsTab />}
    </Container>
  );
}
