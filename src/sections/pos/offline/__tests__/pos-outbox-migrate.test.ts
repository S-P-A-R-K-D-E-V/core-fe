import { expect, it, vi } from 'vitest';

import { posOutbox } from '../pos-outbox';

// Hàng chờ bản GĐ0 (localStorage "pos_pending_sales", có purchaseDate trong payload) chuyển sang outbox khi mở màn bán
// hàng bản mới; khoá cũ bị xoá. jsdom không có IndexedDB → outbox nằm ở localStorage "pos_outbox".
it('chuyển hàng chờ cũ (GĐ0) sang outbox rồi xoá khoá cũ', async () => {
  localStorage.setItem(
    'pos_pending_sales',
    JSON.stringify([
      {
        id: 'req-1',
        payload: {
          clientRequestId: 'req-1',
          totalPayment: 30000,
          purchaseDate: '2026-11-12T03:00:00.000Z',
          invoiceDetails: [{ productId: 'p', quantity: 1, price: 30000 }],
        },
        label: 'Hóa đơn 1',
        total: 30000,
        itemCount: 1,
        createdAt: '2026-11-12T03:00:00.000Z',
        attempts: 2,
        status: 'failed',
        lastError: 'Giá sai',
      },
    ])
  );
  localStorage.setItem('pos_recent_sales', '[]');

  const outbox = posOutbox();

  await vi.waitFor(async () => expect(await outbox.list()).toHaveLength(1));
  const [entry] = await outbox.list();
  expect(entry).toMatchObject({ id: 'req-1', status: 'failed', attempts: 2, lastError: 'Giá sai' });
  expect(entry.payload).not.toHaveProperty('purchaseDate');
  expect(entry.createdAt).toBe('2026-11-12T03:00:00.000Z');
  expect(localStorage.getItem('pos_pending_sales')).toBeNull();
  expect(localStorage.getItem('pos_recent_sales')).toBeNull();
});
