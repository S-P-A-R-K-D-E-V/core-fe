import { it, vi, expect, describe } from 'vitest';

import type { ChatbotMessage } from 'src/api/chatbot';

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'x' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/lightbox', () => ({ default: () => null }));
vi.mock('src/api/purchase-imports', () => ({ getPurchaseImport: vi.fn() }));

// eslint-disable-next-line import/first
import { collectUploads, collectImportIds } from '../chatbot-admin-side-panel';

const message = (patch: Partial<ChatbotMessage>): ChatbotMessage => ({
  id: Math.random().toString(36).slice(2),
  role: 'user',
  content: '',
  createdAt: '2026-10-19T03:00:00Z',
  ...patch,
});

describe('cột phải Chatbot nội bộ', () => {
  const messages: ChatbotMessage[] = [
    message({
      id: 'u1',
      attachments: [
        { kind: 'image', url: '/media/assistant/a.jpg' },
        { kind: 'image', url: '/media/assistant/b.jpg' },
      ],
    }),
    message({
      id: 'a1',
      role: 'assistant',
      blocks: [{ type: 'purchase-import', importId: 'imp-1' }],
    }),
    message({
      id: 'u2',
      content: 'ảnh gì đây',
      attachments: [{ kind: 'image', url: 'blob:preview-1' }],
    }),
    message({ id: 'a2', role: 'assistant', content: 'Một cái mũ.' }),
    message({ id: 'u3', content: 'dòng 2 là kẹp' }),
    message({
      id: 'a3',
      role: 'assistant',
      blocks: [{ type: 'purchase-import', importId: 'imp-1' }],
    }),
    message({ id: 'u4', attachments: [{ kind: 'image', url: '/media/assistant/c.jpg' }] }),
    message({
      id: 'a4',
      role: 'assistant',
      blocks: [{ type: 'purchase-import', importId: 'imp-2' }],
    }),
  ];

  it('ảnh mới nhất trước, ảnh gửi kèm hoá đơn trỏ tới lần nhập do câu trả lời ngay sau tạo', () => {
    const uploads = collectUploads(messages);

    expect(uploads.map((u) => u.importId)).toEqual(['imp-2', null, 'imp-1', 'imp-1']);
    expect(uploads[1].src).toBe('blob:preview-1');
  });

  it('mỗi lần nhập một dòng, mới nhất trước', () => {
    expect(collectImportIds(messages)).toEqual(['imp-2', 'imp-1']);
  });
});
