import { escapeHtml } from 'src/utils/print-html';

import type { IOpenOrder, IKitchenTicket } from 'src/types/fnb';

import { isActiveLine, lineTitle } from './order-view';

// ----------------------------------------------------------------------
// In trên web qua hộp thoại in của trình duyệt (khổ 80 mm): phiếu bar (theo lượt gửi / phiếu HỦY) và phiếu tạm tính.
// Hoá đơn sau thanh toán dùng mẫu hoá đơn bán lẻ có sẵn (GET /sales-orders/{id}/receipt).
// ----------------------------------------------------------------------

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}`;

const time = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; width: 74mm; color: #000; }
  h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
  .center { text-align: center; }
  .muted { font-size: 11px; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .line { margin: 4px 0; }
  .qty { font-weight: 700; font-size: 15px; }
  .sub { padding-left: 14px; font-size: 12px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .total { font-size: 16px; font-weight: 700; }
</style></head><body>${body}</body></html>`;
}

/**
 * Phiếu bar: tên món, size, số lượng, món thêm, ghi chú — không có giá. Phiếu HỦY in to chữ "HỦY" + lý do; in lại thì có
 * dòng "IN LẠI" (hợp đồng 6.1).
 */
export function kitchenTicketHtml(ticket: IKitchenTicket, reprint = false): string {
  const isVoid = ticket.kind === 'Void';
  const place = ticket.tableName ? `${ticket.areaName ? `${ticket.areaName} · ` : ''}${ticket.tableName}` : 'MANG VỀ';
  const lines = ticket.lines
    .map((l) => {
      const toppings = l.toppings.map((t) => `<div class="sub">+ ${escapeHtml(t.name)}${t.quantity > 1 ? ` x${t.quantity}` : ''}</div>`).join('');
      const notes = [...l.quickNotes, ...(l.note ? [l.note] : [])]
        .map((n) => `<div class="sub">* ${escapeHtml(n)}</div>`)
        .join('');
      return `<div class="line"><div class="row"><span>${escapeHtml(lineTitle(l))}</span><span class="qty">${l.quantity}</span></div>${toppings}${notes}</div>`;
    })
    .join('');
  const body = `<h1>${isVoid ? 'HỦY MÓN' : `PHIẾU BAR${ticket.roundNo ? ` · Lượt ${ticket.roundNo}` : ''}`}</h1>
${reprint ? '<div class="center"><b>— IN LẠI —</b></div>' : ''}
<div class="center"><b>${escapeHtml(place)}</b> · Đơn ${escapeHtml(ticket.displayNo)}</div>
<div class="center muted">${escapeHtml(time(ticket.createdAt))} · ${escapeHtml(ticket.createdByName)}</div>
${isVoid && ticket.voidReason ? `<div class="center"><b>Lý do: ${escapeHtml(ticket.voidReason)}</b></div>` : ''}
<hr/>${lines}<hr/>`;
  return page(`Phiếu bar ${ticket.displayNo}`, body);
}

/** Phiếu tạm tính (chưa phải hoá đơn): các món còn tính tiền, giảm giá, tổng. */
export function billHtml(order: IOpenOrder, storeName: string | null): string {
  const place = order.tableName ? `${order.areaName ? `${order.areaName} · ` : ''}${order.tableName}` : 'Mang về';
  const lines = order.lines
    .filter(isActiveLine)
    .sort((a, b) => a.seq - b.seq)
    .map((l) => {
      const toppings = l.toppings
        .map((t) => `<div class="sub">+ ${escapeHtml(t.name)} x${t.quantity * l.quantity}</div>`)
        .join('');
      return `<div class="line"><div class="row"><span>${escapeHtml(lineTitle(l))} x${l.quantity}</span><span>${money(l.amount)}</span></div>${toppings}</div>`;
    })
    .join('');
  const t = order.totals;
  const body = `${storeName ? `<div class="center"><b>${escapeHtml(storeName)}</b></div>` : ''}
<h1>TẠM TÍNH</h1>
<div class="center">${escapeHtml(place)} · Đơn ${escapeHtml(order.displayNo)}</div>
<div class="center muted">${escapeHtml(time(new Date().toISOString()))}</div>
<hr/>${lines}<hr/>
<div class="row"><span>Tạm tính</span><span>${money(t.subtotal)}</span></div>
${t.discountAmount > 0 ? `<div class="row"><span>Giảm giá</span><span>-${money(t.discountAmount)}</span></div>` : ''}
<div class="row total"><span>Tổng cộng</span><span>${money(t.total)}</span></div>
<hr/><div class="center muted">Phiếu tạm tính — chưa phải hoá đơn thanh toán</div>`;
  return page(`Tạm tính ${order.displayNo}`, body);
}
