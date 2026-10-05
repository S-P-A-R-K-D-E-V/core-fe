import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export type ChatbotOwnerType = 'Guest' | 'User' | 'Customer';
export type ChatbotAgent = 'CustomerSupport' | 'InternalAdmin' | 'Staff';

/** Tầng trợ lý server chọn cho người hỏi (AssistantTiers phía core-be). */
export type ChatbotTier =
  | 'cici_admin'
  | 'cici_staff'
  | 'cici_customer'
  | 'store_admin'
  | 'store_manager'
  | 'none';

export type ChatbotSession = {
  sessionId: string;
  ownerType: ChatbotOwnerType;
  agent: ChatbotAgent;
  /** Server cũ không trả trường này. */
  tier?: ChatbotTier | null;
  displayName?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

/** Độ dài tối đa của một câu hỏi (ChatbotController.MaxContentLength). */
export const CHATBOT_MAX_CONTENT_LENGTH = 2000;

export type ChatbotMessageStatus = 'pending' | 'complete' | 'error';

/** Một bước tra cứu (gọi tool) của câu trả lời. */
export type ChatbotStep = {
  id: string;
  kind?: string;
  name?: string | null;
  label?: string | null;
  state: 'running' | 'done' | 'error';
};

export type ChatbotSuggestion = { label: string; prompt: string };

// Khối có cấu trúc của câu trả lời (ChatMessageBlock phía core-be): MỘT object phẳng, phân biệt bằng
// `type` (và `kind` với nút). Nội dung do model viết nên trước khi hiển thị luôn đi qua
// normalizeChatbotBlocks (src/components/chatbot/chatbot-blocks.ts) — kiểu dưới đây chỉ mô tả dạng dây.
export type ChatbotSuggestionsBlock = { type: 'suggestions'; items: ChatbotSuggestion[] };

export type ChatbotNavigateActionBlock = {
  type: 'action';
  kind: 'navigate';
  id?: string;
  label: string;
  /** Khoá route trong AssistantRouteCatalog (vd "payroll-cycle"). */
  route: string;
  params?: Record<string, string> | null;
};

export type ChatbotToolActionBlock = {
  type: 'action';
  kind: 'tool';
  id?: string;
  label: string;
  /** Câu gửi thay người dùng SAU KHI họ xác nhận — nút không bao giờ tự chạy gì. */
  prompt: string;
  confirm: { title: string; message: string };
};

export type ChatbotLinkBlock = { type: 'link'; url: string; title?: string };

export type ChatbotImageBlock = { type: 'image'; url?: string; objectKey?: string; alt?: string };

export type ChatbotBlock =
  | ChatbotSuggestionsBlock
  | ChatbotNavigateActionBlock
  | ChatbotToolActionBlock
  | ChatbotLinkBlock
  | ChatbotImageBlock;

/** Tệp người dùng gửi kèm (hiện chỉ app mobile gửi ảnh) — `url` là đường dẫn /media đã ký có hạn. */
export type ChatbotAttachment = {
  kind: string;
  url?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  fileName?: string | null;
};

export type ChatbotMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  fromCache?: boolean;
  /** Phiên bản hợp đồng tin nhắn (v1 = có status/blocks/steps). Tin cũ không có. */
  v?: number;
  status?: ChatbotMessageStatus;
  errorCode?: string | null;
  steps?: ChatbotStep[] | null;
  blocks?: ChatbotBlock[] | null;
  attachments?: ChatbotAttachment[] | null;
};

export type SendMessageResponse = {
  messageId: string;
  assistantMessageId: string;
  fromCache: boolean;
  cachedAnswer?: string | null;
};

export async function startChatbotSession(params: {
  sessionId?: string | null;
  phone?: string | null;
  displayName?: string | null;
  /**
   * "Trò chuyện mới": người đăng nhập luôn nhận phiên mới (phiên cũ server giữ làm lưu trữ). Không có
   * cờ này server NỐI LẠI phiên gần nhất của người đó.
   */
  newSession?: boolean;
}): Promise<ChatbotSession> {
  const res = await axios.post(endpoints.chatbot.startSession, {
    sessionId: params.sessionId ?? null,
    phone: params.phone ?? null,
    displayName: params.displayName ?? null,
    newSession: params.newSession ?? false,
  });
  return res.data;
}

export async function getChatbotMessages(sessionId: string, limit = 50): Promise<ChatbotMessage[]> {
  const res = await axios.get(endpoints.chatbot.messages(sessionId), { params: { limit } });
  return res.data;
}

export async function sendChatbotMessage(params: {
  sessionId: string;
  content: string;
  phone?: string | null;
}): Promise<SendMessageResponse> {
  const res = await axios.post(endpoints.chatbot.sendMessage, {
    sessionId: params.sessionId,
    content: params.content,
    phone: params.phone ?? null,
  });
  return res.data;
}

export async function getChatbotStock(keyword: string) {
  const res = await axios.get(endpoints.chatbot.stockContext, { params: { keyword } });
  return res.data;
}

export async function chatbotCallbackOrder(params: {
  sessionId: string;
  phone: string;
  note?: string;
  content?: string;
}) {
  const res = await axios.post(endpoints.chatbot.callbackOrder, params);
  return res.data;
}
