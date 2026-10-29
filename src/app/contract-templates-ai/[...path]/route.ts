import type { NextRequest } from 'next/server';

// ----------------------------------------------------------------------
// Chuyển tiếp stream (Server-Sent Events) của lệnh tải mẫu hợp đồng (đọc .docx / .pdf + AI gắn trường) từ core-api về trình
// duyệt. Không đi qua rewrites của next.config.mjs: proxy đó cắt kết nối khi AI chạy lâu và không chuyển dần từng sự kiện —
// trước đây tải mẫu chờ xong không thấy gì. Chỉ đường import/stream của mẫu; JWT người dùng gửi kèm như mọi lệnh khác.
// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

const ALLOWED = /^templates\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/import\/stream$/i;

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  if (!ALLOWED.test(path)) return new Response('Not found', { status: 404 });

  const backendUrl = process.env.BACKEND_URL || 'http://core-api:5000';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    // core-api xác định cửa hàng theo tên miền đang mở (middleware đã gắn header này cho mọi request).
    'X-Tenant-Domain': request.headers.get('x-tenant-domain') || request.headers.get('host') || '',
  };
  const auth = request.headers.get('authorization');
  if (auth) headers.Authorization = auth;

  const upstream = await fetch(`${backendUrl}/employment-contracts/${path}`, {
    method: 'POST',
    headers,
    body: await request.text(),
    signal: request.signal,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
