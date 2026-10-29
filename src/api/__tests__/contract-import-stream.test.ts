// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContractImportError, streamContractTemplateImport } from '../contract-import-stream';

// ----------------------------------------------------------------------
// Tải mẫu hợp đồng dạng stream: bước → nội dung đọc được (đã lưu nháp) → kết quả có trường; lỗi có lời nhắn; mất kết nối
// trước kết quả không treo.
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

const template = { id: 't1', body: '<p>Họ tên: ……</p>' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamContractTemplateImport', () => {
  it('gửi tệp đã tải lên, nhận bước + nội dung rồi kết quả', async () => {
    const fetchMock = sse([
      ': ping\n\n',
      'event: step\ndata: {"key":"read","text":"Đang đọc tệp…"}\n\n',
      `event: content\ndata: ${JSON.stringify({ template })}\n\n`,
      'event: step\ndata: {"key":"ai","te',
      'xt":"AI đang gắn trường…"}\n\n',
      `event: result\ndata: ${JSON.stringify({ template: { ...template, body: '<p>Họ tên: {{ho_ten}}</p>' }, fieldsPlacedByAi: true, warning: null })}\n\n`,
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const events: unknown[] = [];

    const result = await streamContractTemplateImport('t1', { objectKey: 'k', fileName: 'a.docx' }, (e) => events.push(e));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/contract-templates-ai/templates/t1/import/stream');
    expect(init.headers.Authorization).toBe('Bearer t0k');
    expect(JSON.parse(init.body)).toEqual({ objectKey: 'k', fileName: 'a.docx' });
    expect(events).toEqual([
      { type: 'step', key: 'read', text: 'Đang đọc tệp…' },
      { type: 'content', template },
      { type: 'step', key: 'ai', text: 'AI đang gắn trường…' },
    ]);
    expect(result.fieldsPlacedByAi).toBe(true);
    expect(result.template.body).toContain('{{ho_ten}}');
  });

  it('sự kiện lỗi và mất kết nối thành lỗi có lời nhắn', async () => {
    vi.stubGlobal('fetch', sse(['event: error\ndata: {"code":"Contract.ImportUnreadable","message":"Không đọc được tệp PDF"}\n\n']));
    await expect(streamContractTemplateImport('t1', { objectKey: 'k', fileName: 'a.pdf' }, () => {})).rejects.toThrow(
      'Không đọc được tệp PDF'
    );

    vi.stubGlobal('fetch', sse([`event: content\ndata: ${JSON.stringify({ template })}\n\n`]));
    await expect(streamContractTemplateImport('t1', { objectKey: 'k', fileName: 'a.docx' }, () => {})).rejects.toBeInstanceOf(
      ContractImportError
    );

    vi.stubGlobal('fetch', sse([], 403));
    await expect(streamContractTemplateImport('t1', { objectKey: 'k', fileName: 'a.docx' }, () => {})).rejects.toThrow(
      'Phiên đăng nhập hết hạn'
    );
  });
});
