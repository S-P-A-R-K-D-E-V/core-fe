import { describe, expect, it } from 'vitest';

import type { MessageCard } from 'src/api/messenger';

import {
  cardActionError,
  messageCardState,
  optimisticDoneCard,
  visibleCardActions,
  CARD_CONFLICT_MESSAGE,
  cardActionButtonProps,
  CARD_FORBIDDEN_MESSAGE,
} from '../messenger-card';

// ----------------------------------------------------------------------
// Thẻ hành động trong tin Messenger (A1 — nhóm "Quản trị – Đội agent"), theo hợp đồng
// docs/cici/plans/a1-nhom-quan-tri-api-contract.md mục 2.
// ----------------------------------------------------------------------

const NOW = new Date('2026-11-19T03:00:00Z').getTime();

function approvalCard(overrides: Partial<MessageCard> = {}): MessageCard {
  return {
    kind: 'approval',
    refId: 'a1',
    title: 'Marketing Threads xin duyệt: Tạo bài đăng mạng xã hội',
    lines: ['Kênh: Threads CiCi', 'Hẹn đăng 19:30 hôm nay'],
    link: '/dashboard/agent/approvals?id=a1',
    status: 'open',
    statusText: null,
    expiresAt: '2026-11-19T05:00:00Z',
    actions: [
      { key: 'approve', label: 'Duyệt', style: 'primary' },
      { key: 'revise', label: 'Yêu cầu sửa', style: 'default' },
      { key: 'reject', label: 'Từ chối', style: 'danger' },
      { key: 'open', label: 'Mở phiếu', style: 'default' },
    ],
    updatedAt: '2026-11-19T02:00:00Z',
    ...overrides,
  };
}

const keys = (card: MessageCard, canApprove: boolean, now = NOW) =>
  visibleCardActions(card, { canApprove, now }).map((a) => a.key);

describe('messageCardState', () => {
  it('phiếu còn mở, chưa tới hạn → bấm được, không có chữ trạng thái', () => {
    expect(messageCardState(approvalCard(), NOW)).toEqual({
      done: false,
      expired: false,
      actionable: true,
      statusLabel: null,
    });
  });

  it('phiếu còn mở nhưng quá expiresAt → "Hết hạn"', () => {
    const state = messageCardState(approvalCard({ expiresAt: '2026-11-19T02:59:00Z' }), NOW);
    expect(state.expired).toBe(true);
    expect(state.actionable).toBe(false);
    expect(state.statusLabel).toBe('Hết hạn');
  });

  it('done → hiện statusText (hoặc "Đã xử lý" khi máy chủ không gửi)', () => {
    const done = approvalCard({ status: 'done', statusText: 'Đã duyệt bởi Xuân Bình · 10:42' });
    expect(messageCardState(done, NOW).statusLabel).toBe('Đã duyệt bởi Xuân Bình · 10:42');
    expect(messageCardState({ ...done, statusText: null }, NOW).statusLabel).toBe('Đã xử lý');
    // done thì không tính "Hết hạn" dù đã qua hạn
    expect(messageCardState({ ...done, expiresAt: '2026-11-18T00:00:00Z' }, NOW).expired).toBe(
      false
    );
  });

  it('chỉ phiếu duyệt mới hết hạn; thẻ việc không có hạn', () => {
    const q = approvalCard({ kind: 'task_question', expiresAt: '2026-11-18T00:00:00Z' });
    expect(messageCardState(q, NOW).actionable).toBe(true);
  });
});

describe('visibleCardActions', () => {
  it('người có agent.approve thấy đủ nút theo thứ tự máy chủ gửi', () => {
    expect(keys(approvalCard(), true)).toEqual(['approve', 'revise', 'reject', 'open']);
  });

  it('không có agent.approve → chỉ còn "open"', () => {
    expect(keys(approvalCard(), false)).toEqual(['open']);
    const q = approvalCard({
      kind: 'task_question',
      actions: [
        { key: 'reply', label: 'Trả lời', style: 'primary' },
        { key: 'open', label: 'Mở việc', style: 'default' },
      ],
    });
    expect(keys(q, false)).toEqual(['open']);
    expect(keys(q, true)).toEqual(['reply', 'open']);
  });

  it('done hoặc hết hạn → ẩn nút quyết định, giữ "open"', () => {
    expect(keys(approvalCard({ status: 'done' }), true)).toEqual(['open']);
    expect(keys(approvalCard({ expiresAt: '2026-11-19T02:00:00Z' }), true)).toEqual(['open']);
  });

  it('"open" không có link thì ẩn; nút lạ bị bỏ qua', () => {
    const card = approvalCard({
      link: null,
      actions: [
        { key: 'open', label: 'Mở', style: 'default' },
        { key: 'snooze', label: 'Hoãn', style: 'default' },
      ],
    });
    expect(keys(card, true)).toEqual([]);
  });

  it('actions null → không có nút', () => {
    expect(keys(approvalCard({ actions: null }), true)).toEqual([]);
  });
});

describe('cardActionButtonProps', () => {
  it('primary → nút đặc; danger → viền đỏ; default → viền xám', () => {
    expect(cardActionButtonProps('primary')).toEqual({ variant: 'contained', color: 'primary' });
    expect(cardActionButtonProps('danger')).toEqual({ variant: 'outlined', color: 'error' });
    expect(cardActionButtonProps('default')).toEqual({ variant: 'outlined', color: 'inherit' });
    expect(cardActionButtonProps(undefined)).toEqual({ variant: 'outlined', color: 'inherit' });
  });
});

describe('cardActionError', () => {
  it('403 → câu cố định, không tải lại', () => {
    expect(cardActionError({ status: 403, title: 'Forbidden' }, 'x')).toEqual({
      message: CARD_FORBIDDEN_MESSAGE,
      variant: 'error',
      reload: false,
    });
  });

  it('409 → câu của máy chủ theo detail → title → message, rồi tải lại tin', () => {
    expect(
      cardActionError({ status: 409, detail: 'Phiếu đã hết hạn', title: 'Conflict' }, 'x')
    ).toEqual({ message: 'Phiếu đã hết hạn', variant: 'warning', reload: true });
    expect(cardActionError({ status: 409, title: 'Phiếu đã được duyệt' }, 'x').message).toBe(
      'Phiếu đã được duyệt'
    );
    expect(cardActionError({ status: 409 }, 'x').message).toBe(CARD_CONFLICT_MESSAGE);
  });

  it('lỗi khác → câu của máy chủ hoặc câu dự phòng', () => {
    expect(cardActionError({ status: 400, message: 'Thiếu ghi chú' }, 'x')).toEqual({
      message: 'Thiếu ghi chú',
      variant: 'error',
      reload: false,
    });
    expect(cardActionError(null, 'Thao tác thất bại').message).toBe('Thao tác thất bại');
  });
});

describe('optimisticDoneCard', () => {
  it('chuyển done + statusText, giữ phần còn lại', () => {
    const next = optimisticDoneCard(approvalCard(), 'Đã duyệt');
    expect(next.status).toBe('done');
    expect(next.statusText).toBe('Đã duyệt');
    expect(next.refId).toBe('a1');
    expect(visibleCardActions(next, { canApprove: true, now: NOW }).map((a) => a.key)).toEqual([
      'open',
    ]);
  });
});
