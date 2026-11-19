import type { QuickReply, MessagePage, ConversationPage, ConversationSummary, ConversationMessage } from '../inbox';

import { it, expect, describe } from 'vitest';

import {
  fVnd,
  toSummary,
  matchesBox,
  holderLabel,
  windowState,
  isHeldByMe,
  mergeDetail,
  normalizeTags,
  isValidShortcut,
  applyQuickReply,
  parseSlashQuery,
  flattenMessages,
  formatDurationVi,
  normalizeShortcut,
  addMessageToPages,
  filterQuickReplies,
  lastMessagePreview,
  updateMessageInPages,
  conversationListQuery,
  upsertConversationPages,
} from '../inbox';

// ----------------------------------------------------------------------
// Hộp thư khách: nhãn người giữ, cửa sổ 24 giờ, mẫu "/", gộp sự kiện trực tiếp vào danh sách / tin nhắn.

const ME = 'u-me';

function conv(id: string, patch: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id,
    channelId: 'ch-1',
    channelName: 'CiCi Fanpage',
    platform: 'facebook',
    kind: 'dm',
    customer: { id: null, name: `Khách ${id}`, avatarUrl: null, phone: null, code: null },
    lastMessage: null,
    unreadCount: 0,
    status: 'open',
    holder: { type: 'none', userId: null, name: null, since: null },
    holderVersion: 1,
    assignedUserId: null,
    assignedName: null,
    tags: [],
    lastCustomerMessageAt: null,
    windowEndsAt: null,
    lastMessageAt: '2026-11-19T08:00:00Z',
    ...patch,
  };
}

function msg(id: string, sentAt: string, patch: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id,
    conversationId: 'c1',
    direction: 'in',
    senderType: 'customer',
    senderName: 'Lan',
    text: id,
    attachments: [],
    status: 'received',
    error: null,
    isInternalNote: false,
    sentAt,
    ...patch,
  };
}

function reply(shortcut: string, title: string, sortOrder = 0): QuickReply {
  return { id: shortcut, shortcut, title, text: `Nội dung ${shortcut}`, imageUrls: [], sortOrder };
}

describe('người giữ hội thoại', () => {
  it('nhãn theo loại người giữ', () => {
    expect(holderLabel({ type: 'none', userId: null, name: null, since: null })).toBe('Chưa ai nhận');
    expect(holderLabel({ type: 'agent', userId: null, name: null, since: null })).toBe('Agent đang trả lời');
    expect(holderLabel({ type: 'external', userId: null, name: null, since: null })).toBe(
      'Nhân viên trả lời trên Facebook'
    );
    expect(holderLabel({ type: 'user', userId: 'u2', name: 'Trà My', since: null }, ME)).toBe(
      'Đang do Trà My trả lời'
    );
    expect(holderLabel({ type: 'user', userId: ME, name: 'Bình', since: null }, ME)).toBe('Bạn đang trả lời');
    expect(holderLabel({ type: 'user', userId: 'u2', name: null, since: null }, ME)).toBe(
      'Đang do nhân viên khác trả lời'
    );
  });

  it('tôi giữ khi userId trùng', () => {
    expect(isHeldByMe({ type: 'user', userId: ME, name: null, since: null }, ME)).toBe(true);
    expect(isHeldByMe({ type: 'user', userId: ME, name: null, since: null }, null)).toBe(false);
    expect(isHeldByMe({ type: 'agent', userId: ME, name: null, since: null }, ME)).toBe(false);
  });
});

describe('cửa sổ 24 giờ', () => {
  const now = Date.parse('2026-11-19T10:00:00Z');

  it('định dạng thời lượng', () => {
    expect(formatDurationVi(30_000)).toBe('dưới 1 phút');
    expect(formatDurationVi(45 * 60_000)).toBe('45 phút');
    expect(formatDurationVi(2 * 3600_000)).toBe('2 giờ');
    expect(formatDurationVi(2 * 3600_000 + 15 * 60_000)).toBe('2 giờ 15 phút');
  });

  it('không có / còn nhiều / sắp hết / đã hết', () => {
    expect(windowState(null, now)).toEqual({ kind: 'none' });
    const plenty = windowState('2026-11-19T20:00:00Z', now);
    expect(plenty.kind === 'open' && plenty.warn).toBe(false);
    const soon = windowState('2026-11-19T12:15:00Z', now);
    expect(soon.kind).toBe('open');
    expect(soon.kind === 'open' && soon.warn).toBe(true);
    expect(soon.kind === 'open' && soon.text).toBe('Còn 2 giờ 15 phút để trả lời (cửa sổ 24 giờ của Meta).');
    expect(windowState('2026-11-19T09:59:00Z', now).kind).toBe('closed');
  });
});

describe('mẫu trả lời nhanh', () => {
  it('nhận "/" ở đầu hoặc sau khoảng trắng, ở cuối ô gõ', () => {
    expect(parseSlashQuery('/gia')).toEqual({ query: 'gia', start: 0 });
    expect(parseSlashQuery('Chào chị /')).toEqual({ query: '', start: 9 });
    expect(parseSlashQuery('Chào chị /ship-')).toEqual({ query: 'ship-', start: 9 });
    expect(parseSlashQuery('giá 50/100')).toBeNull();
    expect(parseSlashQuery('/gia rồi')).toBeNull();
    expect(parseSlashQuery('')).toBeNull();
  });

  it('lọc: khớp đầu phím tắt trước, rồi chứa trong phím tắt / tiêu đề (bỏ dấu)', () => {
    const replies = [reply('dia-chi', 'Địa chỉ cửa hàng', 2), reply('gia', 'Báo giá', 5), reply('ship', 'Phí giao hàng', 1)];
    expect(filterQuickReplies(replies, '').map((r) => r.shortcut)).toEqual(['ship', 'dia-chi', 'gia']);
    expect(filterQuickReplies(replies, 'gi').map((r) => r.shortcut)).toEqual(['gia', 'ship']);
    expect(filterQuickReplies(replies, 'giao').map((r) => r.shortcut)).toEqual(['ship']);
    expect(filterQuickReplies(replies, 'chi').map((r) => r.shortcut)).toEqual(['dia-chi']);
    expect(filterQuickReplies(replies, 'xyz')).toEqual([]);
  });

  it('chèn nội dung thay cho "/abc"', () => {
    const text = 'Dạ chị ơi /gi';
    const slash = parseSlashQuery(text)!;
    expect(applyQuickReply(text, slash, { text: 'Giá 50k ạ' })).toBe('Dạ chị ơi Giá 50k ạ');
  });

  it('phím tắt hợp lệ', () => {
    expect(normalizeShortcut(' /Gia-Ship ')).toBe('gia-ship');
    expect(isValidShortcut('gia-ship')).toBe(true);
    expect(isValidShortcut('giá')).toBe(false);
    expect(isValidShortcut('')).toBe(false);
    expect(isValidShortcut('a'.repeat(31))).toBe(false);
  });
});

describe('nhãn', () => {
  it('bỏ trùng không phân biệt hoa thường, cắt 30 ký tự, tối đa 10', () => {
    expect(normalizeTags([' VIP ', 'vip', 'Hỏi  giá', ''])).toEqual(['VIP', 'Hỏi giá']);
    expect(normalizeTags(['x'.repeat(40)])[0]).toHaveLength(30);
    expect(normalizeTags(Array.from({ length: 15 }, (_, i) => `t${i}`))).toHaveLength(10);
  });
});

describe('danh sách hội thoại', () => {
  it('query: mặc định status=open, bỏ box=all', () => {
    expect(conversationListQuery({ box: 'all' })).toBe('status=open&take=30');
    expect(conversationListQuery({ box: 'mine', q: ' lan ', tag: 'VIP' }, '2026-11-19T08:00:00Z', 20)).toBe(
      'box=mine&q=lan&tag=VIP&status=open&before=2026-11-19T08%3A00%3A00Z&take=20'
    );
  });

  it('khớp tab', () => {
    const mine = conv('a', { holder: { type: 'user', userId: ME, name: 'Bình', since: null } });
    const assigned = conv('b', { assignedUserId: ME, holder: { type: 'agent', userId: null, name: null, since: null } });
    expect(matchesBox(mine, 'mine', ME)).toBe(true);
    expect(matchesBox(assigned, 'mine', ME)).toBe(true);
    expect(matchesBox(assigned, 'agent', ME)).toBe(true);
    expect(matchesBox(mine, 'unassigned', ME)).toBe(false);
    expect(matchesBox(conv('c'), 'unassigned', ME)).toBe(true);
  });

  it('cập nhật đưa lên đầu, thêm mới, bỏ khi không còn khớp tab', () => {
    const pages: ConversationPage[] = [
      { items: [conv('a', { lastMessageAt: '2026-11-19T09:00:00Z' }), conv('b')], nextBefore: 'x' },
      { items: [conv('c', { lastMessageAt: '2026-11-19T07:00:00Z' })], nextBefore: null },
    ];
    const filter = { box: 'unassigned' as const };

    const bumped = upsertConversationPages(pages, conv('c', { lastMessageAt: '2026-11-19T10:00:00Z', unreadCount: 1 }), filter, ME)!;
    expect(bumped.map((p) => p.items.map((c) => c.id))).toEqual([['c', 'a'], ['b']]);
    expect(bumped[0].items[0].unreadCount).toBe(1);

    const added = upsertConversationPages(pages, conv('d', { lastMessageAt: '2026-11-19T11:00:00Z' }), filter, ME)!;
    expect(added.map((p) => p.items.map((c) => c.id))).toEqual([['d', 'a', 'b'], ['c']]);

    const taken = upsertConversationPages(
      pages,
      conv('a', { holder: { type: 'user', userId: ME, name: null, since: null } }),
      filter,
      ME
    )!;
    expect(taken.map((p) => p.items.map((c) => c.id))).toEqual([['b'], ['c']]);
  });

  it('đang tìm theo chữ: chỉ cập nhật dòng đã có, không tự thêm', () => {
    const pages: ConversationPage[] = [{ items: [conv('a')], nextBefore: null }];
    const filter = { box: 'all' as const, q: 'lan' };
    expect(upsertConversationPages(pages, conv('z'), filter, ME)).toBe(pages);
    const updated = upsertConversationPages(pages, conv('a', { unreadCount: 3 }), filter, ME)!;
    expect(updated[0].items[0].unreadCount).toBe(3);
  });

  it('đóng hội thoại → bỏ khỏi danh sách đang mở', () => {
    const pages: ConversationPage[] = [{ items: [conv('a'), conv('b')], nextBefore: null }];
    const next = upsertConversationPages(pages, conv('a', { status: 'closed' }), { box: 'all' }, ME)!;
    expect(next[0].items.map((c) => c.id)).toEqual(['b']);
  });

  it('chi tiết: ghi trường tóm tắt, giữ phần riêng; toSummary bỏ phần riêng', () => {
    const detail = { ...conv('a'), customerPanel: null, canReply: true, reason: null };
    const merged = mergeDetail(detail, conv('a', { unreadCount: 4 }))!;
    expect(merged.unreadCount).toBe(4);
    expect(merged.canReply).toBe(true);
    expect(mergeDetail(detail, conv('b'))).toBe(detail);
    expect(mergeDetail(undefined, conv('a'))).toBeUndefined();
    expect('canReply' in toSummary(detail)).toBe(false);
  });

  it('tóm tắt tin cuối', () => {
    expect(lastMessagePreview(conv('a'))).toBe('Chưa có tin nhắn');
    expect(
      lastMessagePreview(conv('a', { lastMessage: { text: 'Ok ạ', direction: 'out', senderType: 'agent', at: '' } }))
    ).toBe('Agent: Ok ạ');
    expect(
      lastMessagePreview(conv('a', { lastMessage: { text: '', direction: 'in', senderType: 'customer', at: '' } }))
    ).toBe('[Ảnh / tệp]');
  });
});

describe('tin nhắn', () => {
  const pages: MessagePage[] = [
    { items: [msg('m3', '2026-11-19T09:00:00Z'), msg('m4', '2026-11-19T09:05:00Z')], nextBefore: 'x' },
    { items: [msg('m1', '2026-11-19T08:00:00Z'), msg('m2', '2026-11-19T08:30:00Z')], nextBefore: null },
  ];

  it('làm phẳng cũ → mới', () => {
    expect(flattenMessages(pages).map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(flattenMessages(undefined)).toEqual([]);
  });

  it('thêm tin mới vào trang mới nhất, không trùng', () => {
    const added = addMessageToPages(pages, msg('m5', '2026-11-19T09:10:00Z'))!;
    expect(flattenMessages(added).map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
    const again = addMessageToPages(added, msg('m5', '2026-11-19T09:10:00Z', { status: 'sent' }))!;
    expect(flattenMessages(again)).toHaveLength(5);
    expect(addMessageToPages(undefined, msg('m1', '2026-11-19T08:00:00Z'))).toHaveLength(1);
  });

  it('cập nhật trạng thái tin (sending → failed)', () => {
    const updated = updateMessageInPages(pages, msg('m2', '2026-11-19T08:30:00Z', { status: 'failed', error: 'Lỗi' }))!;
    expect(flattenMessages(updated).find((m) => m.id === 'm2')?.status).toBe('failed');
    expect(updateMessageInPages(pages, msg('zz', '2026-11-19T08:30:00Z'))).toBe(pages);
  });
});

describe('tiền', () => {
  it('định dạng VND', () => {
    expect(fVnd(125000)).toBe('125.000đ');
    expect(fVnd(null)).toBe('—');
  });
});
