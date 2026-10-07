import type { FnbPaymentMethod } from 'src/types/fnb';

import type { CheckoutPayment } from './commands';

// ----------------------------------------------------------------------
// Thanh toán đơn F&B (hợp đồng 5.13) — cùng quy tắc với app (checkout-plan.ts): một phương thức trả đủ tổng tiền.
//   - Σ payments = tổng đơn; tổng 0 → payments rỗng.
//   - Tiền mặt: cashTendered = tiền khách đưa khi lớn hơn tổng; đưa vừa đủ / để trống → null (máy chủ hiểu là vừa đủ).
//   - Chuyển khoản: bankAccountId = id dòng GET /bank-accounts + nội dung chuyển khoản.
// ----------------------------------------------------------------------

export type PaymentInput = {
  method: FnbPaymentMethod;
  cashGiven?: number | null;
  bankAccountId?: string | null;
  transferRef?: string | null;
};

export type CheckoutPlan = { payments: CheckoutPayment[]; cashTendered: number | null };

export function checkoutPlan(total: number, input: PaymentInput): CheckoutPlan {
  if (total <= 0) return { payments: [], cashTendered: null };
  const transfer = input.method === 'Transfer';
  const given = input.cashGiven ?? total;
  return {
    payments: [
      {
        method: input.method,
        amount: total,
        bankAccountId: transfer ? input.bankAccountId ?? null : null,
        transactionRef: transfer ? input.transferRef?.trim() || null : null,
      },
    ],
    cashTendered: input.method === 'Cash' && given > total ? given : null,
  };
}

/** Tiền thối khi trả tiền mặt (khách đưa thiếu → 0). */
export const changeDue = (total: number, cashGiven: number | null | undefined) =>
  Math.max(0, (cashGiven ?? total) - total);

/** Mệnh giá gợi ý để bấm nhanh tiền khách đưa: tổng tiền và các tờ tròn lớn hơn. */
export function quickCashOptions(total: number): number[] {
  if (total <= 0) return [];
  const notes = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000];
  const out = new Set<number>([total]);
  for (const note of notes) {
    const rounded = Math.ceil(total / note) * note;
    if (rounded > total) out.add(rounded);
  }
  return [...out].sort((a, b) => a - b).slice(0, 5);
}
