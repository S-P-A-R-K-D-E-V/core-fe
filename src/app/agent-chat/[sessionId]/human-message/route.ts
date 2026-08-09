import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const AGENT_MIDDLEWARE_URL =
  process.env.AGENT_MIDDLEWARE_URL || 'http://agent-middleware.ai.svc.cluster.local:8000';

export async function POST(request: NextRequest, { params }: { params: { sessionId: string } }) {
  const incomingAuth = request.headers.get('authorization');
  if (!incomingAuth) {
    return new Response(JSON.stringify({ detail: 'Thiếu Authorization' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.text();
  const upstream = await fetch(
    `${AGENT_MIDDLEWARE_URL}/v1/sessions/${encodeURIComponent(params.sessionId)}/human-message`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: incomingAuth },
      body,
    }
  );

  const data = await upstream.text();
  return new Response(data, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
