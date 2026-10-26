import { describe, expect, it } from 'vitest';

import { storeHighlights } from '../store-highlights';

// ----------------------------------------------------------------------
// Ô cam kết trang sản phẩm theo dữ liệu từng cửa hàng — không còn chữ cứng "21 Chùa Láng", "MoMo / ZaloPay".
// ----------------------------------------------------------------------

const titles = (input: Parameters<typeof storeHighlights>[0]) => storeHighlights(input).map((h) => h.title);

describe('storeHighlights', () => {
  it('uses the store address and its messaging channels', () => {
    const [, advice] = storeHighlights({ address: ' 21 Chùa Láng, Hà Nội ', canMessage: true });
    expect(advice.description).toBe('Ghé cửa hàng tại 21 Chùa Láng, Hà Nội hoặc nhắn tin để được tư vấn trực tiếp.');
  });

  it('words the advice line from what the store has', () => {
    expect(storeHighlights({ address: '12 Lê Lợi' })[1].description).toBe(
      'Ghé cửa hàng tại 12 Lê Lợi để được tư vấn trực tiếp.'
    );
    expect(storeHighlights({ canMessage: true })[1].description).toBe(
      'Nhắn tin cho cửa hàng để được tư vấn trực tiếp.'
    );
  });

  it('lists only the online payment methods the store has on', () => {
    const pay = storeHighlights({ paymentMethods: ['bank_transfer', 'bank_transfer', 'vnpay'] }).at(-1)!;
    expect(pay.title).toBe('Thanh toán online');
    expect(pay.description).toBe(
      'Đặt hàng ngay trên trang, thanh toán bằng chuyển khoản ngân hàng (VietQR) hoặc thẻ ATM, Visa/Master, ví (VNPay).'
    );
  });

  it('drops a box when the store has no data for it', () => {
    expect(titles({})).toEqual(['Hàng kiểm định kỹ']);
    expect(titles({ address: '  ', paymentMethods: [] })).toEqual(['Hàng kiểm định kỹ']);
    expect(titles({ paymentMethods: ['momo'] })).toEqual(['Hàng kiểm định kỹ']);
  });

  it('never falls back to another store’s text', () => {
    const text = JSON.stringify(storeHighlights({ address: '5 Hàng Bài', canMessage: true, paymentMethods: ['payos'] }));
    expect(text).not.toMatch(/Chùa Láng|MoMo|ZaloPay|Tiền mặt/);
  });
});
