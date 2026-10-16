import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { ThemeProvider, createTheme } from '@mui/material/styles';

vi.mock('src/utils/format-number', () => ({ fCurrency: (v: number) => `${v} đ` }));

import { CustomerDisplayScreen } from '../customer-display-view';
import {
  composeView,
  customerDisplay,
  PAID_SCREEN_MS,
  resetCustomerDisplayForTests,
  type CustomerDisplayCart,
} from '../customer-display-bus';

// ----------------------------------------------------------------------
// Màn hình khách: ưu tiên "đã thanh toán" > QR > giỏ hàng > quảng cáo; trang bán hàng đẩy qua BroadcastChannel và
// cửa sổ màn khách hiện đúng nội dung (jsdom có BroadcastChannel của Node — cùng tiến trình nhận được).
// ----------------------------------------------------------------------

const cart: CustomerDisplayCart = {
  lines: [{ key: 'p1', name: 'Áo thun', quantity: 2, unitPrice: 100000, discount: 0, amount: 200000 }],
  itemCount: 2,
  subtotal: 200000,
  vat: 0,
  orderDiscount: 0,
  total: 200000,
  customerName: 'Chị Lan',
};
const qr = { amount: 200000, imageSrc: 'data:image/png;base64,AAAA', bankName: 'MB', accountNumber: '0123', paymentCode: 'SP123' };

describe('composeView', () => {
  it('orders paid > qr > cart > idle', () => {
    const now = 1000;
    expect(composeView({ cart: null, qr: null, paid: null }, now)).toEqual({ mode: 'idle' });
    expect(composeView({ cart: { ...cart, lines: [] }, qr: null, paid: null }, now)).toEqual({ mode: 'idle' });
    expect(composeView({ cart, qr: null, paid: null }, now).mode).toBe('cart');
    expect(composeView({ cart, qr, paid: null }, now).mode).toBe('qr');
    expect(composeView({ cart, qr, paid: { amount: 1, until: now + 1 } }, now).mode).toBe('paid');
    expect(composeView({ cart, qr: null, paid: { amount: 1, until: now - 1 } }, now).mode).toBe('cart');
  });
});

describe('CustomerDisplayScreen', () => {
  beforeEach(() => resetCustomerDisplayForTests());
  afterEach(() => {
    vi.useRealTimers();
    resetCustomerDisplayForTests();
  });

  const renderScreen = () =>
    render(
      <ThemeProvider theme={createTheme()}>
        <CustomerDisplayScreen />
      </ThemeProvider>
    );

  // BroadcastChannel giao tin bất đồng bộ — chờ tới khi chữ hiện (máy bận / chạy nhiều suite cùng lúc thì >30ms).
  it('shows the cart, then the QR, then thanks after payment', async () => {
    renderScreen();
    customerDisplay.setAds({ intervalSeconds: 8, slides: [] }, 'Cửa hàng A');
    expect(await screen.findByText('Cửa hàng A')).toBeTruthy();

    customerDisplay.setCart(cart);
    expect(await screen.findByText('Áo thun')).toBeTruthy();
    expect(screen.getByText(/Chị Lan/)).toBeTruthy();

    customerDisplay.setQr(qr);
    expect(await screen.findByText('Quét mã để thanh toán')).toBeTruthy();
    expect(screen.getByText('SP123')).toBeTruthy();

    customerDisplay.paid(200000);
    expect(await screen.findByText('Cảm ơn quý khách!')).toBeTruthy();
    expect(PAID_SCREEN_MS).toBeGreaterThan(1000);
  });
});
