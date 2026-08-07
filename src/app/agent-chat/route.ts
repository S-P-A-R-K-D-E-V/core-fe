import { NextRequest } from 'next/server';

// Proxy server-side sang agent-middleware (ClusterIP, không Ingress — chỉ pod core-fe
// mới resolve được DNS nội bộ này). Không dùng next.config.mjs rewrites vì cần inject
// header có điều kiện: forward JWT thật nếu khách đã đăng nhập, gắn X-Client-Api-Key
// (secret server-only, không bao giờ lộ ra bundle client) nếu là khách ẩn danh.

export const dynamic = 'force-dynamic';

const AGENT_MIDDLEWARE_URL =
  process.env.AGENT_MIDDLEWARE_URL || 'http://agent-middleware.ai.svc.cluster.local:8000';
const AGENT_CLIENT_API_KEY = process.env.AGENT_CLIENT_API_KEY;

export async function POST(request: NextRequest) {
  const body = await request.text();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const incomingAuth = request.headers.get('authorization');
  if (incomingAuth) {
    headers.Authorization = incomingAuth;
  } else if (AGENT_CLIENT_API_KEY) {
    headers['X-Client-Api-Key'] = AGENT_CLIENT_API_KEY;
  }

  const upstream = await fetch(`${AGENT_MIDDLEWARE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
