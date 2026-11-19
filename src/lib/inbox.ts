// ----------------------------------------------------------------------
// Hộp thư khách (F2, core-be /conversations/*). Hợp đồng: docs/cici/plans/fb-inbox-api-contract.md.
// Kiểu dữ liệu + hàm thuần (nhãn người giữ, cửa sổ 24 giờ của Meta, mẫu trả lời nhanh "/", gộp sự kiện trực tiếp vào cache).
// ----------------------------------------------------------------------

export type HolderType = 'agent' | 'user' | 'external' | 'none';

export type ConversationStatus = 'open' | 'closed' | 'spam';

export type SenderType = 'customer' | 'agent' | 'user' | 'external' | 'system';

export type ConversationHolder = {
  type: HolderType;
  userId: string | null;
  name: string | null;
  since: string | null;
};

export type ConversationSummary = {
  id: string;
  channelId: string;
  /** Tên page / "Kênh thử". */
  channelName: string;
  platform: 'facebook' | 'test' | string;
  kind: 'dm' | 'comment';
  customer: {
    id: string | null;
    name: string;
    avatarUrl: string | null;
    phone: string | null;
    code: string | null;
  };
  lastMessage: { text: string; direction: 'in' | 'out'; senderType: SenderType; at: string } | null;
  unreadCount: number;
  status: ConversationStatus;
  holder: ConversationHolder;
  holderVersion: number;
  assignedUserId: string | null;
  assignedName: string | null;
  tags: string[];
  lastCustomerMessageAt: string | null;
  /** Hết cửa sổ 24 giờ của Meta (null = không áp / chưa có tin khách). */
  windowEndsAt: string | null;
  lastMessageAt: string;
};

export type MessageAttachment = {
  type: 'image' | 'video' | 'audio' | 'file' | 'link';
  url: string;
  name: string | null;
};

export type MessageStatus = 'sending' | 'sent' | 'failed' | 'received';

export type ConversationMessage = {
  id: string;
  conversationId: string;
  direction: 'in' | 'out';
  senderType: SenderType;
  /** Tên nhân viên / "Agent CSKH" / tên khách. */
  senderName: string | null;
  text: string | null;
  attachments: MessageAttachment[];
  status: MessageStatus;
  error: string | null;
  /** Ghi chú nội bộ, không gửi khách. */
  isInternalNote: boolean;
  sentAt: string;
};

export type CustomerInvoice = {
  id: string;
  code: string;
  total: number;
  createdAt: string;
  channel: string | null;
};

export type CustomerPanel = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  source: string | null;
  tags: string[];
  avatarUrl: string | null;
  totalOrders: number;
  totalSpent: number;
  lastPurchaseAt: string | null;
  /** ≤ 5 hoá đơn gần nhất. */
  recentInvoices: CustomerInvoice[];
};

export type ConversationDetail = ConversationSummary & {
  customerPanel: CustomerPanel | null;
  canReply: boolean;
  reason: string | null;
};

export type InboxBox = 'unassigned' | 'mine' | 'agent' | 'external' | 'all';

export type InboxSummary = {
  unassigned: number;
  mine: number;
  agent: number;
  external: number;
  unread: number;
  open: number;
};

export type ConversationPage = { items: ConversationSummary[]; nextBefore: string | null };

export type MessagePage = { items: ConversationMessage[]; nextBefore: string | null };

export type QuickReply = {
  id: string;
  shortcut: string;
  title: string;
  text: string;
  imageUrls: string[];
  sortOrder: number;
};

export type QuickReplyInput = Omit<QuickReply, 'id'>;

export type AgentMode = 'off' | 'suggest' | 'auto';

export type ConversationSettings = {
  agentMode: AgentMode;
  assistantName: string;
  openHours: { from: string; to: string };
  offHoursMessage: string | null;
  autoReturnMinutes: number | null;
  hidePhoneComments: boolean;
  approvalEscalateMinutes: number;
};

export type SendMessageInput = { text?: string; imageUrls?: string[]; internalNote?: boolean };

export type CustomerUpdateInput = {
  name?: string;
  phone?: string;
  address?: string;
  note?: string;
};

export type TestInboundInput = {
  customerName: string;
  text?: string;
  imageUrls?: string[];
  conversationId?: string;
};

/** Bộ lọc danh sách hội thoại (query của GET conversations). */
export type ConversationListFilter = {
  box: InboxBox;
  channelId?: string | null;
  q?: string | null;
  tag?: string | null;
  status?: ConversationStatus | null;
};

// ----------------------------------------------------------------------
// Hằng số / nhãn.

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_MAX_IMAGES = 10;
export const TAG_MAX_COUNT = 10;
export const TAG_MAX_LENGTH = 30;
export const SHORTCUT_MAX_LENGTH = 30;
/** Còn dưới mức này thì hiện cảnh báo cửa sổ 24 giờ ở ô gõ. */
export const WINDOW_WARN_MS = 3 * 60 * 60 * 1000;

export const INBOX_BOXES: { value: InboxBox; label: string; countKey: keyof InboxSummary | null }[] = [
  { value: 'unassigned', label: 'Chưa ai nhận', countKey: 'unassigned' },
  { value: 'mine', label: 'Của tôi', countKey: 'mine' },
  { value: 'agent', label: 'Agent', countKey: 'agent' },
  { value: 'external', label: 'Trên Facebook', countKey: 'external' },
  { value: 'all', label: 'Tất cả', countKey: 'open' },
];

export const STATUS_LABEL: Record<ConversationStatus, string> = {
  open: 'Đang mở',
  closed: 'Đã đóng',
  spam: 'Spam',
};

export const AGENT_MODE_LABEL: Record<AgentMode, string> = {
  off: 'Tắt — chỉ người trả lời',
  suggest: 'Gợi ý — agent soạn sẵn, người gửi',
  auto: 'Tự động — agent trả lời, người giành khi cần',
};

export function isInboxBox(value: string | null | undefined): value is InboxBox {
  return INBOX_BOXES.some((b) => b.value === value);
}

export function platformIcon(platform: string): string {
  if (platform === 'facebook') return 'logos:facebook';
  if (platform === 'test') return 'solar:test-tube-bold';
  return 'solar:chat-round-dots-bold';
}

export function platformLabel(platform: string): string {
  if (platform === 'facebook') return 'Facebook';
  if (platform === 'test') return 'Kênh thử';
  return platform;
}

// ----------------------------------------------------------------------
// Người giữ hội thoại.

export function isHeldByMe(holder: ConversationHolder, myUserId: string | null | undefined): boolean {
  return holder.type === 'user' && !!myUserId && holder.userId === myUserId;
}

/** Người khác (nhân viên khác trong hệ thống) đang giữ — gửi / giành sẽ bị 409 trừ khi giành bằng quyền quản lý. */
export function isHeldByOther(holder: ConversationHolder, myUserId: string | null | undefined): boolean {
  return holder.type === 'user' && !isHeldByMe(holder, myUserId);
}

/** "Đang do Trà My trả lời" / "Agent đang trả lời" / "Nhân viên trả lời trên Facebook" / "Chưa ai nhận". */
export function holderLabel(holder: ConversationHolder, myUserId?: string | null): string {
  switch (holder.type) {
    case 'agent':
      return 'Agent đang trả lời';
    case 'external':
      return 'Nhân viên trả lời trên Facebook';
    case 'user':
      if (isHeldByMe(holder, myUserId)) return 'Bạn đang trả lời';
      return `Đang do ${holder.name?.trim() || 'nhân viên khác'} trả lời`;
    default:
      return 'Chưa ai nhận';
  }
}

/** Tên ngắn cho chip ở danh sách. */
export function holderShortLabel(holder: ConversationHolder, myUserId?: string | null): string {
  switch (holder.type) {
    case 'agent':
      return 'Agent';
    case 'external':
      return 'Trên Facebook';
    case 'user':
      return isHeldByMe(holder, myUserId) ? 'Bạn' : holder.name?.trim() || 'Nhân viên';
    default:
      return 'Chưa ai nhận';
  }
}

export type HolderColor = 'default' | 'primary' | 'info' | 'warning' | 'success' | 'error';

export function holderColor(holder: ConversationHolder, myUserId?: string | null): HolderColor {
  switch (holder.type) {
    case 'agent':
      return 'info';
    case 'external':
      return 'warning';
    case 'user':
      return isHeldByMe(holder, myUserId) ? 'success' : 'primary';
    default:
      return 'error';
  }
}

export function senderLabel(message: Pick<ConversationMessage, 'senderType' | 'senderName'>): string {
  const name = message.senderName?.trim();
  switch (message.senderType) {
    case 'agent':
      return name || 'Agent CSKH';
    case 'external':
      return name || 'Nhân viên (trên Facebook)';
    case 'system':
      return name || 'Hệ thống';
    case 'customer':
      return name || 'Khách';
    default:
      return name || 'Nhân viên';
  }
}

// ----------------------------------------------------------------------
// Cửa sổ 24 giờ của Meta.

/** "2 giờ 15 phút" / "45 phút" / "dưới 1 phút". */
export function formatDurationVi(ms: number): string {
  if (ms < 60_000) return 'dưới 1 phút';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} phút`;
  if (minutes === 0) return `${hours} giờ`;
  return `${hours} giờ ${minutes} phút`;
}

export type WindowState =
  | { kind: 'none' }
  | { kind: 'open'; msLeft: number; warn: boolean; text: string }
  | { kind: 'closed'; text: string };

/** Trạng thái cửa sổ 24 giờ; `warn` khi còn dưới 3 giờ. */
export function windowState(windowEndsAt: string | null | undefined, now: number = Date.now()): WindowState {
  if (!windowEndsAt) return { kind: 'none' };
  const end = new Date(windowEndsAt).getTime();
  if (Number.isNaN(end)) return { kind: 'none' };
  const msLeft = end - now;
  if (msLeft <= 0) {
    return { kind: 'closed', text: 'Đã quá 24 giờ từ tin cuối của khách — Meta không cho gửi tin thường.' };
  }
  return {
    kind: 'open',
    msLeft,
    warn: msLeft < WINDOW_WARN_MS,
    text: `Còn ${formatDurationVi(msLeft)} để trả lời (cửa sổ 24 giờ của Meta).`,
  };
}

// ----------------------------------------------------------------------
// Mẫu trả lời nhanh: gõ "/gia" trong ô gõ → gợi ý mẫu có shortcut khớp.

export type SlashQuery = { query: string; start: number };

/** Từ cuối ô gõ có dạng "/abc" (đầu dòng hoặc sau khoảng trắng) → { query: 'abc', start }; không thì null. */
export function parseSlashQuery(text: string): SlashQuery | null {
  const match = /(^|\s)\/([\p{L}\p{N}_-]*)$/u.exec(text);
  if (!match) return null;
  const start = match.index + match[1].length;
  return { query: match[2], start };
}

/** Bỏ dấu tiếng Việt + chữ thường (đ → d). */
export function foldVi(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

/** Mẫu khớp `query`: shortcut bắt đầu bằng query đứng trước, rồi shortcut / tiêu đề chứa query; trong nhóm theo sortOrder. */
export function filterQuickReplies(replies: readonly QuickReply[], query: string): QuickReply[] {
  const q = foldVi(query.trim());
  const bySort = (a: QuickReply, b: QuickReply) =>
    a.sortOrder - b.sortOrder || a.shortcut.localeCompare(b.shortcut);
  if (!q) return [...replies].sort(bySort);

  const prefix: QuickReply[] = [];
  const contains: QuickReply[] = [];
  replies.forEach((r) => {
    const shortcut = foldVi(r.shortcut);
    if (shortcut.startsWith(q)) prefix.push(r);
    else if (shortcut.includes(q) || foldVi(r.title).includes(q)) contains.push(r);
  });
  return [...prefix.sort(bySort), ...contains.sort(bySort)];
}

/** Thay "/abc" ở cuối ô gõ bằng nội dung mẫu. */
export function applyQuickReply(text: string, slash: SlashQuery, reply: Pick<QuickReply, 'text'>): string {
  return `${text.slice(0, slash.start)}${reply.text}`;
}

/** Shortcut hợp lệ: chữ thường / số / gạch, ≤ 30 ký tự (không có "/"). */
export function normalizeShortcut(value: string): string {
  return value.trim().replace(/^\/+/, '').toLowerCase();
}

export function isValidShortcut(value: string): boolean {
  return new RegExp(`^[a-z0-9-]{1,${SHORTCUT_MAX_LENGTH}}$`).test(value);
}

// ----------------------------------------------------------------------
// Nhãn hội thoại.

/** Bỏ khoảng trắng thừa, bỏ trùng (không phân biệt hoa thường), cắt ≤ 30 ký tự, ≤ 10 nhãn. */
export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  tags.forEach((raw) => {
    const tag = raw.replace(/\s+/g, ' ').trim().slice(0, TAG_MAX_LENGTH).trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key) || result.length >= TAG_MAX_COUNT) return;
    seen.add(key);
    result.push(tag);
  });
  return result;
}

// ----------------------------------------------------------------------
// Danh sách hội thoại: khoá + gộp sự kiện trực tiếp.

export function conversationListQuery(filter: ConversationListFilter, before?: string | null, take = 30): string {
  const params = new URLSearchParams();
  if (filter.box && filter.box !== 'all') params.set('box', filter.box);
  if (filter.channelId) params.set('channelId', filter.channelId);
  const q = filter.q?.trim();
  if (q) params.set('q', q);
  if (filter.tag) params.set('tag', filter.tag);
  params.set('status', filter.status ?? 'open');
  if (before) params.set('before', before);
  params.set('take', String(take));
  return params.toString();
}

/** Hội thoại có thuộc tab `box` không (giống máy chủ lọc). */
export function matchesBox(conv: ConversationSummary, box: InboxBox, myUserId: string | null | undefined): boolean {
  switch (box) {
    case 'unassigned':
      return conv.holder.type === 'none';
    case 'mine':
      return isHeldByMe(conv.holder, myUserId) || (!!myUserId && conv.assignedUserId === myUserId);
    case 'agent':
      return conv.holder.type === 'agent';
    case 'external':
      return conv.holder.type === 'external';
    default:
      return true;
  }
}

/** Hội thoại có còn khớp bộ lọc không. Tìm theo chữ (`q`) không đoán được ở máy khách → giữ nguyên chỗ cũ (null). */
export function matchesFilter(
  conv: ConversationSummary,
  filter: ConversationListFilter,
  myUserId: string | null | undefined
): boolean | null {
  if (!matchesBox(conv, filter.box, myUserId)) return false;
  if ((filter.status ?? 'open') !== conv.status) return false;
  if (filter.channelId && conv.channelId !== filter.channelId) return false;
  if (filter.tag && !conv.tags.includes(filter.tag)) return false;
  if (filter.q?.trim()) return null;
  return true;
}

function byLastMessageDesc(a: ConversationSummary, b: ConversationSummary) {
  return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
}

/**
 * Gộp một hội thoại vừa đổi (sự kiện conversationUpdated / kết quả take, release…) vào các trang danh sách:
 * còn khớp bộ lọc → thay chỗ cũ hoặc thêm, xếp lại theo tin mới nhất; không còn khớp → bỏ ra.
 */
export function upsertConversationPages(
  pages: ConversationPage[] | undefined,
  conv: ConversationSummary,
  filter: ConversationListFilter,
  myUserId: string | null | undefined
): ConversationPage[] | undefined {
  if (!pages || pages.length === 0) return pages;
  const match = matchesFilter(conv, filter, myUserId);
  const exists = pages.some((p) => p.items.some((c) => c.id === conv.id));

  if (match === false) {
    if (!exists) return pages;
    return pages.map((p) => ({ ...p, items: p.items.filter((c) => c.id !== conv.id) }));
  }
  if (match === null && !exists) return pages;

  // Gộp mọi trang thành một danh sách, sắp lại rồi chia lại đúng số dòng từng trang (trang cuối nhận phần dư).
  const all = pages.flatMap((p) => p.items).filter((c) => c.id !== conv.id);
  all.push(conv);
  all.sort(byLastMessageDesc);
  let offset = 0;
  return pages.map((p, i) => {
    const size = i === pages.length - 1 ? all.length - offset : p.items.length + (i === 0 && !exists ? 1 : 0);
    const items = all.slice(offset, offset + size);
    offset += size;
    return { ...p, items };
  });
}

/** Ghi các trường tóm tắt mới vào chi tiết hội thoại (giữ customerPanel / canReply / reason). */
export function mergeDetail(
  detail: ConversationDetail | undefined,
  conv: ConversationSummary
): ConversationDetail | undefined {
  if (!detail || detail.id !== conv.id) return detail;
  return { ...detail, ...conv };
}

/** Bỏ phần riêng của chi tiết (customerPanel / canReply / reason) để ghi vào danh sách. */
export function toSummary(detail: ConversationDetail): ConversationSummary {
  const { customerPanel, canReply, reason, ...summary } = detail;
  return summary;
}

// ----------------------------------------------------------------------
// Tin nhắn: trang 0 = mới nhất; mỗi trang xếp cũ → mới.

export function flattenMessages(pages: MessagePage[] | undefined): ConversationMessage[] {
  if (!pages) return [];
  const result: ConversationMessage[] = [];
  const seen = new Set<string>();
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    pages[i].items.forEach((m) => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      result.push(m);
    });
  }
  return result;
}

/** Thêm tin mới vào cuối trang mới nhất (bỏ qua khi đã có — hub và kết quả POST có thể về cùng lúc). */
export function addMessageToPages(pages: MessagePage[] | undefined, message: ConversationMessage): MessagePage[] | undefined {
  if (!pages || pages.length === 0) return [{ items: [message], nextBefore: null }];
  if (pages.some((p) => p.items.some((m) => m.id === message.id))) return updateMessageInPages(pages, message);
  const [first, ...rest] = pages;
  const items = [...first.items, message].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  );
  return [{ ...first, items }, ...rest];
}

export function updateMessageInPages(
  pages: MessagePage[] | undefined,
  message: ConversationMessage
): MessagePage[] | undefined {
  if (!pages) return pages;
  let changed = false;
  const next = pages.map((p) => {
    if (!p.items.some((m) => m.id === message.id)) return p;
    changed = true;
    return { ...p, items: p.items.map((m) => (m.id === message.id ? message : m)) };
  });
  return changed ? next : pages;
}

export function imageAttachments(message: Pick<ConversationMessage, 'attachments'>): MessageAttachment[] {
  return message.attachments.filter((a) => a.type === 'image');
}

/** 125000 → "125.000đ". */
export function fVnd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

/** Tóm tắt tin cuối ở danh sách: "Bạn: …" khi tin đi, "[Ảnh]" khi không có chữ. */
export function lastMessagePreview(conv: Pick<ConversationSummary, 'lastMessage'>): string {
  const last = conv.lastMessage;
  if (!last) return 'Chưa có tin nhắn';
  const text = last.text?.trim() || '[Ảnh / tệp]';
  if (last.direction === 'in') return text;
  const who = last.senderType === 'agent' ? 'Agent' : 'Shop';
  return `${who}: ${text}`;
}
