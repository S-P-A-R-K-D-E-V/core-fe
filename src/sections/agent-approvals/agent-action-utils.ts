import type { LabelColor } from 'src/components/label';

import type {
  AgentActionStatus,
  AgentAutonomyLevel,
  IAgentAutonomyPolicy,
} from 'src/api/agent-actions';

// ----------------------------------------------------------------------
// Chữ + màu dùng chung cho trang Duyệt việc agent, và các hàm thuần (đọc tham số lệnh, thời gian còn lại, gom quyền theo
// nhóm) — tách riêng để kiểm bằng test.
// ----------------------------------------------------------------------

export const AGENT_ACTION_STATUS: Record<AgentActionStatus, { label: string; color: LabelColor }> =
  {
    pending: { label: 'Chờ duyệt', color: 'warning' },
    approved: { label: 'Đã duyệt', color: 'info' },
    executing: { label: 'Đang chạy', color: 'info' },
    executed: { label: 'Đã chạy', color: 'success' },
    failed: { label: 'Lỗi', color: 'error' },
    rejected: { label: 'Từ chối', color: 'default' },
    expired: { label: 'Hết hạn', color: 'default' },
    revision_requested: { label: 'Đã yêu cầu sửa', color: 'info' },
  };

export function agentActionStatus(status: string): { label: string; color: LabelColor } {
  return AGENT_ACTION_STATUS[status as AgentActionStatus] ?? { label: status, color: 'default' };
}

export const AUTONOMY_LEVELS: Record<
  AgentAutonomyLevel,
  { label: string; description: string; color: LabelColor }
> = {
  auto: {
    label: 'Tự làm',
    description: 'Agent làm luôn, không báo ai.',
    color: 'success',
  },
  auto_notify: {
    label: 'Tự làm rồi báo',
    description: 'Agent làm luôn, sau đó người có quyền duyệt nhận thông báo.',
    color: 'info',
  },
  approve: {
    label: 'Chờ duyệt',
    description: 'Agent tạo phiếu; chỉ chạy khi có người bấm Duyệt ở trang này.',
    color: 'warning',
  },
  deny: {
    label: 'Không cho',
    description: 'Agent không được làm việc này.',
    color: 'error',
  },
};

export const AUTONOMY_LEVEL_ORDER: AgentAutonomyLevel[] = [
  'auto',
  'auto_notify',
  'approve',
  'deny',
];

/** Mức đã áp dụng cho một lệnh ghi trong nhật ký. */
export const LOG_DECISIONS: Record<string, { label: string; color: LabelColor }> = {
  auto: { label: 'Tự làm', color: 'success' },
  auto_notify: { label: 'Tự làm rồi báo', color: 'info' },
  approve: { label: 'Chạy sau khi duyệt', color: 'primary' },
  pending: { label: 'Tạo phiếu chờ duyệt', color: 'warning' },
  deny: { label: 'Bị chặn', color: 'error' },
  client_confirm: { label: 'Người dùng xác nhận', color: 'default' },
};

export function logDecision(decision: string): { label: string; color: LabelColor } {
  return LOG_DECISIONS[decision] ?? { label: decision, color: 'default' };
}

export const APPROVAL_MODES = {
  client_confirm: {
    label: 'Người dùng tự xác nhận',
    description:
      'Lệnh ghi cần xác nhận được hỏi ngay trong ứng dụng agent (Claude, MCP…) — như trước đây.',
  },
  server_approval: {
    label: 'Agent tự chạy — duyệt ở máy chủ',
    description:
      'Agent chạy một mình; mỗi lệnh ghi theo Mức tự chủ của cửa hàng (tự làm / chờ duyệt / không cho). Cần chọn người được làm thay.',
  },
} as const;

export function approvalModeLabel(mode: string | null | undefined): string {
  if (mode === 'server_approval') return APPROVAL_MODES.server_approval.label;
  return APPROVAL_MODES.client_confirm.label;
}

// ----------------------------------------------------------------------

/** Nhóm của quyền = phần trước dấu chấm đầu tiên ("payroll.finalize" → "payroll"). */
export function permissionDomain(permission: string): string {
  const dot = permission.indexOf('.');
  return dot > 0 ? permission.slice(0, dot) : permission;
}

export type PolicyGroup = { domain: string; items: IAgentAutonomyPolicy[] };

/** Gom quyền theo nhóm, giữ thứ tự nhóm theo tên, quyền trong nhóm theo tên. */
export function groupPoliciesByDomain(items: readonly IAgentAutonomyPolicy[]): PolicyGroup[] {
  const map = new Map<string, IAgentAutonomyPolicy[]>();
  items.forEach((item) => {
    const domain = permissionDomain(item.permission);
    const list = map.get(domain);
    if (list) list.push(item);
    else map.set(domain, [item]);
  });
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, list]) => ({
      domain,
      items: [...list].sort((a, b) => a.permission.localeCompare(b.permission)),
    }));
}

// ----------------------------------------------------------------------

export type ParsedParams =
  | { kind: 'none' }
  | { kind: 'fields'; fields: { key: string; value: string }[] }
  | { kind: 'raw'; text: string };

const MAX_VALUE_CHARS = 300;

function shorten(text: string, max = MAX_VALUE_CHARS): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'string') return value === '' ? '(trống)' : shorten(value);
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value) && value.every((v) => v === null || typeof v !== 'object')) {
    return value.length === 0 ? '(trống)' : shorten(value.map((v) => displayValue(v)).join(', '));
  }
  return shorten(JSON.stringify(value));
}

/**
 * Đọc body JSON của lệnh thành danh sách "tên: giá trị" dễ đọc. Body không phải object (mảng, số…) hoặc không đọc được →
 * JSON in đẹp / chữ gốc.
 */
export function parseActionParams(bodyJson: string | null | undefined): ParsedParams {
  if (!bodyJson || !bodyJson.trim()) return { kind: 'none' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyJson);
  } catch {
    return { kind: 'raw', text: bodyJson };
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0) return { kind: 'none' };
    return {
      kind: 'fields',
      fields: entries.map(([key, value]) => ({ key, value: displayValue(value) })),
    };
  }
  return { kind: 'raw', text: JSON.stringify(parsed, null, 2) };
}

/** Tham số trên query string (ngoài body), vd "?cycleId=…". */
export function queryParams(pathAndQuery: string): { key: string; value: string }[] {
  const q = pathAndQuery.indexOf('?');
  if (q < 0) return [];
  return [...new URLSearchParams(pathAndQuery.slice(q + 1)).entries()].map(([key, value]) => ({
    key,
    value: shorten(value),
  }));
}

/** "còn 2 giờ 5 phút" / "còn 40 phút" / "còn dưới 1 phút" / "đã hết hạn". */
export function timeLeft(expiresAt: string, now: number = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'đã hết hạn';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'còn dưới 1 phút';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `còn ${days} ngày ${hours} giờ` : `còn ${days} ngày`;
  if (hours > 0) return mins > 0 ? `còn ${hours} giờ ${mins} phút` : `còn ${hours} giờ`;
  return `còn ${mins} phút`;
}

/** Phản hồi của lệnh: JSON in đẹp nếu đọc được, cắt ngắn để hiện trong thẻ. */
export function resultSnippet(body: string | null | undefined, max = 600): string {
  if (!body) return '';
  let text = body;
  try {
    text = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    // giữ chữ gốc
  }
  return shorten(text, max);
}

/** Lệnh chạy thành công khi máy chủ trả 2xx. */
export function isSuccessStatus(code: number | null | undefined): boolean {
  return typeof code === 'number' && code >= 200 && code < 300;
}

// ----------------------------------------------------------------------
// Yêu cầu sửa + xem trước bài đăng.
// ----------------------------------------------------------------------

/** Chip chèn nhanh vào ghi chú "Yêu cầu sửa". */
export const REVISION_QUICK_NOTES = [
  'Ảnh đẹp / sáng hơn',
  'Đổi nền khác',
  'Viết ngắn lại',
  'Giọng vui hơn',
  'Đổi giờ đăng',
] as const;

/** Thêm một ý vào ghi chú: xuống dòng nếu đã có chữ, không thêm trùng ý đã có. */
export function appendNote(note: string, text: string): string {
  const current = note.trimEnd();
  if (!current) return text;
  if (current.split('\n').some((line) => line.trim() === text)) return note;
  return `${current}\n${text}`;
}

const PLATFORMS: Record<string, { label: string; icon: string }> = {
  threads: { label: 'Threads', icon: 'ri:threads-fill' },
  facebook: { label: 'Facebook', icon: 'ri:facebook-circle-fill' },
  instagram: { label: 'Instagram', icon: 'ri:instagram-fill' },
  tiktok: { label: 'TikTok', icon: 'ri:tiktok-fill' },
  zalo: { label: 'Zalo', icon: 'simple-icons:zalo' },
};

export function platformInfo(platform: string): { label: string; icon: string } {
  return (
    PLATFORMS[platform?.toLowerCase()] ?? {
      label: platform || 'Mạng xã hội',
      icon: 'solar:global-bold',
    }
  );
}

// ----------------------------------------------------------------------

const REDO_MARKER = 'Ảnh cần làm lại:';

/**
 * Ghi chú của phiếu bị "Yêu cầu sửa" (BE ghép: ghi chú + "Ảnh cần làm lại:" + "- url" từng dòng) → phần chữ và danh
 * sách ảnh, để hiện ảnh nhỏ thay vì in đường link.
 */
export function splitRevisionNote(note: string | null | undefined): { text: string; imageUrls: string[] } {
  const raw = note ?? '';
  const at = raw.indexOf(REDO_MARKER);
  if (at < 0) return { text: raw.trim(), imageUrls: [] };
  const imageUrls = raw
    .slice(at + REDO_MARKER.length)
    .split('\n')
    .map((line) => line.trim().replace(/^-\s*/, '').trim())
    .filter((line) => line.startsWith('https://') || line.startsWith('http://'));
  return { text: raw.slice(0, at).trim(), imageUrls };
}
