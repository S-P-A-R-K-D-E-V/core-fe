'use client';

import type { IWorkTask } from 'src/types/hr';
import type { IAgentTask, IAgentTaskDetail, IAgentCenterSummary } from 'src/api/agent-center';
import { useWorkHubItems, type IWorkHubItem } from 'src/api/work-hub';
import { getWorkTask, cancelWorkTask } from 'src/api/hr';

import { useSWRConfig } from 'swr';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, usePathname, useSearchParams } from 'src/routes/hooks';

import { apiErrorMessage } from 'src/utils/api-error';

import {
  isAgentTask,
  agentTasksKey,
  retryAgentTask,
  stopAgentTask,
  useAgentTasks,
  cancelAgentTask,
  agentSummaryKey,
  agentTaskDetailKey,
  useAgentDefinitions,
  useAgentAdminGroup,
  setAgentCenterPaused,
  createAgentAdminGroup,
  useAgentCenterSummary,
} from 'src/api/agent-center';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';

import AgentBoard from '../agent-board';
import CleaningReviewDialog from 'src/sections/cleaning/cleaning-review-dialog';
import { ReviewTaskDialog } from 'src/sections/cleaning/assigned-tasks';
import AgentTaskList from '../agent-task-list';
import AgentTaskCalendar from '../agent-task-calendar';
import AgentTaskToolbar, {
  type TaskView,
  TASK_VIEWS,
  type TaskFilterState,
} from '../agent-task-toolbar';
import AgentListTab from '../agent-list-tab';
import AgentUsageTab from '../agent-usage-tab';
import AgentTaskDrawer from '../agent-task-drawer';
import AgentScheduleTab from '../agent-schedule-tab';
import AgentAssignDialog from '../agent-assign-dialog';
import {
  hubEntry,
  upsertTask,
  agentEntry,
  filterTasks,
  filterHubItems,
} from '../agent-center-utils';
import { useAgentBoardHub } from '../hooks/use-agent-board-hub';

// ----------------------------------------------------------------------
// Trung tâm Agent (K4b). Quyền agent.approve: bảng việc, chi tiết việc, giao việc, nhắn, dừng / chạy lại / huỷ, xem lịch và
// agent. agent.manage: thêm / sửa agent + lịch, "Dừng tất cả agent", tab Chi phí. URL: ?tab=board|schedule|agents|usage,
// ?task={id} mở chi tiết việc (thông báo "việc chờ người / lỗi" của core-be mở thẳng đường này).
// Cập nhật trực tiếp qua hub /hubs/agent-board ghi thẳng vào cache SWR; hub mất kết nối → hỏi lại mỗi 30 giây.
// ----------------------------------------------------------------------

type TabValue = 'board' | 'schedule' | 'agents' | 'usage';

const TABS: { value: TabValue; label: string; icon: string; manage?: boolean }[] = [
  { value: 'board', label: 'Bảng việc', icon: 'solar:widget-4-bold' },
  { value: 'schedule', label: 'Lịch chạy', icon: 'solar:calendar-bold' },
  { value: 'agents', label: 'Agent', icon: 'solar:cpu-bolt-bold' },
  { value: 'usage', label: 'Chi phí', icon: 'solar:chart-2-bold', manage: true },
];

type Confirm =
  | { kind: 'stop'; task: IAgentTask }
  | { kind: 'cancel'; task: IAgentTask }
  | { kind: 'pause'; paused: boolean };

function isSummary(value: unknown): value is IAgentCenterSummary {
  return !!value && typeof value === 'object' && 'paused' in value && 'counts' in value;
}

export function AgentCenterView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const canManage = hasPermission(user, PERMISSIONS.agent.manage);
  const tabs = TABS.filter((t) => !t.manage || canManage);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: TabValue = tabs.find((t) => t.value === searchParams.get('tab'))?.value ?? 'board';
  const openTaskId = searchParams.get('task') || null;
  const taskView: TaskView =
    TASK_VIEWS.find((v) => v.value === searchParams.get('view'))?.value ?? 'kanban';

  const setQuery = useCallback(
    (patch: { tab?: TabValue; task?: string | null; view?: TaskView }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (patch.view !== undefined) {
        if (patch.view === 'kanban') params.delete('view');
        else params.set('view', patch.view);
      }
      if (patch.tab !== undefined) {
        if (patch.tab === 'board') params.delete('tab');
        else params.set('tab', patch.tab);
      }
      if (patch.task !== undefined) {
        if (patch.task) params.set('task', patch.task);
        else params.delete('task');
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const { enqueueSnackbar } = useSnackbar();
  const { mutate } = useSWRConfig();

  // --- Cập nhật trực tiếp -----------------------------------------------------------------
  const upsertCachedTask = useCallback(
    (task: IAgentTask) => {
      mutate<IAgentTask[]>(agentTasksKey, (list) => upsertTask(list, task), { revalidate: false });
      mutate<IAgentTaskDetail>(
        agentTaskDetailKey(task.id),
        (detail) => (detail ? { ...detail, task } : detail),
        { revalidate: false }
      );
    },
    [mutate]
  );

  const [resyncTick, setResyncTick] = useState(0);
  const hub = useAgentBoardHub({
    onTaskUpdated: upsertCachedTask,
    onStepAdded: (step) => {
      mutate<IAgentTaskDetail>(
        agentTaskDetailKey(step.taskId),
        (detail) =>
          detail && !detail.steps.some((s) => s.id === step.id)
            ? { ...detail, steps: [...detail.steps, step] }
            : detail,
        { revalidate: false }
      );
    },
    onSummaryChanged: (summary) => {
      mutate(agentSummaryKey, summary, { revalidate: false });
    },
    onResync: () => setResyncTick((n) => n + 1),
  });
  const poll = !hub.live;

  const { summary, error: summaryError, refresh: refreshSummary } = useAgentCenterSummary(poll);
  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
  } = useAgentTasks(poll);
  const {
    agents,
    loading: agentsLoading,
    error: agentsError,
    refresh: refreshAgents,
  } = useAgentDefinitions();

  // --- Lọc bảng việc (dùng chung 3 chế độ) ----------------------------------------------
  const [filter, setFilter] = useState<TaskFilterState>({
    mode: 'active',
    q: '',
    agentId: '',
    source: '',
    kind: '',
  });
  const [listStatus, setListStatus] = useState('');
  const boardTasks = useMemo(
    () => filterTasks(tasks, { agentId: filter.agentId, source: filter.source, q: filter.q }),
    [tasks, filter.agentId, filter.source, filter.q]
  );

  // --- Việc giao nhân viên + vệ sinh theo ca (T2) -------------------------------------------
  // 31 ngày: đủ cho chế độ Lịch tháng; bảng chỉ hiện việc còn mở + xong hôm nay.
  const workHub = useWorkHubItems(31);
  const boardEntries = useMemo(
    () => [
      ...(filter.kind === '' || filter.kind === 'agent' ? boardTasks.map(agentEntry) : []),
      ...filterHubItems(workHub.items, filter).map(hubEntry),
    ],
    [boardTasks, workHub.items, filter]
  );
  const [reviewWork, setReviewWork] = useState<IWorkTask | null>(null);
  const [cancelWork, setCancelWork] = useState<IWorkTask | null>(null);
  const [cleaningShift, setCleaningShift] = useState<{ date: Date; block: string } | null>(null);

  const handleOpenItem = useCallback(
    async (item: IWorkHubItem) => {
      if (item.kind === 'cleaning' && item.date && item.block) {
        const [y, m, d] = item.date.split('-').map(Number);
        setCleaningShift({ date: new Date(y, m - 1, d), block: item.block });
        return;
      }
      try {
        setReviewWork(await getWorkTask(item.id));
      } catch (err) {
        enqueueSnackbar(apiErrorMessage(err, 'Không mở được việc này'), { variant: 'error' });
      }
    },
    [enqueueSnackbar]
  );

  const handleCancelWork = async () => {
    if (!cancelWork) return;
    setBusy(true);
    try {
      await cancelWorkTask(cancelWork.id);
      enqueueSnackbar('Đã huỷ việc');
      setCancelWork(null);
      setReviewWork(null);
      workHub.refresh();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Huỷ việc thất bại'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  // Nối lại hub → có thể đã lỡ sự kiện: tải lại bảng, tóm tắt và việc đang mở.
  useEffect(() => {
    if (!resyncTick) return;
    refreshTasks();
    refreshSummary();
    if (openTaskId) mutate(agentTaskDetailKey(openTaskId));
    // Chỉ chạy khi vừa nối lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resyncTick]);

  // --- Thao tác trên việc ------------------------------------------------------------------
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const applyResult = useCallback(
    (result: unknown, taskId: string) => {
      if (isAgentTask(result)) upsertCachedTask(result);
      else {
        refreshTasks();
        mutate(agentTaskDetailKey(taskId));
      }
    },
    [upsertCachedTask, refreshTasks, mutate]
  );

  const runTaskAction = useCallback(
    async (
      task: IAgentTask,
      action: (id: string) => Promise<unknown>,
      okText: string,
      failText: string
    ) => {
      setBusy(true);
      try {
        const res = await action(task.id);
        applyResult(res, task.id);
        enqueueSnackbar(okText);
      } catch (err: any) {
        const conflict = err?.status === 409;
        enqueueSnackbar(
          apiErrorMessage(
            err,
            conflict ? 'Việc đã đổi trạng thái — bảng đã được tải lại' : failText
          ),
          { variant: conflict ? 'warning' : 'error' }
        );
        refreshTasks();
        mutate(agentTaskDetailKey(task.id));
      } finally {
        setBusy(false);
      }
    },
    [applyResult, enqueueSnackbar, refreshTasks, mutate]
  );

  const handleRetry = useCallback(
    (task: IAgentTask) =>
      runTaskAction(task, retryAgentTask, `Đã chạy lại "${task.title}"`, 'Chạy lại thất bại'),
    [runTaskAction]
  );

  const handleConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === 'stop') {
      await runTaskAction(
        confirm.task,
        stopAgentTask,
        'Đã yêu cầu dừng — agent dừng sau bước đang chạy',
        'Dừng việc thất bại'
      );
    } else if (confirm.kind === 'cancel') {
      await runTaskAction(confirm.task, cancelAgentTask, 'Đã huỷ việc', 'Huỷ việc thất bại');
    } else {
      setBusy(true);
      try {
        const res = await setAgentCenterPaused(confirm.paused);
        if (isSummary(res)) mutate(agentSummaryKey, res, { revalidate: false });
        else refreshSummary();
        enqueueSnackbar(confirm.paused ? 'Đã dừng tất cả agent' : 'Đã mở lại các agent');
      } catch (err) {
        enqueueSnackbar(apiErrorMessage(err, 'Đổi trạng thái thất bại'), { variant: 'error' });
      } finally {
        setBusy(false);
      }
    }
    setConfirm(null);
  };

  // --- Nhóm quản trị (A1) ------------------------------------------------------------------
  // Tính năng tắt (enabled false / 404) → ẩn nút. Chưa có nhóm thì chỉ người có agent.manage tạo được.
  const { info: adminGroup, refresh: refreshAdminGroup } = useAgentAdminGroup(true);
  const [openingGroup, setOpeningGroup] = useState(false);
  const showAdminGroup = !!adminGroup?.enabled && (!!adminGroup.conversationId || canManage);

  const handleOpenAdminGroup = async () => {
    if (!adminGroup) return;
    let conversationId = adminGroup.conversationId;
    if (!conversationId) {
      setOpeningGroup(true);
      try {
        const res = await createAgentAdminGroup();
        conversationId = res.conversationId;
        refreshAdminGroup();
        if (res.created) enqueueSnackbar(`Đã tạo nhóm "${res.name}"`);
      } catch (err) {
        enqueueSnackbar(apiErrorMessage(err, 'Không mở được nhóm quản trị'), { variant: 'error' });
        return;
      } finally {
        setOpeningGroup(false);
      }
    }
    router.push(`${paths.dashboard.messenger}?c=${encodeURIComponent(conversationId)}`);
  };

  const openTask = useCallback((id: string) => setQuery({ task: id }), [setQuery]);
  const fallbackTask = useMemo(
    () => (openTaskId ? (tasks.find((t) => t.id === openTaskId) ?? null) : null),
    [tasks, openTaskId]
  );

  // --- Đầu trang -------------------------------------------------------------------------
  const counts = summary?.counts;
  const chips: { label: string; value: number | undefined; color: any }[] = [
    { label: 'Chờ chạy', value: counts?.queued, color: 'default' },
    // Việc chờ việc con (A2) nằm cột Đang chạy → đếm chung cho khớp bảng.
    {
      label: 'Đang chạy',
      value: counts ? counts.running + (counts.waiting_children ?? 0) : undefined,
      color: 'info',
    },
    { label: 'Chờ duyệt', value: counts?.waiting_approval, color: 'warning' },
    { label: 'Chờ người', value: counts?.waiting_human, color: 'secondary' },
    { label: 'Xong hôm nay', value: counts?.done_today, color: 'success' },
    { label: 'Lỗi hôm nay', value: counts?.failed_today, color: 'error' },
  ];

  return (
    <Container maxWidth={false}>
      <CustomBreadcrumbs
        heading="Trung tâm việc"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Cài đặt' },
          { name: 'Trung tâm việc' },
        ]}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {showAdminGroup && (
              <Tooltip title="Nhóm tin nhắn nhận thẻ duyệt, câu hỏi và kết quả của đội agent">
                <span>
                  <LoadingButton
                    color="inherit"
                    loading={openingGroup}
                    onClick={handleOpenAdminGroup}
                    startIcon={<Iconify icon="solar:chat-round-dots-bold" />}
                  >
                    Nhóm quản trị
                  </LoadingButton>
                </span>
              </Tooltip>
            )}
            <Button
              component={RouterLink}
              href={paths.dashboard.agent.approvals}
              color="inherit"
              startIcon={<Iconify icon="solar:shield-check-bold" />}
            >
              Duyệt việc
            </Button>
            <Button
              variant="contained"
              startIcon={<Iconify icon="solar:add-circle-bold" />}
              onClick={() => setAssignOpen(true)}
            >
              Giao việc
            </Button>
          </Stack>
        }
        sx={{ mb: 3 }}
      />

      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        alignItems="center"
        sx={{ mb: 2 }}
      >
        {chips.map((c) => (
          <Chip
            key={c.label}
            size="small"
            variant="soft"
            color={c.color}
            label={`${c.label}: ${c.value ?? '–'}`}
          />
        ))}
        {summary && <Chip size="small" variant="outlined" label={`${summary.agents} agent`} />}
        <Tooltip
          title={
            hub.live
              ? 'Bảng tự cập nhật khi agent chạy'
              : 'Chưa kết nối được cập nhật trực tiếp — tự tải lại mỗi 30 giây'
          }
        >
          <span>
            <Label
              color={hub.live ? 'success' : 'warning'}
              variant="soft"
              startIcon={
                <Iconify
                  icon={hub.live ? 'solar:wi-fi-router-bold' : 'solar:refresh-bold'}
                  width={14}
                />
              }
            >
              {hub.live
                ? 'Trực tiếp'
                : hub.state === 'connecting'
                  ? 'Đang kết nối…'
                  : 'Tải lại mỗi 30 giây'}
            </Label>
          </span>
        </Tooltip>

        {canManage && summary && (
          <FormControlLabel
            sx={{ ml: 'auto', mr: 0 }}
            control={
              <Switch
                color="error"
                checked={summary.paused}
                onChange={(e) => setConfirm({ kind: 'pause', paused: e.target.checked })}
              />
            }
            label="Dừng tất cả agent"
          />
        )}
      </Stack>

      {!!summaryError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(summaryError, 'Không tải được tóm tắt Trung tâm Agent')}
        </Alert>
      )}

      {summary?.paused && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            canManage && (
              <Button
                color="inherit"
                size="small"
                onClick={() => setConfirm({ kind: 'pause', paused: false })}
              >
                Mở lại
              </Button>
            )
          }
        >
          Đã dừng tất cả agent của cửa hàng: không việc nào được chạy, lịch không tạo việc mới cho
          tới khi mở lại.
        </Alert>
      )}

      {summary && !summary.runnerEnabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Bộ chạy agent đang tắt trên máy chủ — việc giao vẫn được ghi ở cột Chờ chạy nhưng chưa
          chạy cho tới khi bật.
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, v: TabValue) => setQuery({ tab: v })}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 3 }}
      >
        {tabs.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            icon={<Iconify icon={t.icon} width={22} />}
            iconPosition="start"
          />
        ))}
      </Tabs>

      {tab === 'board' && (
        <>
          <AgentTaskToolbar
            view={taskView}
            onView={(v) => setQuery({ view: v })}
            filter={filter}
            onFilter={(patch) => setFilter((f) => ({ ...f, ...patch }))}
            agents={agents}
            onRefresh={() => {
              refreshTasks();
              refreshSummary();
              workHub.refresh();
            }}
          />
          {!!tasksError && taskView === 'kanban' && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {apiErrorMessage(tasksError, 'Không tải được bảng việc')}
            </Alert>
          )}
          {taskView === 'kanban' && (
            <AgentBoard
              entries={boardEntries}
              mode={filter.mode}
              loading={tasksLoading || workHub.loading}
              selectedTaskId={openTaskId}
              onOpen={(t) => openTask(t.id)}
              onOpenItem={handleOpenItem}
              onStop={(t) => setConfirm({ kind: 'stop', task: t })}
              onRetry={handleRetry}
              onCancel={(t) => setConfirm({ kind: 'cancel', task: t })}
              onShowList={(status) => {
                setListStatus(status);
                setQuery({ view: 'list' });
              }}
            />
          )}
          {taskView === 'list' && (
            <AgentTaskList
              filter={filter}
              status={listStatus}
              onStatus={setListStatus}
              selectedTaskId={openTaskId}
              onOpen={(t) => openTask(t.id)}
              hubItems={workHub.items}
              onOpenItem={handleOpenItem}
              poll={poll}
            />
          )}
          {taskView === 'calendar' && (
            <AgentTaskCalendar
              filter={filter}
              onOpen={(t) => openTask(t.id)}
              hubItems={workHub.items}
              onOpenItem={handleOpenItem}
              poll={poll}
            />
          )}
        </>
      )}

      {tab === 'schedule' && (
        <AgentScheduleTab agents={agents} canManage={canManage} onOpenTask={openTask} />
      )}

      {tab === 'agents' && (
        <AgentListTab
          agents={agents}
          loading={agentsLoading}
          error={agentsError}
          canManage={canManage}
          onChanged={() => {
            refreshAgents();
            refreshSummary();
          }}
        />
      )}

      {tab === 'usage' && canManage && <AgentUsageTab />}

      <AgentTaskDrawer
        taskId={openTaskId}
        fallbackTask={fallbackTask}
        poll={poll}
        onClose={() => setQuery({ task: null })}
        onStop={(t) => setConfirm({ kind: 'stop', task: t })}
        onRetry={handleRetry}
        onCancel={(t) => setConfirm({ kind: 'cancel', task: t })}
        onNoteSent={(res) => {
          if (isAgentTask(res)) upsertCachedTask(res);
          else if (poll) refreshTasks();
        }}
      />

      <AgentAssignDialog
        open={assignOpen}
        agents={agents}
        onClose={() => setAssignOpen(false)}
        onCreated={(task) => {
          if (isAgentTask(task)) upsertCachedTask(task);
          else refreshTasks();
          refreshSummary();
          if (tab !== 'board') setQuery({ tab: 'board' });
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => (busy ? undefined : setConfirm(null))}
        cancelText="Không"
        title={
          confirm?.kind === 'stop'
            ? 'Dừng việc này?'
            : confirm?.kind === 'cancel'
              ? 'Huỷ việc này?'
              : confirm?.kind === 'pause' && confirm.paused
                ? 'Dừng tất cả agent?'
                : 'Mở lại các agent?'
        }
        content={
          confirm?.kind === 'stop'
            ? `"${confirm.task.title}" sẽ dừng sau bước đang chạy (không cắt ngang lệnh đang gọi). Có thể chạy lại sau.`
            : confirm?.kind === 'cancel'
              ? `"${confirm.task.title}" chưa chạy — huỷ thì việc chuyển sang cột Lỗi / Đã dừng và không chạy lại được.`
              : confirm?.kind === 'pause' && confirm.paused
                ? 'Mọi agent của cửa hàng ngừng nhận việc; việc đang chạy dừng sau bước hiện tại. Lịch chạy không tạo việc mới cho tới khi mở lại.'
                : 'Các agent đang bật sẽ chạy lại việc trong cột Chờ chạy và theo lịch.'
        }
        action={
          <LoadingButton
            variant="contained"
            color={confirm?.kind === 'pause' && !confirm.paused ? 'primary' : 'error'}
            loading={busy}
            onClick={handleConfirm}
          >
            {confirm?.kind === 'stop'
              ? 'Dừng'
              : confirm?.kind === 'cancel'
                ? 'Huỷ việc'
                : confirm?.kind === 'pause' && confirm.paused
                  ? 'Dừng tất cả'
                  : 'Mở lại'}
          </LoadingButton>
        }
      />

      <ReviewTaskDialog
        task={reviewWork}
        onClose={() => setReviewWork(null)}
        onDone={() => {
          setReviewWork(null);
          workHub.refresh();
        }}
        onCancel={(t) => setCancelWork(t)}
      />

      <ConfirmDialog
        open={!!cancelWork}
        onClose={() => (busy ? undefined : setCancelWork(null))}
        cancelText="Không"
        title="Huỷ việc giao này?"
        content={
          cancelWork ? `"${cancelWork.title}" sẽ bị huỷ, người được giao không cần làm nữa.` : ''
        }
        action={
          <LoadingButton
            variant="contained"
            color="error"
            loading={busy}
            onClick={handleCancelWork}
          >
            Huỷ việc
          </LoadingButton>
        }
      />

      {cleaningShift && (
        <CleaningReviewDialog
          open
          date={cleaningShift.date}
          block={cleaningShift.block}
          onClose={() => {
            setCleaningShift(null);
            workHub.refresh();
          }}
          onChanged={() => workHub.refresh()}
        />
      )}
    </Container>
  );
}
