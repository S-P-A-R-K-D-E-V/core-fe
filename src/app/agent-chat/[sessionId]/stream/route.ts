import { NextRequest } from 'next/server';

// Proxy GET /agent-chat/{sessionId}/stream -> agent-middleware GET /v1/sessions/{id}/stream — kênh
// SSE dài hạn để tab khách đang mở nhận tin nhắn nhân viên gõ tay (human handoff), không phải
// luồng AI trả lời bình thường (luồng đó vẫn qua POST /agent-chat/ như cũ).

export const dynamic = 'force-dynamic';

const AGENT_MIDDLEWARE_URL =
  process.env.AGENT_MIDDLEWARE_URL || 'http://agent-middleware.ai.svc.cluster.local:8000';
const AGENT_CLIENT_API_KEY = process.env.AGENT_CLIENT_API_KEY;

export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  const headers: Record<string, string> = {};
  const incomingAuth = request.headers.get('authorization');
  if (incomingAuth) {
    headers.Authorization = incomingAuth;
  } else if (AGENT_CLIENT_API_KEY) {
    headers['X-Client-Api-Key'] = AGENT_CLIENT_API_KEY;
  }

  const upstream = await fetch(
    `${AGENT_MIDDLEWARE_URL}/v1/sessions/${encodeURIComponent(params.sessionId)}/stream`,
    {
      headers,
    }
  );

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
