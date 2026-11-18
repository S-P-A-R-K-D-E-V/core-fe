import { describe, expect, it } from 'vitest';

import {
  timeLeft,
  appendNote,
  queryParams,
  platformInfo,
  resultSnippet,
  permissionDomain,
  parseActionParams,
  agentActionStatus,
  splitRevisionNote,
  groupPoliciesByDomain,
} from '../agent-action-utils';

// ----------------------------------------------------------------------
// Trang Duyệt việc agent: đọc tham số lệnh cho người duyệt, thời gian còn lại, gom quyền theo nhóm.
// ----------------------------------------------------------------------

describe('parseActionParams', () => {
  it('object → danh sách tên / giá trị dễ đọc', () => {
    const parsed = parseActionParams(
      JSON.stringify({
        cycleId: 'c1',
        amount: 150000,
        paid: true,
        note: '',
        tags: ['a', 'b'],
        nested: { x: 1 },
        none: null,
      })
    );
    expect(parsed).toEqual({
      kind: 'fields',
      fields: [
        { key: 'cycleId', value: 'c1' },
        { key: 'amount', value: '150000' },
        { key: 'paid', value: 'Có' },
        { key: 'note', value: '(trống)' },
        { key: 'tags', value: 'a, b' },
        { key: 'nested', value: '{"x":1}' },
        { key: 'none', value: '—' },
      ],
    });
  });

  it('không có body / object rỗng → không có tham số', () => {
    expect(parseActionParams(null)).toEqual({ kind: 'none' });
    expect(parseActionParams('  ')).toEqual({ kind: 'none' });
    expect(parseActionParams('{}')).toEqual({ kind: 'none' });
  });

  it('mảng → JSON in đẹp; chữ không phải JSON → giữ nguyên', () => {
    expect(parseActionParams('[1,2]')).toEqual({ kind: 'raw', text: '[\n  1,\n  2\n]' });
    expect(parseActionParams('not json')).toEqual({ kind: 'raw', text: 'not json' });
  });

  it('giá trị quá dài bị cắt ngắn', () => {
    const parsed = parseActionParams(JSON.stringify({ text: 'x'.repeat(1000) }));
    expect(parsed.kind === 'fields' && parsed.fields[0].value.length).toBe(300);
  });
});

describe('queryParams', () => {
  it('đọc tham số trên query string', () => {
    expect(queryParams('/api/internal/payroll/finalize?cycleId=c1&x=2')).toEqual([
      { key: 'cycleId', value: 'c1' },
      { key: 'x', value: '2' },
    ]);
    expect(queryParams('/api/internal/payroll/finalize')).toEqual([]);
  });
});

describe('timeLeft', () => {
  const now = Date.parse('2026-11-18T10:00:00Z');
  it.each([
    ['2026-11-18T09:59:00Z', 'đã hết hạn'],
    ['2026-11-18T10:00:30Z', 'còn dưới 1 phút'],
    ['2026-11-18T10:40:00Z', 'còn 40 phút'],
    ['2026-11-18T12:00:00Z', 'còn 2 giờ'],
    ['2026-11-18T12:05:00Z', 'còn 2 giờ 5 phút'],
    ['2026-11-20T13:00:00Z', 'còn 2 ngày 3 giờ'],
  ])('%s → %s', (expiresAt, expected) => {
    expect(timeLeft(expiresAt, now)).toBe(expected);
  });
});

describe('quyền và trạng thái', () => {
  it('nhóm = phần trước dấu chấm đầu tiên', () => {
    expect(permissionDomain('payroll.finalize')).toBe('payroll');
    expect(permissionDomain('cash-voucher.create')).toBe('cash-voucher');
    expect(permissionDomain('orders')).toBe('orders');
  });

  it('gom quyền theo nhóm, sắp theo tên', () => {
    const item = (permission: string) => ({
      permission,
      level: 'approve' as const,
      isDefault: true,
      endpoints: [],
      requiresConfirmation: false,
    });
    const groups = groupPoliciesByDomain([
      item('payroll.finalize'),
      item('orders.create'),
      item('payroll.calculate'),
    ]);
    expect(groups.map((g) => g.domain)).toEqual(['orders', 'payroll']);
    expect(groups[1].items.map((i) => i.permission)).toEqual([
      'payroll.calculate',
      'payroll.finalize',
    ]);
  });

  it('trạng thái lạ vẫn hiện được', () => {
    expect(agentActionStatus('executed').label).toBe('Đã chạy');
    expect(agentActionStatus('weird')).toEqual({ label: 'weird', color: 'default' });
    expect(agentActionStatus('revision_requested').label).toBe('Đã yêu cầu sửa');
  });

  it('phản hồi JSON in đẹp, cắt ngắn', () => {
    expect(resultSnippet('{"ok":true}')).toBe('{\n  "ok": true\n}');
    expect(resultSnippet('x'.repeat(50), 10)).toHaveLength(10);
    expect(resultSnippet(null)).toBe('');
  });
});

describe('Yêu cầu sửa', () => {
  it('chip chèn ý vào ghi chú: xuống dòng, không trùng', () => {
    expect(appendNote('', 'Viết ngắn lại')).toBe('Viết ngắn lại');
    expect(appendNote('Ảnh tối', 'Viết ngắn lại')).toBe('Ảnh tối\nViết ngắn lại');
    expect(appendNote('Ảnh tối\nViết ngắn lại', 'Viết ngắn lại')).toBe('Ảnh tối\nViết ngắn lại');
  });

  it('tên nền tảng', () => {
    expect(platformInfo('threads').label).toBe('Threads');
    expect(platformInfo('Threads').label).toBe('Threads');
    expect(platformInfo('lemon8').label).toBe('lemon8');
  });
});

describe('splitRevisionNote', () => {
  it('tách ghi chú và ảnh cần làm lại', () => {
    const note = 'Nền pastel hồng\nẢnh cần làm lại:\n- https://cdn.example.com/a.jpg\n- https://cdn.example.com/b.jpg';
    expect(splitRevisionNote(note)).toEqual({
      text: 'Nền pastel hồng',
      imageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    });
  });

  it('ghi chú không có ảnh giữ nguyên', () => {
    expect(splitRevisionNote('  Viết ngắn lại ')).toEqual({ text: 'Viết ngắn lại', imageUrls: [] });
    expect(splitRevisionNote(null)).toEqual({ text: '', imageUrls: [] });
  });
});
