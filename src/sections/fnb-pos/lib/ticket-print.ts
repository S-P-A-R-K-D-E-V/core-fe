import type { IKitchenTicket } from 'src/types/fnb';

import { problemCode } from './errors';

// ----------------------------------------------------------------------
// In một phiếu bar theo giao thức hợp đồng 6.1–6.4: giữ quyền in (6.3) → in → báo kết quả (6.4). Dùng cho "Máy in phiếu"
// và nút "In" ở danh sách phiếu chưa in. In lại (reprint) chỉ ghi nhật ký, không cần giữ quyền và không đổi trạng thái.
// Các bước gọi ngoài truyền vào để test được.
// ----------------------------------------------------------------------

export type TicketPrintDeps = {
  claim: (ticketId: string, reprint: boolean) => Promise<IKitchenTicket>;
  print: (ticket: IKitchenTicket, reprint: boolean) => Promise<void>;
  report: (ticketId: string, result: 'Printed' | 'Failed', error: string | null, reprint: boolean) => Promise<unknown>;
};

/** printed: đã in; busy: máy khác đang giữ quyền in; done: phiếu đã in ở máy khác; failed: in hỏng (đã báo Failed). */
export type TicketPrintOutcome = 'printed' | 'busy' | 'done' | 'failed';

export async function printTicketFlow(
  ticket: IKitchenTicket,
  deps: TicketPrintDeps,
  reprint = false
): Promise<{ outcome: TicketPrintOutcome; error?: string }> {
  let claimed: IKitchenTicket;
  try {
    claimed = await deps.claim(ticket.id, reprint);
  } catch (error) {
    const code = problemCode(error);
    if (code === 'KitchenTicket.PrintInProgress') return { outcome: 'busy' };
    if (code === 'KitchenTicket.AlreadyPrinted') return { outcome: 'done' };
    throw error;
  }

  try {
    await deps.print(claimed, reprint);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không in được';
    await deps.report(ticket.id, 'Failed', message.slice(0, 255), reprint).catch(() => {});
    return { outcome: 'failed', error: message };
  }

  await deps.report(ticket.id, 'Printed', null, reprint);
  return { outcome: 'printed' };
}

/**
 * Phiếu Máy in phiếu nên nhận lúc này: chưa in (Pending / Failed / Skipped), và không bị máy khác giữ quyền còn hạn —
 * phiếu web vừa tạo được máy tạo phiếu giữ 30 giây để tự in. Cũ trước, phiếu đã xử lý ở máy này thì bỏ qua.
 */
export function stationQueue(
  tickets: readonly IKitchenTicket[],
  now: number,
  deviceId: string,
  handled: ReadonlySet<string>
): IKitchenTicket[] {
  return tickets
    .filter((t) => t.printStatus !== 'Printed' && !handled.has(t.id))
    .filter(
      (t) =>
        !t.claimedByDeviceId ||
        t.claimedByDeviceId === deviceId ||
        !t.claimExpiresAt ||
        Date.parse(t.claimExpiresAt) <= now
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
