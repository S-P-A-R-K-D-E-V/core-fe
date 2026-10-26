// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiStreamError, streamStorePostAi } from '../store-posts-stream';

// ----------------------------------------------------------------------
// Bộ đọc Server-Sent Events của trợ lý AI viết bài: sự kiện bị cắt ngang giữa các gói mạng, dòng ": ping" giữ kết nối,
// sự kiện "error" thành lỗi có lời nhắn tiếng Việt, mất kết nối giữa chừng không treo.
// ----------------------------------------------------------------------

vi.mock('src/utils/axios', () => ({
  default: { defaults: { headers: { common: { Authorization: 'Bearer t0k' } } } },
}));

function sse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
  return vi.fn().mockResolvedValue(new Response(body, { status }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamStorePostAi', () => {
  it('ghép sự kiện bị cắt giữa các gói, bỏ ping, trả kết quả cuối', async () => {
    const fetchMock = sse([
      ': ping\n\n',
      'event: step\ndata: {"key":"write","te',
      'xt":"AI đang viết"}\n\nevent: thinking\ndata: {"text":"nghĩ"}\n\n',
      'event: delta\ndata: {"text":"Xin "}\n\nevent: delta\ndata: {"text":"chào"}\n\n',
      'event: result\ndata: {"html":"<p>Xin chào</p>"}\n\n',
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const events: unknown[] = [];

    const result = await streamStorePostAi<{ html: string }>('ai/rewrite/stream', { html: 'x' }, (e) => events.push(e));

    expect(result).toEqual({ html: '<p>Xin chào</p>' });
    expect(events).toEqual([
      { type: 'step', key: 'write', text: 'AI đang viết' },
      { type: 'thinking', text: 'nghĩ' },
      { type: 'delta', text: 'Xin ' },
      { type: 'delta', text: 'chào' },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/store-posts-ai/ai/rewrite/stream');
    expect(init.headers.Authorization).toBe('Bearer t0k');
  });

  it('sự kiện error thành AiStreamError với lời nhắn của máy chủ', async () => {
    vi.stubGlobal(
      'fetch',
      sse(['event: error\ndata: {"code":"StorePost.AiFailed","message":"AI đang bận"}\n\n'])
    );

    await expect(streamStorePostAi('ai/seo/stream', {}, () => {})).rejects.toThrow(
      new AiStreamError('AI đang bận')
    );
  });

  it('mất kết nối trước khi có kết quả thì báo lỗi, không treo', async () => {
    vi.stubGlobal('fetch', sse(['event: step\ndata: {"key":"context","text":"Đọc"}\n\n']));

    await expect(streamStorePostAi('ai/draft/stream', {}, () => {})).rejects.toThrow(/ngắt giữa chừng/);
  });

  it('401 thì nhắc đăng nhập lại', async () => {
    vi.stubGlobal('fetch', sse([], 401));

    await expect(streamStorePostAi('ai/ideas/stream', {}, () => {})).rejects.toThrow(/đăng nhập/);
  });
});
