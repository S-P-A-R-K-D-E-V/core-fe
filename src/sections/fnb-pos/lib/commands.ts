import { endpoints } from 'src/utils/axios';

import type { IOpenOrder, FnbPaymentMethod } from 'src/types/fnb';

import { newId, isoNow } from './ids';

// ----------------------------------------------------------------------
// Lệnh ghi lên đơn (hợp đồng 5.x, 6.4) — cùng gói tin với app (corecms-mobile src/features/fnb/fnb-commands.ts). Mọi id
// (đơn, dòng, phiếu, clientRequestId) sinh NGAY LÚC DỰNG: gửi lại (mạng chập chờn, bấm lại) vẫn là cùng một gói và máy
// chủ trả lại kết quả cũ. Lệnh có kiểm phiên bản mang baseVersion của bản đơn đang hiện.
// Web luôn trực tuyến nên gửi thẳng (không có hàng đợi offline như app).
// ----------------------------------------------------------------------

export type FnbCommand = { method: 'PUT' | 'POST'; path: string; body: Record<string, unknown> };

type Ctx = { deviceId: string; now?: Date };

const envelope = (ctx: Ctx) => ({ clientRequestId: newId(), deviceId: ctx.deviceId, clientTime: isoNow(ctx.now) });

export type ItemLineInput = {
  id: string;
  lineType: 'Item';
  productId: string;
  quantity: number;
  toppings: { productId: string; quantity: number }[];
  quickNotes: string[];
  note: string | null;
};

export type OpenItemLineInput = {
  id: string;
  lineType: 'OpenItem';
  name: string;
  unitPrice: number;
  quantity: number;
  note: string | null;
};

export type LineInput = ItemLineInput | OpenItemLineInput;

/** 5.1 Mở đơn (id do máy sinh). `tableId: null` = mang về. */
export function openOrderCmd(
  ctx: Ctx,
  input: { orderId: string; branchId: string; tableId: string | null; guestCount?: number | null; allowSharedTable?: boolean }
): FnbCommand {
  return {
    method: 'PUT',
    path: endpoints.fnb.order(input.orderId),
    body: {
      ...envelope(ctx),
      branchId: input.branchId,
      tableId: input.tableId,
      guestCount: input.guestCount ?? null,
      customerId: null,
      note: null,
      clientOrderNo: null,
      allowSharedTable: !!input.allowSharedTable,
    },
  };
}

/** 5.5 Thêm dòng; có `sendTicketId` thì gửi bar luôn. */
export function addLinesCmd(ctx: Ctx, orderId: string, lines: LineInput[], sendTicketId: string | null): FnbCommand {
  return {
    method: 'POST',
    path: endpoints.fnb.orderLines(orderId),
    body: { ...envelope(ctx), lines, send: sendTicketId ? { ticketId: sendTicketId } : null },
  };
}

/** 5.7 Gửi bar các dòng đang giữ (`lineIds: null` = tất cả). */
export function sendCmd(ctx: Ctx, orderId: string, ticketId: string, lineIds: string[] | null = null): FnbCommand {
  return { method: 'POST', path: endpoints.fnb.orderSend(orderId), body: { ...envelope(ctx), ticketId, lineIds } };
}

/** 5.6 Bỏ một dòng chưa gửi (quantity 0). */
export function removePendingLineCmd(ctx: Ctx, orderId: string, line: IOpenOrder['lines'][number]): FnbCommand {
  const fields =
    line.lineType === 'OpenItem'
      ? { name: line.name, unitPrice: line.unitPrice, quantity: 0, note: line.note }
      : {
          productId: line.productId,
          quantity: 0,
          toppings: line.toppings.map((t) => ({ productId: t.productId, quantity: t.quantity })),
          quickNotes: line.quickNotes,
          note: line.note,
        };
  return { method: 'PUT', path: endpoints.fnb.orderLine(orderId, line.id), body: { ...envelope(ctx), ...fields } };
}

/** 5.8 Huỷ món đã gửi — bắt buộc lý do; tạo phiếu "HỦY". */
export function voidCmd(
  ctx: Ctx,
  order: Pick<IOpenOrder, 'id' | 'version'>,
  input: { reason: string; alreadyMade: boolean; lines: { lineId: string; quantity: number }[] }
): FnbCommand {
  return {
    method: 'POST',
    path: endpoints.fnb.orderVoid(order.id),
    body: {
      ...envelope(ctx),
      baseVersion: order.version,
      ticketId: newId(),
      reason: input.reason.trim(),
      alreadyMade: input.alreadyMade,
      lines: input.lines,
    },
  };
}

export type MoveTarget =
  | { kind: 'existing'; orderId: string }
  | { kind: 'create'; orderId: string; tableId: string | null; guestCount?: number | null };

/** 5.9 Chuyển món (đổi bàn / gộp / tách). */
export function moveCmd(
  ctx: Ctx,
  source: Pick<IOpenOrder, 'id' | 'version'>,
  target: MoveTarget,
  lines: { lineId: string; quantity: number; newLineId: string | null }[]
): FnbCommand {
  return {
    method: 'POST',
    path: endpoints.fnb.orderMove(source.id),
    body: {
      ...envelope(ctx),
      baseVersion: source.version,
      target: {
        orderId: target.orderId,
        create:
          target.kind === 'create'
            ? { tableId: target.tableId, guestCount: target.guestCount ?? null, clientOrderNo: null }
            : null,
      },
      lines,
    },
  };
}

/** 5.11 Giảm giá cả đơn (quản lý). `type: null` = bỏ giảm giá. */
export function discountCmd(
  ctx: Ctx,
  order: Pick<IOpenOrder, 'id' | 'version'>,
  input: { type: 'Percent' | 'Amount' | null; value: number; reason: string }
): FnbCommand {
  return {
    method: 'PUT',
    path: endpoints.fnb.orderDiscount(order.id),
    body: {
      ...envelope(ctx),
      baseVersion: order.version,
      type: input.type,
      value: input.type ? input.value : null,
      reason: input.type ? input.reason.trim() : null,
    },
  };
}

/** 5.12 Tạm tính. */
export function billCmd(ctx: Ctx, order: Pick<IOpenOrder, 'id' | 'version'>): FnbCommand {
  return { method: 'POST', path: endpoints.fnb.orderBill(order.id), body: { ...envelope(ctx), baseVersion: order.version } };
}

export type CheckoutPayment = {
  method: FnbPaymentMethod;
  amount: number;
  bankAccountId: string | null;
  transactionRef: string | null;
};

/** 5.13 Thanh toán và đóng đơn. Còn dòng đang giữ thì gửi bar luôn trong cùng lệnh. */
export function checkoutCmd(
  ctx: Ctx,
  order: Pick<IOpenOrder, 'id' | 'version'>,
  input: { expectedTotal: number; payments: CheckoutPayment[]; cashTendered: number | null; sendPending: boolean }
): FnbCommand {
  return {
    method: 'POST',
    path: endpoints.fnb.orderCheckout(order.id),
    body: {
      ...envelope(ctx),
      baseVersion: order.version,
      expectedTotal: input.expectedTotal,
      payments: input.payments,
      cashTendered: input.cashTendered,
      sendTicketId: input.sendPending ? newId() : null,
    },
  };
}

/** 5.14 Huỷ cả đơn. Có món đã gửi thì cần lý do + phiếu "HỦY". */
export function cancelCmd(
  ctx: Ctx,
  order: Pick<IOpenOrder, 'id' | 'version'>,
  input: { hasSentLines: boolean; reason: string | null; alreadyMade: boolean }
): FnbCommand {
  return {
    method: 'POST',
    path: endpoints.fnb.orderCancel(order.id),
    body: {
      ...envelope(ctx),
      baseVersion: order.version,
      reason: input.reason?.trim() || null,
      alreadyMade: input.alreadyMade,
      ticketId: input.hasSentLines ? newId() : null,
    },
  };
}

/** 6.4 Báo kết quả in phiếu bar (web in qua hộp thoại in của trình duyệt). */
export function printResultCmd(
  ctx: Ctx & { deviceName: string },
  ticketId: string,
  input: { result: 'Printed' | 'Failed' | 'Skipped'; error?: string | null; reprint?: boolean }
): FnbCommand {
  return {
    method: 'POST',
    path: endpoints.fnb.ticketPrintResult(ticketId),
    body: {
      ...envelope(ctx),
      deviceName: ctx.deviceName,
      result: input.result,
      error: input.error ?? null,
      reprint: !!input.reprint,
    },
  };
}
