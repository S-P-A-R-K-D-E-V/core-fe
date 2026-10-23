import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IShippingCarrier } from 'src/types/online-shop';

// ----------------------------------------------------------------------
// Kết nối GHN bằng token nền tảng: cửa hàng chọn shop đã liên kết / được gán, hoặc liên kết shop bằng SĐT chủ shop + OTP.
// Không có ô token nào.
// ----------------------------------------------------------------------

const api = vi.hoisted(() => ({
  getCarrierAccounts: vi.fn(),
  sendCarrierOtp: vi.fn(),
  linkCarrierAccount: vi.fn(),
  createShippingConnection: vi.fn(),
}));
vi.mock('src/api/online-shop', () => api);
const snackbar = vi.hoisted(() => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => snackbar }));

// Imported after the mocks above.
import CarrierOtpConnect from '../settings/carrier-otp-connect';

const ghn: IShippingCarrier = {
  code: 'ghn',
  label: 'Giao Hàng Nhanh (GHN)',
  credentials: [{ key: 'shopId', label: 'Mã cửa hàng GHN (ShopId)', secret: false, required: true }],
  settings: [],
  environments: ['production', 'staging'],
  help: '',
  webhookHelp: '',
  connect: 'otp',
  platformWebhook: true,
};

const renderConnect = () => {
  const onSaved = vi.fn();
  render(
    <ThemeProvider theme={createTheme()}>
      <CarrierOtpConnect carrier={ghn} environment="production" displayName="" settings={{}} onSaved={onSaved} />
    </ThemeProvider>
  );
  return onSaved;
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('CarrierOtpConnect', () => {
  it('shop nền tảng gán: bấm Kết nối tạo kết nối bằng mã shop, không có ô token', async () => {
    api.getCarrierAccounts.mockResolvedValue([
      { accountRef: '885', name: 'CiCi Chùa Láng', address: '21 Chùa Láng', source: 'assigned', available: true, connectionIds: [] },
      { accountRef: '886', name: 'Kho Cầu Giấy', address: null, source: 'otp', available: true, connectionIds: ['c1'] },
    ]);
    api.createShippingConnection.mockResolvedValue({});
    const user = userEvent.setup();
    const onSaved = renderConnect();

    await user.click(await screen.findByRole('button', { name: 'Kết nối' }));

    expect(api.getCarrierAccounts).toHaveBeenCalledWith('ghn', 'production');
    expect(api.createShippingConnection).toHaveBeenCalledWith({
      carrier: 'ghn',
      environment: 'production',
      displayName: 'Giao Hàng Nhanh (GHN) — CiCi Chùa Láng',
      credentials: { shopId: '885' },
      settings: {},
    });
    expect(onSaved).toHaveBeenCalled();
    expect(screen.getByText('Nền tảng gán')).toBeInTheDocument();
    expect(screen.getByText('Đã kết nối')).toBeInTheDocument();
    expect(screen.queryByLabelText(/token/i)).toBeNull();
  });

  it('liên kết shop mới: SĐT → Gửi OTP → OTP + mã shop → liên kết rồi kết nối', async () => {
    api.getCarrierAccounts.mockResolvedValue([]);
    api.sendCarrierOtp.mockResolvedValue({ ttlSeconds: 600 });
    api.linkCarrierAccount.mockResolvedValue({ accountRef: '777', name: 'Shop 777', source: 'otp', available: true, connectionIds: [] });
    api.createShippingConnection.mockResolvedValue({});
    const user = userEvent.setup();
    const onSaved = renderConnect();

    expect(await screen.findByText(/Chưa có shop nào/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Mã OTP')).toBeNull();
    await user.type(screen.getByLabelText('SĐT chủ shop'), '+84 912 345 678');
    await user.click(screen.getByRole('button', { name: 'Gửi OTP' }));
    expect(api.sendCarrierOtp).toHaveBeenCalledWith('ghn', { environment: 'production', phone: '0912345678' });

    await user.type(await screen.findByLabelText('Mã OTP'), '123456');
    await user.type(screen.getByLabelText('Mã shop (ShopId)'), '777');
    await user.click(screen.getByRole('button', { name: 'Liên kết & kết nối' }));

    expect(api.linkCarrierAccount).toHaveBeenCalledWith('ghn', {
      environment: 'production',
      phone: '0912345678',
      otp: '123456',
      accountRef: '777',
    });
    await waitFor(() =>
      expect(api.createShippingConnection).toHaveBeenCalledWith(
        expect.objectContaining({ carrier: 'ghn', credentials: { shopId: '777' }, displayName: 'Giao Hàng Nhanh (GHN) — Shop 777' })
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('SĐT sai không gọi máy chủ; lỗi OTP hiện ra và không kết nối', async () => {
    api.getCarrierAccounts.mockResolvedValue([]);
    api.sendCarrierOtp.mockResolvedValue({ ttlSeconds: 600 });
    api.linkCarrierAccount.mockRejectedValue({ title: 'GHN: Mã OTP sai hoặc đã hết hạn', status: 400 });
    const user = userEvent.setup();
    const onSaved = renderConnect();

    await user.type(await screen.findByLabelText('SĐT chủ shop'), '12345');
    await user.click(screen.getByRole('button', { name: 'Gửi OTP' }));
    expect(api.sendCarrierOtp).not.toHaveBeenCalled();
    expect(screen.getByText('SĐT không hợp lệ (10 số, bắt đầu bằng 0)')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('SĐT chủ shop'));
    await user.type(screen.getByLabelText('SĐT chủ shop'), '0912345678');
    await user.click(screen.getByRole('button', { name: 'Gửi OTP' }));
    await user.type(await screen.findByLabelText('Mã OTP'), '000000');
    await user.type(screen.getByLabelText('Mã shop (ShopId)'), 'abc');
    expect(screen.getByRole('button', { name: 'Liên kết & kết nối' })).toBeDisabled();
    await user.clear(screen.getByLabelText('Mã shop (ShopId)'));
    await user.type(screen.getByLabelText('Mã shop (ShopId)'), '777');
    await user.click(screen.getByRole('button', { name: 'Liên kết & kết nối' }));

    expect(await screen.findByText('GHN: Mã OTP sai hoặc đã hết hạn')).toBeInTheDocument();
    expect(api.createShippingConnection).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    // Tải lại danh sách shop (phòng trường hợp đã liên kết mà kết nối lỗi).
    expect(api.getCarrierAccounts).toHaveBeenCalledTimes(2);
  });
});
