import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Trung tâm Agent (K4, core-be AgentCenterController /agent-center/*). Hợp đồng: docs/cici/plans/k4-api-contract.md.
// Quyền: agent.approve xem bảng việc, giao việc, nhắn, dừng / chạy lại / huỷ; agent.manage sửa agent, lịch, "Dừng tất cả",
// xem chi phí. Cập nhật trực tiếp qua hub /hubs/agent-board (xem sections/agent-center/hooks/use-agent-board-hub.ts).
// ----------------------------------------------------------------------

export type AgentTaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'waiting_human'
  /** A2: việc cha chờ các việc con (task_delegate wait) — chưa kết thúc, nằm cột Đang chạy. */
  | 'waiting_children'
  | 'done'
  | 'failed'
  | 'stopped'
  | 'cancelled';

/** `chat` (A2): tin @CEO trong nhóm quản trị. */
export type AgentTaskSource = 'manual' | 'schedule' | 'agent' | 'event' | 'chat';

export type AgentPlanItemStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export interface IAgentPlanItem {
  title: string;
  status: AgentPlanItemStatus;
  note?: string | null;
}

export interface IAgentTask {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  instruction: string;
  source: AgentTaskSource;
  sourceRef: string | null;
  parentTaskId: string | null;
  status: AgentTaskStatus;
  plan: IAgentPlanItem[] | null;
  currentStepIndex: number | null;
  /** "Bước 3/5 — đang tra tồn kho" — máy chủ dựng sẵn. */
  currentStepLabel: string | null;
  result: string | null;
  error: string | null;
  /** Phiếu duyệt K3 đang chờ (status waiting_approval). */
  pendingActionId: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  stopRequested: boolean;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  /** A2: số việc con đang được chờ (0 khi không chờ). Máy chủ cũ không gửi. */
  childrenTotal?: number;
  /** A2: số con trong đó đã xong / lỗi / dừng / chờ người. */
  childrenDone?: number;
}

export type AgentStepKind = 'model' | 'tool' | 'plan' | 'note' | 'approval' | 'system';

export interface IAgentRunStep {
  id: string;
  taskId: string;
  seq: number;
  kind: AgentStepKind;
  /** Tên tool (kind tool). */
  name: string | null;
  summary: string;
  /** Tham số / kết quả, máy chủ đã cắt ≤ 4000 ký tự. */
  detail: string | null;
  status: 'ok' | 'error' | 'pending';
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
  /** Bước "note" do người viết. */
  authorName: string | null;
}

export interface IAgentTaskDetail {
  task: IAgentTask;
  steps: IAgentRunStep[];
}

export interface IAgentCenterSummary {
  paused: boolean;
  runnerEnabled: boolean;
  counts: {
    queued: number;
    running: number;
    waiting_approval: number;
    waiting_human: number;
    /** A2 — máy chủ cũ không gửi. */
    waiting_children?: number;
    done_today: number;
    failed_today: number;
  };
  agents: number;
}

export interface IAgentDefinition {
  id: string;
  key: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  promptVersion: number;
  model: string;
  toolNames: string[];
  agentApiKeyId: string | null;
  actsForUserId: string | null;
  actsForName: string | null;
  permissions: string[];
  /** null = không giới hạn. */
  dailyTokenBudget: number | null;
  maxToolCallsPerTask: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string | null;
  todayTokens: number;
}

export interface IAgentDefinitionInput {
  key: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  model?: string | null;
  toolNames: string[];
  actsForUserId: string | null;
  dailyTokenBudget?: number | null;
  maxToolCallsPerTask?: number | null;
}

export interface IAgentTool {
  name: string;
  title: string;
  description: string | null;
  permission: string;
  method: string;
  readOnly: boolean;
}

export interface IAgentSchedule {
  id: string;
  agentId: string;
  agentName: string;
  name: string;
  /** 5 trường, giờ Việt Nam. */
  cron: string;
  instruction: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastTaskId: string | null;
  /** Xong / lỗi → hệ thống gửi kết quả vào chat Telegram báo cáo riêng (cấu hình loại telegram-report). */
  deliverTelegram?: boolean;
  /** Xong → hệ thống đăng thẻ kết quả (task_result) vào nhóm Messenger "Quản trị – Đội agent" (A1). */
  deliverAdminGroup?: boolean;
}

export interface IAgentScheduleInput {
  agentId: string;
  name: string;
  cron: string;
  instruction: string;
  enabled: boolean;
  deliverTelegram?: boolean;
  deliverAdminGroup?: boolean;
}

/** Nhóm Messenger hệ thống "Quản trị – Đội agent" (A1): conversationId null = chưa tạo; enabled false = tính năng tắt. */
export interface IAgentAdminGroupInfo {
  conversationId: string | null;
  enabled: boolean;
}

export interface IAgentAdminGroupCreated {
  conversationId: string;
  name: string;
  created: boolean;
}

export interface IAgentScheduleOccurrence {
  scheduleId: string;
  agentId: string;
  agentName: string;
  name: string;
  at: string;
}

export interface IAgentUsageRow {
  /** yyyy-MM-dd giờ Việt Nam. */
  date: string;
  agentId: string;
  agentName: string;
  inputTokens: number;
  outputTokens: number;
  tasks: number;
}

export const DEFAULT_AGENT_MODEL = 'claude-haiku-5-5';

const EP = endpoints.agentCenter;

// ----------------------------------------------------------------------
// Khoá SWR — hub dùng chung để ghi thẳng vào cache (mutate) khi có sự kiện.

export const AGENT_TASKS_TAKE = 200;
export const agentSummaryKey = EP.summary;
/** Bảng việc: 7 ngày + mọi việc chưa xong; việc trả lời tin khách (`conv:`) chỉ hiện khi lỗi / chờ người (xem ở Hộp thư). */
export const agentTasksKey = `${EP.tasks}?take=${AGENT_TASKS_TAKE}&hideConversation=true`;
export const agentTaskDetailKey = (id: string) => EP.task(id);
export const agentListKey = EP.agents;
export const agentSchedulesKey = EP.schedules;

/** Việc trả về từ lệnh stop / retry / cancel / notes có phải AgentTask đầy đủ không (hợp đồng không bắt buộc). */
export function isAgentTask(value: unknown): value is IAgentTask {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as IAgentTask).id === 'string' &&
    typeof (value as IAgentTask).status === 'string' &&
    typeof (value as IAgentTask).agentId === 'string'
  );
}

// ----------------------------------------------------------------------
// Đọc. `poll` = hub đang mất kết nối → hỏi lại mỗi 30 giây.

const POLL_MS = 30_000;

export interface AgentCenterSummaryOptions {
  /** false = không hỏi máy chủ (vd người không có quyền agent.approve). Mặc định true. */
  enabled?: boolean;
  /** Chu kỳ hỏi lại tính theo dữ liệu mới nhất — thay cho `poll`. SWR tự dừng khi tab bị ẩn. */
  refreshInterval?: (latest: IAgentCenterSummary | undefined) => number;
  /** Lỗi (vd 403) thì thôi, không thử lại dồn dập. */
  quiet?: boolean;
}

export function useAgentCenterSummary(poll: boolean, options?: AgentCenterSummaryOptions) {
  const enabled = options?.enabled ?? true;
  const { data, isLoading, error, mutate } = useSWR<IAgentCenterSummary>(
    enabled ? agentSummaryKey : null,
    fetcher,
    {
      refreshInterval: options?.refreshInterval ?? (poll ? POLL_MS : 0),
      keepPreviousData: true,
      ...(options?.quiet && { shouldRetryOnError: false }),
    }
  );
  return useMemo(
    () => ({ summary: data, loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

export function useAgentTasks(poll: boolean) {
  const { data, isLoading, error, mutate } = useSWR<IAgentTask[]>(agentTasksKey, fetcher, {
    refreshInterval: poll ? POLL_MS : 0,
    keepPreviousData: true,
  });
  return useMemo(
    () => ({ tasks: data ?? [], loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

export interface AgentTaskListParams {
  /** Danh sách trạng thái, phẩy ngăn cách (vd "failed,stopped"). */
  status?: string;
  agentId?: string;
  source?: string;
  q?: string;
  /** ISO — lọc theo lúc tạo; có khoảng ngày thì bỏ mặc định 7 ngày. */
  from?: string;
  to?: string;
  hideConversation?: boolean;
  skip?: number;
  take?: number;
}

export function agentTaskListKey(params: AgentTaskListParams): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === false) return;
    qs.set(k, String(v));
  });
  return `${EP.tasks}?${qs.toString()}`;
}

/** Danh sách việc có lọc / phân trang (chế độ Danh sách, Lịch). `params` null = chưa hỏi. */
export function useAgentTaskList(params: AgentTaskListParams | null, poll = false) {
  const { data, isLoading, error, mutate } = useSWR<IAgentTask[]>(
    params ? agentTaskListKey(params) : null,
    fetcher,
    { keepPreviousData: true, refreshInterval: poll ? POLL_MS : 0 }
  );
  return useMemo(
    () => ({ tasks: data ?? [], loading: isLoading, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

export function useAgentTaskDetail(id: string | null, poll: boolean) {
  const { data, isLoading, error, mutate } = useSWR<IAgentTaskDetail>(
    id ? agentTaskDetailKey(id) : null,
    fetcher,
    { refreshInterval: poll ? POLL_MS : 0 }
  );
  return useMemo(
    () => ({ detail: data, loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

export function useAgentDefinitions() {
  const { data, isLoading, error, mutate } = useSWR<IAgentDefinition[]>(agentListKey, fetcher);
  return useMemo(
    () => ({ agents: data ?? [], loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

/** Tool chọn được cho agent — chỉ agent.manage. */
export function useAgentTools(enabled: boolean) {
  const { data, isLoading, error } = useSWR<IAgentTool[]>(enabled ? EP.tools : null, fetcher, {
    revalidateOnFocus: false,
  });
  return useMemo(
    () => ({ tools: data ?? [], loading: isLoading && !data, error }),
    [data, isLoading, error]
  );
}

export function useAgentSchedules() {
  const { data, isLoading, error, mutate } = useSWR<IAgentSchedule[]>(agentSchedulesKey, fetcher);
  return useMemo(
    () => ({ schedules: data ?? [], loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

/** Các lần chạy sắp tới trong khoảng [from, to) (ISO) — tối đa 500. */
export function useAgentScheduleOccurrences(range: { from: string; to: string } | null) {
  const key = range
    ? `${EP.occurrences}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
    : null;
  const { data, isLoading, error, mutate } = useSWR<IAgentScheduleOccurrence[]>(key, fetcher, {
    keepPreviousData: true,
  });
  return useMemo(
    () => ({ occurrences: data ?? [], loading: isLoading, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

/**
 * Nhóm quản trị (A1) — quyền agent.approve. Tính năng tắt (AgentAdminGroup__Enabled=false) thì máy chủ trả 404 hoặc
 * `enabled: false` → coi như tắt, không thử lại.
 */
export function useAgentAdminGroup(enabled: boolean) {
  const { data, isLoading, error, mutate } = useSWR<IAgentAdminGroupInfo>(
    enabled ? EP.adminGroup : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  return useMemo(
    () => ({
      info: error ? undefined : data,
      loading: isLoading && !data,
      error,
      refresh: mutate,
    }),
    [data, isLoading, error, mutate]
  );
}

/** Tạo (hoặc lấy lại) nhóm quản trị — quyền agent.manage. Lần đầu thêm sẵn các Admin của cửa hàng. */
export async function createAgentAdminGroup(): Promise<IAgentAdminGroupCreated> {
  const res = await axios.post<IAgentAdminGroupCreated>(EP.adminGroup);
  return res.data;
}

export interface IAgentConfirmOpResult {
  label: string;
  ok: boolean;
  message: string | null;
}

export interface IAgentConfirmResult {
  status: 'done' | (string & {});
  statusText: string | null;
  /** Chỉ có khi Xác nhận. */
  results?: IAgentConfirmOpResult[] | null;
}

/**
 * Thẻ `confirm` của CEO (A2): Xác nhận → máy chủ chạy các thao tác bằng quyền + tên người bấm. 409 thẻ đã xử lý, 404 không
 * có, 400 không phải thẻ confirm.
 */
export async function confirmAdminGroupProposal(refId: string): Promise<IAgentConfirmResult> {
  const res = await axios.post<IAgentConfirmResult>(EP.adminGroupConfirm(refId), {});
  return res.data;
}

/** Thẻ `confirm` của CEO (A2): Huỷ đề xuất, không chạy gì. */
export async function cancelAdminGroupProposal(refId: string): Promise<IAgentConfirmResult> {
  const res = await axios.post<IAgentConfirmResult>(EP.adminGroupConfirmCancel(refId), {});
  return res.data;
}

/** Token theo ngày theo agent — chỉ agent.manage. */
export function useAgentUsage(days: number, enabled: boolean) {
  const { data, isLoading, error, mutate } = useSWR<IAgentUsageRow[]>(
    enabled ? `${EP.usage}?days=${days}` : null,
    fetcher
  );
  return useMemo(
    () => ({ rows: data ?? [], loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

// ----------------------------------------------------------------------
// Ghi.

export async function setAgentCenterPaused(paused: boolean): Promise<unknown> {
  const res = await axios.post(EP.pause, { paused });
  return res.data;
}

export async function createAgentTask(data: {
  agentId: string;
  title: string;
  instruction: string;
}): Promise<IAgentTask> {
  const res = await axios.post<IAgentTask>(EP.tasks, data);
  return res.data;
}

/** Nhắn chỉ dẫn; việc `waiting_human` → máy chủ chuyển `queued` để agent đọc. */
export async function addAgentTaskNote(id: string, text: string): Promise<unknown> {
  const res = await axios.post(EP.taskNotes(id), { text });
  return res.data;
}

export async function stopAgentTask(id: string): Promise<unknown> {
  const res = await axios.post(EP.taskStop(id));
  return res.data;
}

export async function retryAgentTask(id: string): Promise<unknown> {
  const res = await axios.post(EP.taskRetry(id));
  return res.data;
}

export async function cancelAgentTask(id: string): Promise<unknown> {
  const res = await axios.post(EP.taskCancel(id));
  return res.data;
}

export async function createAgentDefinition(
  data: IAgentDefinitionInput
): Promise<IAgentDefinition> {
  const res = await axios.post<IAgentDefinition>(EP.agents, data);
  return res.data;
}

export async function updateAgentDefinition(
  id: string,
  data: IAgentDefinitionInput
): Promise<IAgentDefinition> {
  const res = await axios.put<IAgentDefinition>(EP.agent(id), data);
  return res.data;
}

export async function setAgentEnabled(id: string, enabled: boolean): Promise<unknown> {
  const res = await axios.post(EP.agentEnabled(id), { enabled });
  return res.data;
}

export async function createAgentSchedule(data: IAgentScheduleInput): Promise<IAgentSchedule> {
  const res = await axios.post<IAgentSchedule>(EP.schedules, data);
  return res.data;
}

export async function updateAgentSchedule(
  id: string,
  data: IAgentScheduleInput
): Promise<IAgentSchedule> {
  const res = await axios.put<IAgentSchedule>(EP.schedule(id), data);
  return res.data;
}

export async function deleteAgentSchedule(id: string): Promise<void> {
  await axios.delete(EP.schedule(id));
}
