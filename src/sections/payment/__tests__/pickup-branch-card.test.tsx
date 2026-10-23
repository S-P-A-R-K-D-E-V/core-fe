import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IPickupBranch, IOnlineShopSettings } from 'src/types/online-shop';

// ----------------------------------------------------------------------
// Chi nhánh gửi hàng: chọn chi nhánh hãng đến lấy hàng, nhập địa chỉ gửi hàng có cấu trúc (tỉnh / phường theo danh mục).
// ----------------------------------------------------------------------

const api = vi.hoisted(() => ({
  getProvinces: vi.fn(),
  getWards: vi.fn(),
  updateBranchPickupAddress: vi.fn(),
}));
vi.mock('src/api/online-shop', () => api);
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));

// Imported after the mocks above.
import PickupBranchCard from '../settings/pickup-branch-card';

const main: IPickupBranch = {
  id: 'b1',
  name: 'CiCi Chùa Láng',
  isActive: true,
  address: '21 Chùa Láng, Đống Đa, Hà Nội',
  contactNumber: '0243111222',
  hasLocation: true,
  pickup: {
    senderName: 'CiCi Accessories',
    phone: '0375251115',
    provinceCode: '01',
    provinceName: 'Thành phố Hà Nội',
    wardCode: '00199',
    wardName: 'Phường Láng',
    street: '21 Chùa Láng',
  },
};
const kho: IPickupBranch = { id: 'b2', name: 'Kho Cầu Giấy', isActive: true, address: null, hasLocation: false, pickup: null };
const closed: IPickupBranch = { ...main, id: 'b3', name: 'Chi nhánh đã đóng', isActive: false };

const settings = (effective: string | null, branches: IPickupBranch[]): IOnlineShopSettings =>
  ({ effectivePickupBranchId: effective, branches } as IOnlineShopSettings);

const renderCard = (s: IOnlineShopSettings) => {
  const onChange = vi.fn();
  const onRefresh = vi.fn();
  render(
    <ThemeProvider theme={createTheme()}>
      <PickupBranchCard settings={s} value={null} onChange={onChange} onRefresh={onRefresh} />
    </ThemeProvider>
  );
  return { onChange, onRefresh };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('PickupBranchCard', () => {
  it('hiện chi nhánh đang dùng, chi nhánh chưa có địa chỉ, ẩn chi nhánh đã đóng', () => {
    renderCard(settings('b1', [main, kho, closed]));

    expect(screen.getByText('Đang dùng')).toBeInTheDocument();
    expect(screen.getByText(/21 Chùa Láng, Phường Láng, Thành phố Hà Nội · CiCi Accessories · 0375251115/)).toBeInTheDocument();
    expect(screen.getByText(/Chưa có địa chỉ gửi hàng/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhập địa chỉ gửi hàng' })).toBeInTheDocument();
    expect(screen.queryByText('Chi nhánh đã đóng')).toBeNull();
    expect(screen.getByText('Đang tự động dùng: CiCi Chùa Láng')).toBeInTheDocument();
  });

  it('chưa chi nhánh nào có địa chỉ gửi hàng thì cảnh báo', () => {
    renderCard(settings(null, [kho]));

    expect(screen.getByText(/Chưa có chi nhánh nào có địa chỉ gửi hàng/)).toBeInTheDocument();
  });

  it('sửa địa chỉ gửi hàng: điền sẵn địa chỉ cũ, lưu gửi mã tỉnh / phường rồi tải lại danh sách', async () => {
    api.getProvinces.mockResolvedValue([{ code: '01', name: 'Thành phố Hà Nội' }]);
    api.getWards.mockResolvedValue([{ code: '00199', name: 'Phường Láng' }]);
    api.updateBranchPickupAddress.mockResolvedValue(main);
    const user = userEvent.setup();
    const { onRefresh } = renderCard(settings('b1', [main, kho]));

    await user.click(screen.getByRole('button', { name: 'Sửa' }));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Phường / xã *')).toHaveValue('Phường Láng'));
    const street = within(dialog).getByLabelText('Số nhà, tên đường *');
    await user.clear(street);
    await user.type(street, '23 Chùa Láng');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(api.updateBranchPickupAddress).toHaveBeenCalledWith('b1', {
      senderName: 'CiCi Accessories',
      phone: '0375251115',
      provinceCode: '01',
      wardCode: '00199',
      street: '23 Chùa Láng',
    });
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });
});
