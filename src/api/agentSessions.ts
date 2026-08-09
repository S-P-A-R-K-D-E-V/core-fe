// Admin/Manager: theo dõi phiên chat agent đang hoạt động + human handoff (nhận phiên trả lời
// tay thay AI). Gọi qua Route Handler proxy `/agent-chat/*` (KHÔNG qua axios+core-be — agent-chat
// là service Python riêng, cùng convention với useChatbot).

export type AgentSessionSummary = {
  sessionId: string;
  control: 'ai' | 'human';
  assignedUserId: string | null;
  lastActive: number | null;
  tokenUsage: { prompt: number; completion: number; total: number };
  preview: string | null;
  ownerUserId: string | null;
};

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('accessToken') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`agent-chat trả lỗi ${res.status}: ${body}`);
  }
  return res.json();
}

export async function listActiveSessions(): Promise<AgentSessionSummary[]> {
  const res = await fetch('/agent-chat/sessions', { headers: authHeaders() });
  return parseJsonOrThrow<AgentSessionSummary[]>(res);
}

export async function claimSession(sessionId: string): Promise<void> {
  const res = await fetch(`/agent-chat/${sessionId}/claim`, {
    method: 'POST',
    headers: authHeaders(),
  });
  await parseJsonOrThrow(res);
}

export async function releaseSession(sessionId: string): Promise<void> {
  const res = await fetch(`/agent-chat/${sessionId}/release`, {
    method: 'POST',
    headers: authHeaders(),
  });
  await parseJsonOrThrow(res);
}

export async function sendHumanMessage(sessionId: string, content: string): Promise<void> {
  const res = await fetch(`/agent-chat/${sessionId}/human-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ content }),
  });
  await parseJsonOrThrow(res);
}

export type AgentSessionMessage = { role: string; content: string; createdAt: string };

export async function getSessionMessages(sessionId: string): Promise<AgentSessionMessage[]> {
  const res = await fetch(`/agent-chat/${sessionId}/messages/?limit=50`, {
    headers: authHeaders(),
  });
  const data = await parseJsonOrThrow<{ items: AgentSessionMessage[] }>(res);
  return data.items ?? [];
}
