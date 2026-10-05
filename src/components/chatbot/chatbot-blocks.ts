import { getStorageUrl } from 'src/utils/storage';

import type { ChatbotStep, ChatbotSuggestion } from 'src/api/chatbot';

import { type ChatbotRouteUser, resolveChatbotRoute } from './chatbot-routes';

// ----------------------------------------------------------------------
// Hàm thuần cho phần "có cấu trúc" của câu trả lời (không import React):
//   - normalizeChatbotBlocks: kiểm lại khối (ảnh / link / nút / gợi ý) trước khi hiển thị. Server
//     (AssistantBlockPolicy) đã lọc, nhưng nội dung gốc do model viết → client không tin, kiểm lần nữa
//     (cùng quy tắc với app mobile: features/assistant/blocks.ts).
//   - friendlyToolLabel / progressLabel / summarizeSteps: nhãn tiến độ thân thiện — KHÔNG để lộ tên
//     tool nội bộ (analytics_revenue_read…) ra giao diện.
// ----------------------------------------------------------------------

export type ChatbotUiImage = { type: 'image'; src: string; alt?: string };
export type ChatbotUiLink = { type: 'link'; url: string; title: string; host: string };
export type ChatbotUiNavigateAction = {
  type: 'action';
  kind: 'navigate';
  id: string;
  label: string;
  /** Đường dẫn dashboard đã ánh xạ từ khoá route (chatbot-routes). */
  href: string;
};
export type ChatbotUiToolAction = {
  type: 'action';
  kind: 'tool';
  id: string;
  label: string;
  /** Câu gửi như tin nhắn thường SAU KHI người dùng xác nhận — nút không bao giờ tự chạy gì. */
  prompt: string;
  confirm: { title: string; message: string };
};
export type ChatbotUiAction = ChatbotUiNavigateAction | ChatbotUiToolAction;
export type ChatbotUiSuggestions = { type: 'suggestions'; items: ChatbotSuggestion[] };

export type ChatbotUiBlock =
  | ChatbotUiImage
  | ChatbotUiLink
  | ChatbotUiAction
  | ChatbotUiSuggestions;

export const CHATBOT_BLOCK_LIMITS = {
  total: 12,
  image: 6,
  link: 4,
  action: 3,
  suggestions: 1,
  suggestionItems: 4,
} as const;

const OBJECT_KEY = /^[A-Za-z0-9/_.-]{1,256}$/;
// Vùng lưu trữ nhạy cảm / riêng tư — model không được trỏ ảnh tới đây.
const PRIVATE_PREFIXES = [
  'id-cards/',
  'face-enrollment/',
  'assistant/',
  'messenger/',
  'chat/',
  't/',
];

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

// ---------------------------------------------------------------------- URL

export type ParsedHttpUrl = { scheme: 'http' | 'https'; host: string };

/** URL tuyệt đối http(s), không userinfo, không khoảng trắng / ký tự điều khiển; khác → null. */
export function parseHttpUrl(raw: unknown): ParsedHttpUrl | null {
  if (typeof raw !== 'string') return null;
  const url = raw.trim();
  // eslint-disable-next-line no-control-regex
  if (!url || url.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(url)) return null;
  const m = /^(https?):\/\/([^/?#]+)(?:[/?#]|$)/i.exec(url);
  if (!m) return null;
  const authority = m[2];
  if (authority.includes('@') || authority.includes('\\')) return null;
  const host = authority.replace(/:\d{1,5}$/, '').toLowerCase();
  if (!host || !/^[a-z0-9.-]+$/.test(host) || host.startsWith('.') || host.endsWith('.')) {
    return null;
  }
  return { scheme: m[1].toLowerCase() as 'http' | 'https', host };
}

export function isHttpUrl(raw: unknown): raw is string {
  return parseHttpUrl(raw) !== null;
}

/** objectKey ảnh trong bucket công khai hiển thị được. */
export function isPublicObjectKey(key: string): boolean {
  return (
    OBJECT_KEY.test(key) &&
    !key.includes('..') &&
    !key.startsWith('/') &&
    !PRIVATE_PREFIXES.some((p) => key.toLowerCase().startsWith(p))
  );
}

// ---------------------------------------------------------------------- khối

function imageBlock(b: Record<string, unknown>): ChatbotUiImage | null {
  const url = str(b.url);
  const objectKey = str(b.objectKey);
  const alt = str(b.alt).slice(0, 120) || undefined;
  if (url && objectKey) return null; // đúng một trong hai
  if (url) return parseHttpUrl(url)?.scheme === 'https' ? { type: 'image', src: url, alt } : null;
  if (objectKey && isPublicObjectKey(objectKey)) {
    // Cùng hàm dựng URL ảnh công khai của cả app (/media/<key>).
    return { type: 'image', src: getStorageUrl(objectKey), alt };
  }
  return null;
}

function linkBlock(b: Record<string, unknown>): ChatbotUiLink | null {
  const url = str(b.url);
  const parsed = parseHttpUrl(url);
  if (!parsed) return null;
  return { type: 'link', url, host: parsed.host, title: str(b.title).slice(0, 80) || parsed.host };
}

function actionBlock(
  b: Record<string, unknown>,
  user: ChatbotRouteUser,
  id: string
): ChatbotUiAction | null {
  const label = str(b.label);
  if (!label || label.length > 40) return null;

  if (b.kind === 'navigate') {
    const href = resolveChatbotRoute(str(b.route), b.params ?? undefined, user);
    return href ? { type: 'action', kind: 'navigate', id, label, href } : null;
  }

  if (b.kind === 'tool') {
    const prompt = str(b.prompt);
    if (!prompt || prompt.length > 300 || !isObj(b.confirm)) return null;
    return {
      type: 'action',
      kind: 'tool',
      id,
      label,
      prompt,
      confirm: {
        title: str(b.confirm.title).slice(0, 60) || label,
        message: str(b.confirm.message).slice(0, 300) || prompt,
      },
    };
  }

  return null;
}

function suggestionsBlock(b: Record<string, unknown>): ChatbotUiSuggestions | null {
  if (!Array.isArray(b.items)) return null;
  const seen = new Set<string>();
  const items: ChatbotSuggestion[] = [];
  for (let i = 0; i < b.items.length; i += 1) {
    const raw = b.items[i];
    if (isObj(raw)) {
      const label = str(raw.label).slice(0, 60);
      if (label && !seen.has(label.toLowerCase())) {
        seen.add(label.toLowerCase());
        items.push({ label, prompt: str(raw.prompt).slice(0, 200) || label });
        if (items.length >= CHATBOT_BLOCK_LIMITS.suggestionItems) break;
      }
    }
  }
  return items.length ? { type: 'suggestions', items } : null;
}

/** Khối thô (sự kiện completed / lịch sử) → khối hiển thị được cho người dùng này. Không phải mảng → []. */
export function normalizeChatbotBlocks(raw: unknown, user: ChatbotRouteUser): ChatbotUiBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatbotUiBlock[] = [];
  const count = { image: 0, link: 0, action: 0, suggestions: 0 };
  // Model hay lặp cùng một link / ảnh → chỉ giữ một (url cũng là key khi vẽ).
  const seen = new Set<string>();

  for (let i = 0; i < raw.length && out.length < CHATBOT_BLOCK_LIMITS.total; i += 1) {
    const b = raw[i];
    if (isObj(b)) {
      if (b.type === 'image' && count.image < CHATBOT_BLOCK_LIMITS.image) {
        const block = imageBlock(b);
        if (block && !seen.has(`image:${block.src}`)) {
          seen.add(`image:${block.src}`);
          out.push(block);
          count.image += 1;
        }
      } else if (b.type === 'link' && count.link < CHATBOT_BLOCK_LIMITS.link) {
        const block = linkBlock(b);
        if (block && !seen.has(`link:${block.url}`)) {
          seen.add(`link:${block.url}`);
          out.push(block);
          count.link += 1;
        }
      } else if (b.type === 'action' && count.action < CHATBOT_BLOCK_LIMITS.action) {
        const block = actionBlock(b, user, str(b.id) || `a${count.action + 1}`);
        if (block) {
          out.push(block);
          count.action += 1;
        }
      } else if (b.type === 'suggestions' && count.suggestions < CHATBOT_BLOCK_LIMITS.suggestions) {
        const block = suggestionsBlock(b);
        if (block) {
          out.push(block);
          count.suggestions += 1;
        }
      }
      // loại lạ → bỏ
    }
  }
  return out;
}

/** Gợi ý câu hỏi tiếp theo của một câu trả lời (khối suggestions đầu tiên). */
export function suggestionsOf(blocks: ChatbotUiBlock[]): ChatbotSuggestion[] {
  const block = blocks.find((b): b is ChatbotUiSuggestions => b.type === 'suggestions');
  return block ? block.items : [];
}

// ---------------------------------------------------------------------- văn bản

const UI_FENCE = /(^|\n)[ \t]*```[ \t]*spark[\s\S]*$/i;

/**
 * Cắt khối máy ```spark… (nút / ảnh / gợi ý dạng thô) tới hết văn bản — kể cả khối chưa đóng khi
 * đang stream. Server đã cắt; ở đây cắt thêm lần nữa cho chắc.
 */
export function stripUiFence(text: string): string {
  const m = UI_FENCE.exec(text);
  return m ? text.slice(0, m.index).replace(/\s+$/, '') : text;
}

// ---------------------------------------------------------------------- nhãn tiến độ

const DEFAULT_TOOL_LABEL = 'Đang tra cứu dữ liệu';
const PREPARING_LABEL = 'Đang chuẩn bị';
const SHIFT_LABEL = 'Đang tra cứu ca làm';
const PAYROLL_LABEL = 'Đang tra cứu lương';
const ATTENDANCE_LABEL = 'Đang tra cứu chấm công';

// Theo TIỀN TỐ tên tool (đã đổi "-" và "." thành "_"). Thứ tự quan trọng: mục cụ thể trước.
const TOOL_LABELS: readonly (readonly [RegExp, string])[] = [
  [/^load_tools/, PREPARING_LABEL],
  [/^vision/, 'Đang xem ảnh'],
  [/^analytics_/, 'Đang xem báo cáo'],
  [/^attendance_/, ATTENDANCE_LABEL],
  [/^payroll_/, PAYROLL_LABEL],
  [/^shifts?_/, SHIFT_LABEL],
  [/^(orders|kiotviet|pos_cart)_/, 'Đang tra cứu đơn hàng'],
  [/^(inventory|products|stocktake)_/, 'Đang tra cứu hàng hoá'],
  [/^employees_/, 'Đang tra cứu nhân viên'],
  [/^(cash|expense|settlement)_/, 'Đang tra cứu thu chi'],
  [/^customers_/, 'Đang tra cứu khách hàng'],
  [/^(purchase|supplier)_/, 'Đang tra cứu nhập hàng'],
];

// Tool tự phục vụ của nhân viên (staff_*): xét phần đứng sau.
const STAFF_TOOL_LABELS: readonly (readonly [RegExp, string])[] = [
  [/payroll|salary|penalt/, PAYROLL_LABEL],
  [/schedule|registration|shift/, SHIFT_LABEL],
  [/attendance|checkin|checkout/, ATTENDANCE_LABEL],
];

const VI_DIACRITICS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
/** Chuỗi kiểu định danh máy: snake_case hoặc có dấu chấm (analytics_revenue_read, orders.read). */
const RAW_IDENTIFIER = /[a-z0-9]+[_.][a-z0-9_.-]+/i;

/** Nhãn server gửi là câu chữ cho người đọc (có dấu tiếng Việt, không lẫn tên tool)? */
function isHumanLabel(label: string, name?: string | null): boolean {
  if (!label || !VI_DIACRITICS.test(label) || RAW_IDENTIFIER.test(label)) return false;
  if (name && label.toLowerCase().includes(name.toLowerCase())) return false;
  return true;
}

function normalizeToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^mcp__[a-z0-9-]+__/, '')
    .replace(/[-.]/g, '_');
}

/**
 * Nhãn "Đang …" cho một bước gọi tool. Chỉ dùng nhãn của server khi nó rõ ràng không phải tên tool
 * thô; còn lại suy theo tiền tố tên tool; không nhận ra → "Đang tra cứu dữ liệu".
 */
export function friendlyToolLabel(name?: string | null, label?: string | null): string {
  const serverLabel = (label ?? '').trim().replace(/[.…\s]+$/, '');
  if (isHumanLabel(serverLabel, name)) return serverLabel;

  const tool = normalizeToolName((name || label || '').trim());
  if (!tool) return DEFAULT_TOOL_LABEL;

  if (tool.startsWith('staff_')) {
    const rest = tool.slice('staff_'.length);
    const staffMatch = STAFF_TOOL_LABELS.find(([pattern]) => pattern.test(rest));
    return staffMatch ? staffMatch[1] : DEFAULT_TOOL_LABEL;
  }

  const match = TOOL_LABELS.find(([pattern]) => pattern.test(tool));
  return match ? match[1] : DEFAULT_TOOL_LABEL;
}

type ProgressInput = {
  steps?: ChatbotStep[] | null;
  /** Sự kiện status gần nhất của lượt đang chạy (hook: activity). */
  activity?: { kind: 'thinking' | 'tool'; name: string | null; label: string } | null;
  hasContent: boolean;
};

/** Dòng chữ cạnh chấm "đang trả lời" trong bong bóng của câu đang chạy. */
export function progressLabel({ steps, activity, hasContent }: ProgressInput): string {
  const list = steps ?? [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].state === 'running') return `${friendlyToolLabel(list[i].name, list[i].label)}…`;
  }
  if (activity?.kind === 'tool') return `${friendlyToolLabel(activity.name, activity.label)}…`;
  if (activity?.kind === 'thinking') return 'Đang suy nghĩ…';
  // Tra cứu xong hết mà chưa có chữ nào → đang viết câu trả lời.
  if (list.length > 0 && !hasContent) return 'Đang tổng hợp câu trả lời…';
  return 'Đang trả lời…';
}

/**
 * Một dòng tóm tắt các bước đã làm của câu trả lời đã xong: "Đã xem báo cáo, tra cứu chấm công".
 * Gộp nhãn trùng, bỏ bước chuẩn bị và bước lỗi; không có gì đáng kể → null.
 */
export function summarizeSteps(steps?: ChatbotStep[] | null): string | null {
  if (!steps || steps.length === 0) return null;
  const labels: string[] = [];
  steps.forEach((step) => {
    if (step.state === 'error') return;
    const label = friendlyToolLabel(step.name, step.label);
    if (label === PREPARING_LABEL || labels.includes(label)) return;
    labels.push(label);
  });
  if (labels.length === 0) return null;

  const MAX = 4;
  const shown = labels.slice(0, MAX).map((label) => {
    const text = label.replace(/^Đang\s+/i, '');
    return text === label ? text.charAt(0).toLocaleLowerCase('vi') + text.slice(1) : text;
  });
  const more = labels.length > MAX ? ` và ${labels.length - MAX} bước khác` : '';
  return `Đã ${shown.join(', ')}${more}`;
}
