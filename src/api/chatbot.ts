import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------

export type ChatbotOwnerType = 'Guest' | 'User' | 'Customer';
export type ChatbotAgent = 'CustomerSupport' | 'InternalAdmin';

export type ChatbotSession = {
  sessionId: string;
  ownerType: ChatbotOwnerType;
  agent: ChatbotAgent;
  displayName?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

export type ChatbotMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  fromCache?: boolean;
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
}): Promise<ChatbotSession> {
  const res = await axios.post(endpoints.chatbot.startSession, {
    sessionId: params.sessionId ?? null,
    phone: params.phone ?? null,
    displayName: params.displayName ?? null,
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
