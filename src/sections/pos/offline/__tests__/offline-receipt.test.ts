import { describe, expect, it, vi } from 'vitest';

import type { OutboxEntry } from '../pos-outbox';
import { EMPTY_PRINT_KIT, loadPrintKit, refreshPrintKit, rememberReceiptForKit } from '../pos-print-kit';
import { formatVnLocal, paymentMethodKey, buildOfflineReceipt, OFFLINE_RECEIPT_NOTE } from '../offline-receipt';

const entry = (over: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: 'req-1',
  payload: {
    clientRequestId: 'req-1',
    totalPayment: 62000,
    discount: 5000,
    note: 'Khách quen | Mã tạm: Q7-261112-003',
    invoiceDetails: [
      { productId: 'p1', productCode: 'SP015838', productName: 'Kéo', quantity: 2, price: 20000, discount: 0 },
      { productId: 'p2', productCode: 'SP000928', productName: 'Kéo bấm', quantity: 1, price: 30000, discount: 3000 },
    ],
    payments: [{ method: 'Cash', amount: 59000 }],
    cashTendered: 100000,
  },
  label: 'Hóa đơn 1',
  customerName: 'Chị Hoa',
  total: 62000,
  itemCount: 3,
  createdAt: '2026-11-12T03:58:00.000Z',
  status: 'pending',
  attempts: 1,
  offlineCode: 'Q7-261112-003',
  ...over,
});

const KIT = {
  ...EMPTY_PRINT_KIT,
  store: { name: 'CiCi 21 Chùa Láng', address: '21 Chùa Láng', phone: '0900', taxCode: null, logoUrl: null },
  footer: 'Cảm ơn quý khách',
};

describe('buildOfflineReceipt', () => {
  it('phiếu tạm: mã tạm, giờ VN, dòng / tổng / tiền thối như máy chủ, ghi chú báo mã chính thức cấp sau', () => {
    const r = buildOfflineReceipt(entry(), {
      kit: KIT,
      fallbackStoreName: 'CiCi',
      cashierName: 'Bình Xuân',
      now: new Date('2026-11-12T04:00:00Z'),
    });

    expect(r.invoice).toMatchObject({
      code: 'Q7-261112-003',
      createdAtLocal: '12/11/2026 10:58',
      cashierName: 'Bình Xuân',
      customerName: 'Chị Hoa',
      isCancelled: false,
    });
    expect(r.invoice.note).toBe(`Khách quen | Mã tạm: Q7-261112-003\n${OFFLINE_RECEIPT_NOTE}`);
    expect(r.lines.map((l) => [l.lineNo, l.name, l.lineTotal])).toEqual([
      [1, 'Kéo', 40000],
      [2, 'Kéo bấm', 27000],
    ]);
    expect(r.totals).toEqual({
      subTotal: 70000,
      discount: 5000,
      discountTotal: 8000,
      total: 62000,
      paid: 59000,
      remaining: 3000,
      cashTendered: 100000,
      changeDue: 41000,
    });
    expect(r.payments).toEqual([
      { method: 'Cash', methodLabel: 'Tiền mặt', amount: 59000, reference: null, paidAtLocal: '12/11/2026 10:58' },
    ]);
    expect(r).toMatchObject({
      store: KIT.store,
      footer: 'Cảm ơn quý khách',
      printedAtLocal: '12/11/2026 11:00',
      channel: 'pos',
      paymentMethod: 'cash',
      transferQr: null,
    });
  });

  it('chưa lưu được thông tin cửa hàng → tên dự phòng; nhiều phương thức → không chọn mẫu theo phương thức', () => {
    const r = buildOfflineReceipt(
      entry({
        payload: {
          ...entry().payload,
          payments: [
            { method: 'Cash', amount: 30000 },
            { method: 'BankTransfer', amount: 32000, transactionRef: 'QR tĩnh Q7-261112-003 — chưa đối soát' },
          ],
          cashTendered: undefined,
        },
      }),
      { kit: EMPTY_PRINT_KIT, fallbackStoreName: 'CiCi', cashierName: null }
    );
    expect(r.store.name).toBe('CiCi');
    expect(r.paymentMethod).toBeNull();
    expect(r.payments[1]).toMatchObject({ methodLabel: 'Chuyển khoản', reference: 'QR tĩnh Q7-261112-003 — chưa đối soát' });
    expect(r.totals.changeDue).toBeNull();
  });

  it('mã phương thức như core-be; giờ VN', () => {
    expect(['Cash', 'BankTransfer', 'transfer', 'Card', 'EWallet', 'x'].map(paymentMethodKey)).toEqual([
      'cash',
      'transfer',
      'transfer',
      'card',
      'wallet',
      null,
    ]);
    expect(formatVnLocal('2026-11-11T23:30:00Z')).toBe('12/11/2026 06:30');
  });
});

describe('bộ in', () => {
  it('tải lại: phần nào lỗi giữ bản đã lưu của phần đó', async () => {
    await rememberReceiptForKit({ store: KIT.store, branch: null, footer: 'cũ' } as any);
    const kit = await refreshPrintKit({
      getPrintTemplates: vi.fn().mockResolvedValue({ templates: [], assignments: [] }),
      latestReceipt: vi.fn().mockRejectedValue('Something went wrong'),
      bankAccounts: vi.fn().mockResolvedValue([{ id: 'acc', bin: '970416', accountNumber: '123' }]),
    });
    expect(kit.footer).toBe('cũ');
    expect(kit.store?.name).toBe('CiCi 21 Chùa Láng');
    expect(kit.templates).toEqual({ templates: [], assignments: [] });
    expect(kit.bankAccounts).toHaveLength(1);
    expect((await loadPrintKit()).bankAccounts).toHaveLength(1);
  });
});
