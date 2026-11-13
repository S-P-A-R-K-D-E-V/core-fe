import { it, vi, expect, describe, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

import {
  type CustomerDisplayView,
  subscribeCustomerDisplayView,
  resetCustomerDisplayForTests,
} from 'src/sections/customer-display/customer-display-bus';

import OfflineTransferQr from '../offline-transfer-qr';
import { buildVietQrPayload } from '../vietqr';

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const account = {
  id: 'acc-1',
  bin: '970436',
  accountNumber: '0123456789',
  bankName: 'Vietcombank',
  shortName: 'VCB',
  accountHolder: 'CUA HANG CICI',
  isDefault: true,
};

let views: CustomerDisplayView[] = [];

beforeEach(() => {
  cleanup();
  resetCustomerDisplayForTests();
  views = [];
  subscribeCustomerDisplayView((v) => views.push(v));
});

describe('QR tĩnh lên màn khách / máy QR', () => {
  it('hiện QR kèm chuỗi VietQR + số tiền; xác nhận → cảm ơn; đóng → ẩn', () => {
    const props = { amount: 125000, code: 'Q1-261113-7', accounts: [account], onConfirm: () => {} };
    const { rerender, unmount, getByRole } = render(<OfflineTransferQr {...props} confirmed={false} />);

    const shown = views[views.length - 1];
    expect(shown.mode).toBe('qr');
    if (shown.mode !== 'qr') return;
    expect(shown.qr.amount).toBe(125000);
    expect(shown.qr.payload).toBe(buildVietQrPayload('970436', '0123456789', 125000, 'Q1-261113-7'));
    expect(shown.qr.imageSrc).toMatch(/^data:image\/svg\+xml/);
    expect(shown.qr).toMatchObject({ bankName: 'VCB', accountNumber: '0123456789', accountName: 'CUA HANG CICI' });

    expect(getByRole('button', { name: /Đã nhận chuyển khoản/ })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: /Đã nhận chuyển khoản/ }));
    rerender(<OfflineTransferQr {...props} confirmed />);
    expect(views[views.length - 1]).toEqual({ mode: 'paid', amount: 125000 });

    unmount();
    // Vẫn đang "cảm ơn" vài giây; QR đã gỡ.
    expect(views[views.length - 1].mode).toBe('paid');
  });

  it('chưa có mã tạm → không hiện QR', () => {
    render(<OfflineTransferQr amount={1000} code={null} accounts={[account]} confirmed={false} onConfirm={() => {}} />);
    expect(views[views.length - 1].mode).toBe('idle');
  });
});
