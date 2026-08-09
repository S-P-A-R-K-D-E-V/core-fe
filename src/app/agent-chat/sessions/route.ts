import { NextRequest } from 'next/server';

// Proxy GET /agent-chat/sessions -> agent-middleware GET /v1/sessions (Admin/Manager only — role
// check thật nằm ở agent-middleware, route này chỉ forward JWT, không tự ý gắn X-Client-Api-Key
// vì đây luôn là thao tác nội bộ, không có khái niệm "khách ẩn danh" cho endpoint này.

export const dynamic = 'force-dynamic';

const AGENT_MIDDLEWARE_URL =
  process.env.AGENT_MIDDLEWARE_URL || 'http://agent-middleware.ai.svc.cluster.local:8000';

export async function GET(request: NextRequest) {
  const incomingAuth = request.headers.get('authorization');
  if (!incomingAuth) {
    return new Response(JSON.stringify({ detail: 'Thiếu Authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const upstream = await fetch(`${AGENT_MIDDLEWARE_URL}/v1/sessions`, {
    headers: { Authorization: incomingAuth },
  });

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
