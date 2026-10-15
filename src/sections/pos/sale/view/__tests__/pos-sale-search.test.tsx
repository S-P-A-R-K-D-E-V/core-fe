import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor, cleanup, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Màn bán hàng (POS bán lẻ) — lỗi "không chọn được sản phẩm từ tìm kiếm" và các lỗi QA cùng màn:
//  - vào lại màn hình (điều hướng trong app): đơn tạm đầu có id ≠ activeOrderId → bấm sản phẩm không vào đơn;
//  - sản phẩm có phiên bản mở ngăn chọn phiên bản (ngăn này trước bị khung POS che — z-index);
//  - ↓ + Enter thêm đúng dòng đang chọn (trước: thêm cả kết quả đầu); quét mã + Enter thêm thẳng, quét lại cộng số lượng;
//  - xoá trắng ô số lượng không xoá dòng; thanh toán lỗi giữ nguyên số tiền đã nhập; F4, nút thoát.
// ----------------------------------------------------------------------

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => snackbar }));
vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/utils/format-number', () => ({
  fNumber: (value: number) => String(value ?? ''),
  fCurrency: (value: number) => String(value ?? ''),
}));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({
    user: { firstName: 'Lan', lastName: 'Nguyễn', email: 'lan@example.com' },
  }),
}));

const inv = (onHand: number) => [
  { id: `inv-${onHand}`, productId: 'x', branchId: 1, onHand, reserved: 0 },
];

const KEP = {
  id: 'p-kep',
  code: 'SP000123',
  sku: 'SP000123',
  barCode: '8930001',
  name: 'Kẹp tóc nơ nhung đỏ',
  categoryName: 'Phụ kiện',
  hasVariants: false,
  basePrice: 35000,
  sellingPrice: 35000,
  productType: 2,
  isActive: true,
  minQuantity: 0,
  maxQuantity: 0,
  createdDate: '2026-10-01T02:00:00Z',
  inventories: inv(10),
};

const KEP_XANH = {
  ...KEP,
  id: 'p-kep-xanh',
  code: 'SP000124',
  sku: 'SP000124',
  barCode: '8930002',
  name: 'Kẹp tóc nơ xanh',
};

const VI = {
  ...KEP,
  id: 'p-vi',
  code: 'SP015256',
  sku: 'SP015256',
  barCode: '',
  name: 'Ví thời trang',
  hasVariants: true,
  basePrice: 70000,
  sellingPrice: 70000,
  inventories: inv(2),
  childProducts: [
    {
      id: 'c-85',
      code: 'SP015259',
      barCode: '8935259',
      name: 'Ví thời trang',
      fullName: 'Ví thời trang - 85',
      basePrice: 85000,
      isActive: true,
      inventories: inv(5),
      attributes: [{ id: 'a-85', attributeName: 'GIÁ TRỊ', attributeValue: '85' }],
    },
  ],
};

const ALL: Array<typeof KEP & { childProducts?: typeof VI.childProducts }> = [KEP, KEP_XANH, VI];

const getAllProducts = vi.fn();
vi.mock('src/api/products', () => ({
  getAllProducts: (...args: any[]) => getAllProducts(...args),
  getChildProducts: () => Promise.resolve([]),
}));
vi.mock('src/api/customers', () => ({
  getAllCustomers: () => Promise.resolve([{ id: 'cus-1', name: 'Chị Hoa', phone: '0900000001' }]),
}));
vi.mock('src/api/warehouses', () => ({
  getAllWarehouses: () =>
    Promise.resolve([
      {
        id: 'wh-1',
        name: 'Kho chính',
        isDefault: true,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]),
}));

const createSalesOrder = vi.fn();
vi.mock('src/api/sales-orders', () => ({
  createSalesOrder: (...args: any[]) => createSalesOrder(...args),
  getSalesOrderReceipt: () => Promise.resolve(null),
}));
vi.mock('src/api/bank-accounts', () => ({ getBankAccounts: () => Promise.resolve([]) }));

vi.mock('../../pos-discount-popover', () => ({ default: () => null }));
vi.mock('../../pos-product-detail-drawer', () => ({ default: () => null }));
vi.mock('../../pos-payment-drawer', () => ({ default: () => null }));
vi.mock('../../pos-qr-payment', () => ({ default: () => null }));
vi.mock('src/sections/pos/receipt-print/receipt-print-dialog', () => ({ default: () => null }));
vi.mock('src/sections/customer-display/use-customer-display-sync', () => ({
  useCustomerDisplaySync: () => {},
}));

// Màn bán hàng nặng trong jsdom: khi cả bộ test chạy song song một test mất vài giây — cho rộng thời gian chờ.
configure({ asyncUtilTimeout: 5000 });

// Imported after the mocks above so the view picks up the mocked modules.
import PosSaleView from '../pos-sale-view';

function search(keyword?: string) {
  if (!keyword) return ALL;
  const k = keyword.toLowerCase();
  return ALL.filter(
    (p) =>
      p.name.toLowerCase().includes(k) ||
      p.code.toLowerCase().includes(k) ||
      p.barCode === keyword ||
      (p.childProducts ?? []).some((c) => c.code.toLowerCase() === k || c.barCode === keyword)
  );
}

const renderView = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <PosSaleView />
    </ThemeProvider>
  );

const searchBox = () => screen.getByPlaceholderText('Tìm hàng hóa (F3)');
/** Bảng hàng trong đơn (chỉ có khi đơn có hàng). */
const cart = () => screen.getByRole('table');
const cartRows = () => within(cart()).getAllByRole('row').slice(1);

async function ready() {
  await waitFor(() => expect(getAllProducts).toHaveBeenCalled());
  // Kho đã tải và hiện trong ô "Kho xuất"
  await waitFor(() => expect(screen.getByDisplayValue('Kho chính')).toBeInTheDocument());
}

beforeEach(() => {
  window.localStorage.clear();
  getAllProducts.mockImplementation(async (params?: { keyword?: string }) => {
    const items = search(params?.keyword);
    return { items, totalCount: items.length, page: 1, pageSize: 25 };
  });
  createSalesOrder.mockResolvedValue({ id: 'so-1', kiotVietSyncStatus: 'NotPushed' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('PosSaleView — tìm và chọn sản phẩm', { timeout: 30000 }, () => {
  it('mở lại màn hình lần hai vẫn chọn được sản phẩm từ tìm kiếm (đơn tạm đầu khớp tab đang chọn)', async () => {
    const user = userEvent.setup({ delay: null });
    const first = renderView();
    await ready();
    first.unmount();

    renderView();
    await ready();
    await user.type(searchBox(), 'Kẹp tóc nơ nhung');
    await user.click(await screen.findByRole('option', { name: /Kẹp tóc nơ nhung đỏ/ }));

    expect(within(cart()).getByText('SP000123')).toBeInTheDocument();
    expect(searchBox()).toHaveValue('');
  });

  it('sản phẩm có phiên bản: mở ngăn chọn phiên bản, chọn xong vào đơn với thuộc tính', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await ready();

    await user.type(searchBox(), 'Ví');
    const option = await screen.findByRole('option', { name: /Ví thời trang/ });
    expect(within(option).getByText('1 phiên bản')).toBeInTheDocument();
    await user.click(option);

    const drawer = await screen.findByRole('presentation');
    expect(within(drawer).getByText('Chọn thuộc tính')).toBeInTheDocument();
    await user.click(within(drawer).getByText('SP015259'));

    await waitFor(() => expect(within(cart()).getByText('SP015259')).toBeInTheDocument());
    expect(within(cart()).getByText('85')).toBeInTheDocument();
  });

  it('↓ rồi Enter thêm đúng sản phẩm đang chọn, chỉ một lần', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await ready();

    await user.type(searchBox(), 'Kẹp tóc');
    await screen.findByRole('option', { name: /Kẹp tóc nơ xanh/ });
    await user.keyboard('{ArrowDown}{Enter}');

    expect(cartRows()).toHaveLength(1);
    expect(within(cart()).getByText('SP000124')).toBeInTheDocument();
    expect(within(cart()).queryByText('SP000123')).not.toBeInTheDocument();
  });

  it('quét mã vạch + Enter (trước khi kết quả tìm về) thêm thẳng; quét lại cộng số lượng; mã phiên bản thêm phiên bản', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await ready();

    await user.type(searchBox(), '8930001{Enter}');
    await waitFor(() => expect(within(cart()).getByText('SP000123')).toBeInTheDocument());
    await waitFor(() => expect(searchBox()).toHaveValue(''));

    await user.type(searchBox(), '8930001{Enter}');
    await waitFor(() => expect(within(cart()).getByLabelText('Số lượng')).toHaveValue('2'));

    await user.type(searchBox(), '8935259{Enter}');
    await waitFor(() => expect(within(cart()).getByText('SP015259')).toBeInTheDocument());
    expect(screen.queryByText('Chọn thuộc tính')).not.toBeInTheDocument();
  });

  it('quét mã không có: báo không tìm thấy', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await ready();

    await user.type(searchBox(), 'KHONGCO{Enter}');

    await waitFor(() =>
      expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith('Không tìm thấy sản phẩm "KHONGCO"', {
        variant: 'warning',
      })
    );
  });
});

describe('PosSaleView — dòng hàng, thanh toán, phím tắt', { timeout: 30000 }, () => {
  async function addKep(user: ReturnType<typeof userEvent.setup>) {
    await user.type(searchBox(), '8930001{Enter}');
    await waitFor(() => expect(within(cart()).getByText('SP000123')).toBeInTheDocument());
  }

  it('xoá trắng ô số lượng không xoá dòng; gõ số mới / −, + đổi số lượng', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await ready();
    await addKep(user);

    const qty = within(cart()).getByLabelText('Số lượng');
    await user.clear(qty);
    expect(cartRows()).toHaveLength(1);
    await user.type(qty, '3');
    expect(qty).toHaveValue('3');

    await user.click(within(cart()).getByRole('button', { name: 'Tăng số lượng' }));
    expect(qty).toHaveValue('4');
    await user.click(within(cart()).getByRole('button', { name: 'Giảm số lượng' }));
    expect(qty).toHaveValue('3');

    // bỏ ra ngoài khi ô trống → trả lại số cũ
    await user.clear(qty);
    await user.tab();
    expect(qty).toHaveValue('3');
  });

  it('tạo hoá đơn lỗi: giữ đơn và số tiền khách trả để thử lại', async () => {
    const user = userEvent.setup({ delay: null });
    createSalesOrder.mockRejectedValueOnce({ title: 'Mất kết nối' });
    renderView();
    await ready();
    await addKep(user);

    const amount = screen.getByPlaceholderText('Số tiền');
    await waitFor(() => expect(amount).toHaveValue(35000));
    await user.click(screen.getByRole('button', { name: 'THANH TOÁN' }));

    await waitFor(() =>
      expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith('Mất kết nối', { variant: 'error' })
    );
    expect(screen.getByPlaceholderText('Số tiền')).toHaveValue(35000);
    expect(within(cart()).getByText('SP000123')).toBeInTheDocument();

    // thử lại được ngay
    await user.click(screen.getByRole('button', { name: 'THANH TOÁN' }));
    await waitFor(() => expect(createSalesOrder).toHaveBeenCalledTimes(2));
    expect(createSalesOrder.mock.calls[1][0]).toMatchObject({
      warehouseId: 'wh-1',
      payments: [{ method: 'Cash', amount: 35000 }],
    });
  });

  it('F4 đưa con trỏ vào ô tìm khách hàng; nút thoát dẫn về dashboard', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await ready();

    await user.keyboard('{F4}');
    expect(screen.getByPlaceholderText('Tìm khách hàng (F4)')).toHaveFocus();

    expect(screen.getByRole('link', { name: 'Thoát màn bán hàng' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });
});
