import type { MessageCard, MessageCardAction } from 'src/api/messenger';

import { apiErrorMessage } from './api-error';

// ----------------------------------------------------------------------
// Thẻ hành động trong tin Messenger (A1 — nhóm "Quản trị – Đội agent"). Hàm thuần: trạng thái thẻ, nút nào được hiện,
// màu nút, câu báo lỗi. Hợp đồng: docs/cici/plans/a1-nhom-quan-tri-api-contract.md mục 2.
// ----------------------------------------------------------------------

/** Nút cần quyền agent.approve (duyệt / yêu cầu sửa / từ chối / trả lời agent). "open" chỉ là điều hướng. */
export const CARD_DECISION_KEYS = ['approve', 'revise', 'reject', 'reply'] as const;

export const CARD_FORBIDDEN_MESSAGE = 'Bạn không có quyền duyệt agent';
export const CARD_CONFLICT_MESSAGE = 'Phiếu đã được xử lý hoặc đã hết hạn';

export const CARD_REPLY_MAX = 4000;

export type MessageCardState = {
  /** Thẻ đã xử lý xong (status "done"). */
  done: boolean;
  /** Phiếu duyệt còn "open" nhưng đã quá expiresAt. */
  expired: boolean;
  /** Còn bấm được nút quyết định. */
  actionable: boolean;
  /** Chữ trạng thái hiện trên thẻ; null = không hiện. */
  statusLabel: string | null;
};

export function messageCardState(card: MessageCard, now: number = Date.now()): MessageCardState {
  const done = card.status === 'done';
  const expiresAt = card.expiresAt ? new Date(card.expiresAt).getTime() : NaN;
  const expired =
    !done && card.kind === 'approval' && Number.isFinite(expiresAt) && expiresAt <= now;

  let statusLabel: string | null = null;
  if (done) statusLabel = card.statusText?.trim() || 'Đã xử lý';
  else if (expired) statusLabel = 'Hết hạn';

  return { done, expired, actionable: !done && !expired, statusLabel };
}

export function isCardDecisionKey(key: string): boolean {
  return (CARD_DECISION_KEYS as readonly string[]).includes(key);
}

/**
 * Nút được hiện: thẻ đã xong / hết hạn → chỉ còn nút "open" (điều hướng tới phiếu / việc, cần link); người xem không có
 * quyền agent.approve → ẩn duyệt / sửa / từ chối / trả lời. Nút lạ (máy chủ mới hơn) bị bỏ qua.
 */
export function visibleCardActions(
  card: MessageCard,
  opts: { canApprove: boolean; now?: number }
): MessageCardAction[] {
  const { actionable } = messageCardState(card, opts.now);
  return (card.actions ?? []).filter((a) => {
    if (a.key === 'open') return !!card.link;
    if (!isCardDecisionKey(a.key)) return false;
    return actionable && opts.canApprove;
  });
}

/** Nút "primary" → nút đặc màu chính; "danger" → viền đỏ; còn lại → viền xám. */
export function cardActionButtonProps(style: MessageCardAction['style']): {
  variant: 'contained' | 'outlined';
  color: 'primary' | 'error' | 'inherit';
} {
  if (style === 'primary') return { variant: 'contained', color: 'primary' };
  if (style === 'danger') return { variant: 'outlined', color: 'error' };
  return { variant: 'outlined', color: 'inherit' };
}

/**
 * Câu báo lỗi khi bấm nút thẻ. axios reject bằng body đã gắn `status`. 403 → câu cố định; 409 (phiếu đã xử lý / hết
 * hạn) → câu của máy chủ ở detail / title / message. `reload` = nên tải lại tin để thẻ về trạng thái mới.
 */
export function cardActionError(
  err: unknown,
  fallback: string
): { message: string; variant: 'warning' | 'error'; reload: boolean } {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 403) return { message: CARD_FORBIDDEN_MESSAGE, variant: 'error', reload: false };
  if (status === 409 || status === 404) {
    const body = err as { detail?: unknown; title?: unknown; message?: unknown };
    const text = [body.detail, body.title, body.message].find(
      (v): v is string => typeof v === 'string' && !!v.trim()
    );
    return { message: text ?? CARD_CONFLICT_MESSAGE, variant: 'warning', reload: true };
  }
  return { message: apiErrorMessage(err, fallback), variant: 'error', reload: false };
}

/** Thẻ sau khi bấm thành công — cập nhật lạc quan trong lúc chờ sự kiện `messageUpdated` của máy chủ. */
export function optimisticDoneCard(card: MessageCard, statusText: string): MessageCard {
  return { ...card, status: 'done', statusText, updatedAt: new Date().toISOString() };
}

export const CARD_DONE_TEXT: Record<string, string> = {
  approve: 'Đã duyệt',
  revise: 'Đã yêu cầu sửa',
  reject: 'Đã từ chối',
  reply: 'Đã trả lời',
};
