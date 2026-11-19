import type { LabelColor } from 'src/components/label';
import type {
  IAgentTask,
  AgentStepKind,
  IAgentUsageRow,
  IAgentPlanItem,
  AgentTaskSource,
  AgentTaskStatus,
} from 'src/api/agent-center';

// ----------------------------------------------------------------------
// Trung tâm Agent: cột kanban theo trạng thái, luật kéo thả, kế hoạch / tiến độ, nhãn bước, cron.
// Máy chủ quyết trạng thái — ở đây chỉ hiển thị và chặn kéo thả vô nghĩa.
// ----------------------------------------------------------------------

export type BoardColumnId =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'waiting_human'
  | 'done'
  | 'ended';

export const BOARD_COLUMNS: {
  id: BoardColumnId;
  label: string;
  color: LabelColor;
  icon: string;
}[] = [
  { id: 'queued', label: 'Chờ chạy', color: 'default', icon: 'solar:hourglass-line-bold' },
  { id: 'running', label: 'Đang chạy', color: 'info', icon: 'solar:play-circle-bold' },
  { id: 'waiting_approval', label: 'Chờ duyệt', color: 'warning', icon: 'solar:shield-check-bold' },
  { id: 'waiting_human', label: 'Chờ người', color: 'secondary', icon: 'solar:user-speak-bold' },
  { id: 'done', label: 'Xong', color: 'success', icon: 'solar:check-circle-bold' },
  { id: 'ended', label: 'Lỗi / Đã dừng', color: 'error', icon: 'solar:danger-triangle-bold' },
];

/**
 * Cột của một trạng thái; failed / stopped / cancelled chung cột "Lỗi / Đã dừng"; waiting_children (A2 — việc cha chờ
 * việc con) nằm cột Đang chạy. Trạng thái lạ → Chờ chạy.
 */
export function columnOfStatus(status: AgentTaskStatus | string): BoardColumnId {
  switch (status) {
    case 'running':
    case 'waiting_approval':
    case 'waiting_human':
    case 'done':
      return status;
    case 'waiting_children':
      return 'running';
    case 'failed':
    case 'stopped':
    case 'cancelled':
      return 'ended';
    default:
      return 'queued';
  }
}

export const TASK_STATUS: Record<AgentTaskStatus, { label: string; color: LabelColor }> = {
  queued: { label: 'Chờ chạy', color: 'default' },
  running: { label: 'Đang chạy', color: 'info' },
  waiting_approval: { label: 'Chờ duyệt', color: 'warning' },
  waiting_human: { label: 'Chờ người', color: 'secondary' },
  waiting_children: { label: 'Chờ việc con', color: 'primary' },
  done: { label: 'Xong', color: 'success' },
  failed: { label: 'Lỗi', color: 'error' },
  stopped: { label: 'Đã dừng', color: 'default' },
  cancelled: { label: 'Đã huỷ', color: 'default' },
};

export function taskStatusMeta(status: string): { label: string; color: LabelColor } {
  return TASK_STATUS[status as AgentTaskStatus] ?? { label: status, color: 'default' };
}

export const TASK_SOURCE: Record<AgentTaskSource, { label: string; icon: string }> = {
  schedule: { label: 'Lịch', icon: 'solar:calendar-bold' },
  manual: { label: 'Người giao', icon: 'solar:user-bold' },
  agent: { label: 'Agent', icon: 'solar:cpu-bolt-bold' },
  event: { label: 'Sự kiện', icon: 'solar:bolt-bold' },
  chat: { label: 'Nhóm quản trị', icon: 'solar:chat-round-dots-bold' },
};

export function taskSourceMeta(source: string): { label: string; icon: string } {
  return (
    TASK_SOURCE[source as AgentTaskSource] ?? { label: source, icon: 'solar:question-circle-bold' }
  );
}

/** Việc chưa kết thúc — còn dừng được. */
export function canStop(status: string): boolean {
  return ['queued', 'running', 'waiting_approval', 'waiting_human', 'waiting_children'].includes(
    status
  );
}

/** Nhãn "Chờ 1/3 việc con" của việc waiting_children (A2); trạng thái khác → null. */
export function childrenWaitLabel(
  task: Pick<IAgentTask, 'status' | 'childrenTotal' | 'childrenDone'>
): string | null {
  if (task.status !== 'waiting_children') return null;
  const total = task.childrenTotal ?? 0;
  if (total <= 0) return 'Chờ việc con';
  const done = Math.min(Math.max(task.childrenDone ?? 0, 0), total);
  return `Chờ ${done}/${total} việc con`;
}

export function canRetry(status: string): boolean {
  return status === 'failed' || status === 'stopped';
}

export function canCancel(status: string): boolean {
  return status === 'queued';
}

// ----------------------------------------------------------------------
// Kéo thả: chỉ hai nước có nghĩa. Mọi nước khác bị từ chối với một câu ngắn.

export type DropDecision =
  | { kind: 'none' }
  | { kind: 'retry' }
  | { kind: 'cancel' }
  | { kind: 'reject'; message: string };

export const DROP_REJECT_MESSAGE =
  'Máy chủ tự chuyển cột. Chỉ kéo Lỗi / Đã dừng → Chờ chạy (chạy lại) hoặc Chờ chạy → Lỗi / Đã dừng (huỷ).';

export function decideDrop(
  from: BoardColumnId,
  to: BoardColumnId,
  status: AgentTaskStatus | string
): DropDecision {
  if (from === to) return { kind: 'none' };
  if (from === 'ended' && to === 'queued') {
    if (canRetry(status)) return { kind: 'retry' };
    return { kind: 'reject', message: 'Việc đã huỷ không chạy lại được — hãy giao việc mới.' };
  }
  if (from === 'queued' && to === 'ended') {
    if (canCancel(status)) return { kind: 'cancel' };
    return { kind: 'reject', message: 'Việc đã bắt đầu chạy — dùng nút Dừng.' };
  }
  return { kind: 'reject', message: DROP_REJECT_MESSAGE };
}

/** Thẻ kéo được không (khoá kéo những thẻ không có nước nào hợp lệ). */
export function isDraggable(status: AgentTaskStatus | string): boolean {
  return canRetry(status) || canCancel(status);
}

// ----------------------------------------------------------------------
// Bảng: nhóm việc theo cột (mới trước), lọc theo agent, chèn / cập nhật một việc.

export function groupTasksByColumn(
  tasks: readonly IAgentTask[],
  agentId?: string | null
): Record<BoardColumnId, IAgentTask[]> {
  const out: Record<BoardColumnId, IAgentTask[]> = {
    queued: [],
    running: [],
    waiting_approval: [],
    waiting_human: [],
    done: [],
    ended: [],
  };
  tasks
    .filter((t) => !agentId || t.agentId === agentId)
    .forEach((t) => out[columnOfStatus(t.status)].push(t));
  (Object.keys(out) as BoardColumnId[]).forEach((col) => {
    out[col].sort((a, b) => sortTime(b).localeCompare(sortTime(a)));
  });
  return out;
}

function sortTime(t: IAgentTask): string {
  return t.finishedAt || t.startedAt || t.createdAt || '';
}

/** Chèn mới hoặc thay việc cùng id (giữ thứ tự; việc mới lên đầu). */
export function upsertTask(
  list: readonly IAgentTask[] | undefined,
  task: IAgentTask
): IAgentTask[] {
  const current = list ?? [];
  const index = current.findIndex((t) => t.id === task.id);
  if (index < 0) return [task, ...current];
  const next = [...current];
  next[index] = task;
  return next;
}

// ----------------------------------------------------------------------
// Kế hoạch / tiến độ.

export function planProgress(plan: readonly IAgentPlanItem[] | null | undefined): {
  done: number;
  total: number;
  percent: number;
} {
  const items = plan ?? [];
  const total = items.length;
  const done = items.filter((p) => p.status === 'done' || p.status === 'skipped').length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export const PLAN_STATUS: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: 'solar:record-linear', color: 'text.disabled', label: 'Chưa làm' },
  in_progress: { icon: 'svg-spinners:pulse-rings-2', color: 'info.main', label: 'Đang làm' },
  done: { icon: 'solar:check-circle-bold', color: 'success.main', label: 'Xong' },
  skipped: { icon: 'solar:skip-next-bold', color: 'text.disabled', label: 'Bỏ qua' },
};

export function planStatusMeta(status: string) {
  return PLAN_STATUS[status] ?? PLAN_STATUS.pending;
}

/** Dòng "đến bước nào" của thẻ: ưu tiên nhãn máy chủ dựng; không có thì tự dựng từ kế hoạch. */
export function stepLabel(
  task: Pick<IAgentTask, 'currentStepLabel' | 'currentStepIndex' | 'plan'>
): string | null {
  if (task.currentStepLabel?.trim()) return task.currentStepLabel.trim();
  const plan = task.plan ?? [];
  if (!plan.length || task.currentStepIndex == null) return null;
  const item = plan[task.currentStepIndex];
  if (!item) return null;
  return `Bước ${task.currentStepIndex + 1}/${plan.length} — ${item.title}`;
}

// ----------------------------------------------------------------------
// Bước trong dòng thời gian.

export const STEP_KIND: Record<AgentStepKind, { label: string; icon: string; color: LabelColor }> =
  {
    model: { label: 'Model', icon: 'solar:cpu-bolt-bold', color: 'primary' },
    tool: { label: 'Tool', icon: 'solar:widget-5-bold', color: 'info' },
    plan: { label: 'Kế hoạch', icon: 'solar:checklist-minimalistic-bold', color: 'secondary' },
    note: { label: 'Ghi chú', icon: 'solar:chat-round-line-bold', color: 'warning' },
    approval: { label: 'Duyệt', icon: 'solar:shield-check-bold', color: 'warning' },
    system: { label: 'Hệ thống', icon: 'solar:settings-bold', color: 'default' },
  };

export function stepKindMeta(kind: string) {
  return STEP_KIND[kind as AgentStepKind] ?? STEP_KIND.system;
}

// ----------------------------------------------------------------------
// Thời gian / token.

/** "45 giây", "3 phút 12 giây", "1 giờ 5 phút". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m ? `${h} giờ ${m} phút` : `${h} giờ`;
  if (m > 0) return s ? `${m} phút ${s} giây` : `${m} phút`;
  return `${s} giây`;
}

/** Thời gian chạy: đang chạy → tới `now`; đã xong → bắt đầu → kết thúc; chưa chạy → null. */
export function taskElapsedMs(
  task: Pick<IAgentTask, 'startedAt' | 'finishedAt'>,
  now: number = Date.now()
): number | null {
  if (!task.startedAt) return null;
  const start = new Date(task.startedAt).getTime();
  const end = task.finishedAt ? new Date(task.finishedAt).getTime() : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

export function taskTokens(task: Pick<IAgentTask, 'inputTokens' | 'outputTokens'>): number {
  return (task.inputTokens ?? 0) + (task.outputTokens ?? 0);
}

/** 1234 → "1,2k", 2_500_000 → "2,5tr". */
export function shortTokens(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${trim1(v / 1_000_000)}tr`;
  if (v >= 1_000) return `${trim1(v / 1_000)}k`;
  return String(v);
}

function trim1(x: number): string {
  return (Math.round(x * 10) / 10).toString().replace('.', ',');
}

// ----------------------------------------------------------------------
// Chi phí: gom theo ngày × agent cho biểu đồ cột chồng.

export function usageChartData(
  rows: readonly IAgentUsageRow[],
  days: number,
  today: Date = new Date()
): { dates: string[]; series: { name: string; data: number[] }[] } {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }
  const index = new Map(dates.map((d, i) => [d, i]));
  const byAgent = new Map<string, { name: string; data: number[] }>();
  rows.forEach((r) => {
    const i = index.get(r.date);
    if (i == null) return;
    let entry = byAgent.get(r.agentId);
    if (!entry) {
      entry = { name: r.agentName || r.agentId, data: dates.map(() => 0) };
      byAgent.set(r.agentId, entry);
    }
    entry.data[i] += (r.inputTokens ?? 0) + (r.outputTokens ?? 0);
  });
  return {
    dates,
    series: [...byAgent.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function usageTotalsByAgent(rows: readonly IAgentUsageRow[]) {
  const map = new Map<
    string,
    { agentId: string; agentName: string; inputTokens: number; outputTokens: number; tasks: number }
  >();
  rows.forEach((r) => {
    const cur = map.get(r.agentId) ?? {
      agentId: r.agentId,
      agentName: r.agentName,
      inputTokens: 0,
      outputTokens: 0,
      tasks: 0,
    };
    cur.inputTokens += r.inputTokens ?? 0;
    cur.outputTokens += r.outputTokens ?? 0;
    cur.tasks += r.tasks ?? 0;
    map.set(r.agentId, cur);
  });
  return [...map.values()].sort(
    (a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens)
  );
}

// ----------------------------------------------------------------------
// Cron 5 trường (phút giờ ngày tháng thứ), giờ Việt Nam. Máy chủ mới là nơi kiểm cuối cùng (sai → 400 { message }); ở
// đây chỉ đọc thành câu tiếng Việt cho người xem.

export const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: 'Hằng ngày 7:30', cron: '30 7 * * *' },
  { label: 'Thứ 2 hằng tuần 8:00', cron: '0 8 * * 1' },
  { label: 'Mỗi giờ', cron: '0 * * * *' },
];

const CRON_FIELDS = [
  { name: 'phút', min: 0, max: 59 },
  { name: 'giờ', min: 0, max: 23 },
  { name: 'ngày', min: 1, max: 31 },
  { name: 'tháng', min: 1, max: 12 },
  { name: 'thứ', min: 0, max: 7 },
] as const;

type CronPart = { min: number; max: number; name: string };

function validField(token: string, f: CronPart): boolean {
  return token.split(',').every((item) => {
    if (!item) return false;
    const [range, stepStr] = item.split('/');
    if (stepStr !== undefined && !/^\d+$/.test(stepStr)) return false;
    if (stepStr !== undefined && Number(stepStr) < 1) return false;
    if (range === '*') return true;
    const m = /^(\d+)(?:-(\d+))?$/.exec(range);
    if (!m) return false;
    const a = Number(m[1]);
    const b = m[2] !== undefined ? Number(m[2]) : a;
    return a >= f.min && b <= f.max && a <= b;
  });
}

const DOW_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const isNum = (s: string) => /^\d+$/.test(s);
const pad2 = (n: number | string) => String(n).padStart(2, '0');

function listText(token: string, map: (n: string) => string): string {
  return token
    .split(',')
    .map((item) => {
      const r = /^(\d+)-(\d+)$/.exec(item);
      if (r) return `${map(r[1])} đến ${map(r[2])}`;
      return map(item);
    })
    .join(', ');
}

function timeText(minute: string, hour: string): string {
  if (isNum(minute) && hour.split(',').every(isNum)) {
    return `lúc ${hour
      .split(',')
      .map((h) => `${pad2(h)}:${pad2(minute)}`)
      .join(', ')}`;
  }
  const everyMin = /^\*\/(\d+)$/.exec(minute);
  if (everyMin && hour === '*') return `mỗi ${everyMin[1]} phút`;
  if (minute === '*' && hour === '*') return 'mỗi phút';
  if (isNum(minute) && hour === '*') {
    return minute === '0' ? 'mỗi giờ (đầu giờ)' : `mỗi giờ, phút ${minute}`;
  }
  const everyHour = /^\*\/(\d+)$/.exec(hour);
  if (isNum(minute) && everyHour) return `mỗi ${everyHour[1]} giờ, phút ${minute}`;
  if (isNum(minute) && /^[\d,-]+$/.test(hour)) {
    return `phút ${minute} mỗi giờ từ ${listText(hour, (h) => `${h}h`)}`;
  }
  if (everyMin) return `mỗi ${everyMin[1]} phút, giờ ${hour}`;
  return `phút ${minute}, giờ ${hour}`;
}

/**
 * Đọc cron thành câu tiếng Việt. Sai cú pháp → `{ ok: false, error }`.
 * Vd "30 7 * * *" → "Hằng ngày lúc 07:30", "0 8 * * 1" → "Thứ 2 hằng tuần lúc 08:00".
 */
export function describeCron(
  expr: string
): { ok: true; text: string } | { ok: false; error: string } {
  const parts = (expr ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 5) {
    return { ok: false, error: 'Cron cần đúng 5 trường: phút giờ ngày tháng thứ' };
  }
  for (let i = 0; i < 5; i += 1) {
    if (!validField(parts[i], CRON_FIELDS[i])) {
      const f = CRON_FIELDS[i];
      return { ok: false, error: `Trường ${f.name} không hợp lệ (${f.min}–${f.max})` };
    }
  }
  const [minute, hour, dom, month, dow] = parts;
  const time = timeText(minute, hour);

  let day: string;
  if (dom === '*' && dow === '*') {
    day = 'Hằng ngày';
  } else if (dom === '*') {
    day = `${listText(dow, (d) => DOW_NAMES[Number(d)] ?? d)} hằng tuần`;
  } else if (dow === '*') {
    day = `Ngày ${listText(dom, (d) => d)} hằng tháng`;
  } else {
    day = `Ngày ${listText(dom, (d) => d)} hoặc ${listText(dow, (d) => DOW_NAMES[Number(d)] ?? d)}`;
  }
  if (month !== '*') day += `, tháng ${listText(month, (m) => m)}`;

  const timeFirst = time.startsWith('mỗi');
  const text = timeFirst && day === 'Hằng ngày' ? capitalize(time) : `${day} ${time}`;
  return { ok: true, text };
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
