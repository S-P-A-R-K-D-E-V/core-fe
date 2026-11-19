import type { QuickReply, MessagePage, ConversationPage, ConversationSummary, ConversationMessage } from '../inbox';

import { it, expect, describe } from 'vitest';

import {
  fVnd,
  toSummary,
  isPriority,
  appendSlash,
  insertAtCursor,
  kindUnreadCount,
  togglePriorityTag,
  needsTimeSeparator,
  conversationBadgeIcon,
  outgoingSenderCaption,
  matchesBox,
  holderLabel,
  windowState,
  isHeldByMe,
  mergeDetail,
  maxImagesFor,
  matchesFilter,
  normalizeTags,
  isValidShortcut,
  applyQuickReply,
  parseSlashQuery,
  flattenMessages,
  facebookPostUrl,
  formatDurationVi,
  normalizeShortcut,
  addMessageToPages,
  filterQuickReplies,
  lastMessagePreview,
  updateMessageInPages,
  conversationKindIcon,
  conversationListQuery,
  canToggleCommentHidden,
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
    postId: null,
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
    ).toBe('Bạn: Ok ạ');
    expect(
      lastMessagePreview(conv('a', { lastMessage: { text: 'Dạ', direction: 'out', senderType: 'user', at: '' } }))
    ).toBe('Bạn: Dạ');
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

describe('bình luận fanpage (F5)', () => {
  const comment = (id: string, patch: Partial<ConversationSummary> = {}) =>
    conv(id, { kind: 'comment', postId: '1234_5678', ...patch });

  it('query: kind chỉ gửi khi có lọc', () => {
    expect(conversationListQuery({ box: 'all', kind: 'comment' })).toBe('kind=comment&status=open&take=30');
    expect(conversationListQuery({ box: 'all', kind: null })).toBe('status=open&take=30');
  });

  it('lọc loại: dòng khác loại không khớp', () => {
    expect(matchesFilter(comment('a'), { box: 'all', kind: 'comment' }, ME)).toBe(true);
    expect(matchesFilter(conv('b'), { box: 'all', kind: 'comment' }, ME)).toBe(false);
    expect(matchesFilter(comment('a'), { box: 'all', kind: 'dm' }, ME)).toBe(false);
    expect(matchesFilter(comment('a'), { box: 'all' }, ME)).toBe(true);
    // Khác loại thắng cả khi đang tìm theo chữ (máy khách biết chắc không khớp).
    expect(matchesFilter(conv('b'), { box: 'all', kind: 'comment', q: 'lan' }, ME)).toBe(false);
  });

  it('cập nhật trực tiếp: không thêm hội thoại khác loại, bỏ dòng đổi sang loại khác', () => {
    const pages: ConversationPage[] = [{ items: [comment('a')], nextBefore: null }];
    const filter = { box: 'all' as const, kind: 'comment' as const };
    expect(upsertConversationPages(pages, conv('dm-1', { lastMessageAt: '2026-11-19T12:00:00Z' }), filter, ME)).toBe(
      pages
    );
    const added = upsertConversationPages(pages, comment('b', { lastMessageAt: '2026-11-19T12:00:00Z' }), filter, ME)!;
    expect(added[0].items.map((c) => c.id)).toEqual(['b', 'a']);
    const dmFilter = { box: 'all' as const, kind: 'dm' as const };
    const dmPages: ConversationPage[] = [{ items: [conv('x')], nextBefore: null }];
    expect(upsertConversationPages(dmPages, comment('c'), dmFilter, ME)).toBe(dmPages);
  });

  it('link bài Facebook', () => {
    expect(facebookPostUrl('1234_5678')).toBe('https://www.facebook.com/1234_5678');
    expect(facebookPostUrl(' 1234_5678 ')).toBe('https://www.facebook.com/1234_5678');
    expect(facebookPostUrl(null)).toBeNull();
    expect(facebookPostUrl('')).toBeNull();
  });

  it('biểu tượng loại + số ảnh tối đa', () => {
    expect(conversationKindIcon('comment')).toBe('solar:chat-square-like-bold');
    expect(conversationKindIcon('dm')).not.toBe(conversationKindIcon('comment'));
    expect(maxImagesFor('comment')).toBe(1);
    expect(maxImagesFor('dm')).toBe(10);
    expect(maxImagesFor(undefined)).toBe(10);
  });

  it('ẩn / hiện lại chỉ cho bình luận của khách', () => {
    const inbound = msg('m1', '2026-11-19T08:00:00Z');
    expect(canToggleCommentHidden(inbound, 'comment')).toBe(true);
    expect(canToggleCommentHidden({ ...inbound, status: 'hidden' }, 'comment')).toBe(true);
    expect(canToggleCommentHidden(inbound, 'dm')).toBe(false);
    expect(canToggleCommentHidden({ ...inbound, direction: 'out', status: 'sent' }, 'comment')).toBe(false);
    expect(canToggleCommentHidden({ ...inbound, isInternalNote: true }, 'comment')).toBe(false);
  });
});

describe('bố cục kiểu Meta Business Suite', () => {
  it('số chưa đọc theo tab loại', () => {
    const summary = {
      unassigned: 1,
      mine: 0,
      agent: 0,
      external: 0,
      unread: 5,
      open: 9,
      unreadMessages: 3,
      unreadComments: 2,
    };
    expect(kindUnreadCount(summary, null)).toBe(5);
    expect(kindUnreadCount(summary, 'dm')).toBe(3);
    expect(kindUnreadCount(summary, 'comment')).toBe(2);
    expect(kindUnreadCount(undefined, null)).toBe(0);
  });

  it('query: unread=true chỉ khi bật lọc Chưa đọc', () => {
    expect(conversationListQuery({ box: 'all', unread: true, tag: 'Ưu tiên' })).toBe(
      'tag=%C6%AFu+ti%C3%AAn&unread=true&status=open&take=30'
    );
    expect(conversationListQuery({ box: 'agent', unread: false })).toBe('box=agent&status=open&take=30');
  });

  it('lọc Chưa đọc: hội thoại vừa đọc giữ chỗ, không tự thêm hội thoại đã đọc', () => {
    const filter = { box: 'all' as const, unread: true };
    expect(matchesFilter(conv('a', { unreadCount: 2 }), filter, ME)).toBe(true);
    expect(matchesFilter(conv('a', { unreadCount: 0 }), filter, ME)).toBeNull();

    const pages: ConversationPage[] = [{ items: [conv('a', { unreadCount: 2 })], nextBefore: null }];
    const read = upsertConversationPages(pages, conv('a', { unreadCount: 0 }), filter, ME)!;
    expect(read[0].items.map((c) => [c.id, c.unreadCount])).toEqual([['a', 0]]);
    expect(upsertConversationPages(pages, conv('b', { unreadCount: 0 }), filter, ME)).toBe(pages);
  });

  it('Ưu tiên: nhận ra + bật / tắt giữ nhãn khác', () => {
    expect(isPriority(conv('a', { tags: ['VIP', 'Ưu tiên'] }))).toBe(true);
    expect(isPriority(conv('a', { tags: ['VIP'] }))).toBe(false);
    expect(togglePriorityTag(['VIP'])).toEqual(['Ưu tiên', 'VIP']);
    expect(togglePriorityTag(['VIP', 'ưu tiên'])).toEqual(['VIP']);
    const ten = Array.from({ length: 10 }, (_, i) => `n${i}`);
    const toggled = togglePriorityTag(ten);
    expect(toggled).toHaveLength(10);
    expect(toggled[0]).toBe('Ưu tiên');
  });

  it('dấu kênh ở ảnh đại diện', () => {
    expect(conversationBadgeIcon({ platform: 'facebook', kind: 'dm' })).toBe('logos:messenger');
    expect(conversationBadgeIcon({ platform: 'facebook', kind: 'comment' })).toBe('logos:facebook');
    expect(conversationBadgeIcon({ platform: 'test', kind: 'dm' })).toBe('solar:test-tube-bold');
  });

  it('Người gửi dưới tin đi', () => {
    expect(outgoingSenderCaption({ senderType: 'agent', senderName: 'Agent CSKH' })).toBe(
      'Người gửi: Trợ lý CiCi (AI)'
    );
    expect(outgoingSenderCaption({ senderType: 'user', senderName: 'Trà My' })).toBe('Người gửi: Trà My');
    expect(outgoingSenderCaption({ senderType: 'external', senderName: null })).toBe(
      'Người gửi: Nhân viên (trên Facebook)'
    );
  });

  it('mốc giờ giữa khung chat', () => {
    const at = (iso: string) => ({ sentAt: iso });
    expect(needsTimeSeparator(null, at('2026-11-19T08:00:00Z'))).toBe(true);
    expect(needsTimeSeparator(at('2026-11-19T08:00:00Z'), at('2026-11-19T08:10:00Z'))).toBe(false);
    expect(needsTimeSeparator(at('2026-11-19T08:00:00Z'), at('2026-11-19T08:16:00Z'))).toBe(true);
    expect(needsTimeSeparator(at('2026-11-18T08:00:00'), at('2026-11-19T08:01:00'))).toBe(true);
  });

  it('chèn biểu tượng cảm xúc + nút mẫu nhanh', () => {
    expect(insertAtCursor('Chào ạ', '😊', 4)).toEqual({ text: 'Chào😊 ạ', caret: 6 });
    expect(insertAtCursor('abc', '!', null)).toEqual({ text: 'abc!', caret: 4 });
    expect(insertAtCursor('abcdef', 'X', 1, 3)).toEqual({ text: 'aXdef', caret: 2 });
    expect(appendSlash('')).toBe('/');
    expect(appendSlash('Dạ ')).toBe('Dạ /');
    expect(appendSlash('Dạ')).toBe('Dạ /');
    expect(appendSlash('Dạ /gi')).toBe('Dạ /gi');
  });
});
