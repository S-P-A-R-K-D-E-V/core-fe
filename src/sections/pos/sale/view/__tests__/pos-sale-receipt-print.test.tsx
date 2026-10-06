import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { normalReceipt } from 'src/sections/pos/receipt-print/__tests__/receipt-fixtures';

// ----------------------------------------------------------------------
// Màn bán hàng (POS) → nút máy in trên thanh trên cùng: trước đây bấm không có gì xảy ra; nay in phiếu
// thanh toán của hoá đơn VỪA BÁN. Không tự in sau khi bán — thu ngân bấm nút.
// ----------------------------------------------------------------------

// Trả về CÙNG một đối tượng mỗi lần render: nhiều callback của màn hình phụ thuộc enqueueSnackbar.
const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => snackbar,
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

vi.mock('src/utils/format-number', () => ({
  fNumber: (value: number) => String(value ?? ''),
  fCurrency: (value: number) => String(value ?? ''),
}));

const auth = { user: { firstName: 'Lan', lastName: 'Nguyễn', email: 'lan@example.com' } };
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => auth,
}));

const PRODUCT = {
  id: 'p-1',
  code: 'SP000123',
  sku: 'SP000123',
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
};

vi.mock('src/api/products', () => ({
  getAllProducts: () => Promise.resolve({ items: [PRODUCT], totalCount: 1 }),
}));

vi.mock('src/api/customers', () => ({
  getAllCustomers: () => Promise.resolve([]),
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
const getSalesOrderReceipt = vi.fn();
vi.mock('src/api/sales-orders', () => ({
  createSalesOrder: (...args: any[]) => createSalesOrder(...args),
  getSalesOrderReceipt: (...args: any[]) => getSalesOrderReceipt(...args),
}));

vi.mock('src/api/bank-accounts', () => ({
  getBankAccounts: () => Promise.resolve([]),
}));

const printHtmlDocument = vi.fn((_html: string) => Promise.resolve());
vi.mock('src/utils/print-html', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/utils/print-html')>()),
  printHtmlDocument: (html: string) => printHtmlDocument(html),
}));

// Các ngăn kéo / hộp phụ của màn bán hàng không liên quan tới việc in
vi.mock('../../pos-discount-popover', () => ({ default: () => null }));
vi.mock('../../pos-product-detail-drawer', () => ({ default: () => null }));
vi.mock('../../pos-variant-picker-drawer', () => ({ default: () => null }));
vi.mock('../../pos-payment-drawer', () => ({ default: () => null }));
vi.mock('../../pos-qr-payment', () => ({ default: () => null }));

// Imported after the mocks above so the view picks up the mocked modules.
import PosSaleView from '../pos-sale-view';

const SALE_ID = '3f0c1c1e-6c0d-4a53-9d0e-2a5b8a1f4c11';

const NOT_YET = 'In hoá đơn (chưa có hoá đơn vừa bán)';
const READY = 'In hoá đơn vừa bán';

const renderView = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <PosSaleView />
    </ThemeProvider>
  );

/** Lưới sản phẩm nằm ở tab "Bán thường". */
async function openProductGrid(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: 'Bán thường' }));
  return screen.findByText('Kẹp tóc nơ nhung đỏ');
}

/** Thêm một sản phẩm vào đơn rồi thanh toán bằng "Bán nhanh" (tiền mặt, đủ tiền). */
async function sellOne(user: ReturnType<typeof userEvent.setup>) {
  // Bộ đếm hoá đơn tạm nằm ở cấp module nên khi màn hình được dựng lại (test thứ hai trở đi) tab hoá
  // đơn chưa được chọn và hàng không vào đơn — bấm chọn tab trước, như người dùng phải làm.
  await user.click(screen.getByRole('tab', { name: /Hóa đơn/ }));
  await user.click(await openProductGrid(user));
  await user.click(screen.getByRole('tab', { name: 'Bán nhanh' }));
  const pay = screen.getByRole('button', { name: 'THANH TOÁN' });
  await waitFor(() => expect(pay).toBeEnabled());
  await user.click(pay);
  await waitFor(() => expect(createSalesOrder).toHaveBeenCalledTimes(1));
}

beforeEach(() => {
  window.localStorage.clear();
  createSalesOrder.mockResolvedValue({ id: SALE_ID, kiotVietSyncStatus: 'NotPushed' });
  getSalesOrderReceipt.mockResolvedValue(normalReceipt());
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('PosSaleView — nút máy in', () => {
  it('chưa bán hoá đơn nào: bấm nút chỉ nhắc, không mở hộp thoại in', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await openProductGrid(user);

    await user.click(screen.getByRole('button', { name: NOT_YET }));

    expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith(
      'Chưa có hoá đơn vừa bán để in. Hoá đơn cũ in ở trang Đơn bán hàng.',
      { variant: 'info' }
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getSalesOrderReceipt).not.toHaveBeenCalled();
  });

  it('bán xong KHÔNG tự in; bấm nút máy in thì mở phiếu của đúng hoá đơn vừa tạo và in được', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();

    await sellOne(user);

    // tạo hoá đơn xong: chưa có lệnh in nào, chưa tải phiếu
    const printer = await screen.findByRole('button', { name: READY });
    expect(screen.queryByRole('button', { name: NOT_YET })).not.toBeInTheDocument();
    expect(getSalesOrderReceipt).not.toHaveBeenCalled();
    expect(printHtmlDocument).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(printer);

    const dialog = await screen.findByRole('dialog');
    const frame = await within(dialog).findByTitle('Xem trước phiếu thanh toán');
    expect(getSalesOrderReceipt).toHaveBeenCalledTimes(1);
    expect(getSalesOrderReceipt).toHaveBeenCalledWith(SALE_ID);

    await user.click(within(dialog).getByRole('button', { name: 'In hoá đơn' }));
    expect(printHtmlDocument).toHaveBeenCalledWith(frame.getAttribute('srcdoc'));
  });

  it('tạo hoá đơn lỗi thì nút máy in vẫn ở trạng thái chưa có hoá đơn', async () => {
    const user = userEvent.setup({ delay: null });
    createSalesOrder.mockRejectedValue({ title: 'Không đủ tồn kho' });
    renderView();

    await sellOne(user);

    await waitFor(() =>
      expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith('Không đủ tồn kho', {
        variant: 'error',
      })
    );
    expect(screen.getByRole('button', { name: NOT_YET })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: READY })).not.toBeInTheDocument();
  });
});
