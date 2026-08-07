import { NextRequest } from 'next/server';

// Proxy DELETE /agent-chat/{sessionId} -> agent-middleware /v1/sessions/{id}. Dùng khi user bấm
// "Phiên mới": xoá hẳn phiên+lịch sử cũ (không phải chỉ bỏ qua) trước khi tạo/tiếp tục phiên mới.

export const dynamic = 'force-dynamic';

const AGENT_MIDDLEWARE_URL =
  process.env.AGENT_MIDDLEWARE_URL || 'http://agent-middleware.ai.svc.cluster.local:8000';
const AGENT_CLIENT_API_KEY = process.env.AGENT_CLIENT_API_KEY;

export async function DELETE(request: NextRequest, { params }: { params: { sessionId: string } }) {
  const headers: Record<string, string> = {};
  const incomingAuth = request.headers.get('authorization');
  if (incomingAuth) {
    headers.Authorization = incomingAuth;
  } else if (AGENT_CLIENT_API_KEY) {
    headers['X-Client-Api-Key'] = AGENT_CLIENT_API_KEY;
  }

  const upstream = await fetch(`${AGENT_MIDDLEWARE_URL}/v1/sessions/${encodeURIComponent(params.sessionId)}`, {
    method: 'DELETE',
    headers,
  });

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
