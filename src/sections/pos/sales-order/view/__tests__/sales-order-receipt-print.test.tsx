import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import {
  normalReceipt,
  cancelledReceipt,
} from 'src/sections/pos/receipt-print/__tests__/receipt-fixtures';

import type { ISalesOrder } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Đơn bán hàng → "In hoá đơn": nút ở trang chi tiết và nút ở từng dòng của danh sách đều mở hộp thoại in
// phiếu thanh toán của ĐÚNG hoá đơn đó (GET /sales-orders/{id}/receipt).
// ----------------------------------------------------------------------

// Trả về CÙNG một đối tượng mỗi lần render: các hàm tải dữ liệu phụ thuộc enqueueSnackbar / router.
const router = { push: vi.fn() };
vi.mock('src/routes/hooks', () => ({
  useRouter: () => router,
}));

vi.mock('src/routes/components', () => ({
  RouterLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => snackbar,
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

// Label của kit gán `theme` vào props đã đóng băng của React — chỉ lỗi trong môi trường test.
vi.mock('src/components/label', () => ({
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('src/components/scrollbar', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('src/components/custom-breadcrumbs', () => ({
  default: () => null,
}));

vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: () => null,
}));

vi.mock('src/utils/format-number', () => ({
  fNumber: (value: number) => String(value ?? ''),
  fCurrency: (value: number) => String(value ?? ''),
}));

const getAllSalesOrders = vi.fn();
const getSalesOrderById = vi.fn();
const getSalesOrderReceipt = vi.fn();
vi.mock('src/api/sales-orders', () => ({
  getAllSalesOrders: (...args: any[]) => getAllSalesOrders(...args),
  getSalesOrderById: (...args: any[]) => getSalesOrderById(...args),
  getSalesOrderReceipt: (...args: any[]) => getSalesOrderReceipt(...args),
  cancelSalesOrder: vi.fn(),
  retryPushSalesOrder: vi.fn(),
  exportSalesOrdersExcel: vi.fn(),
}));

vi.mock('src/api/bank-accounts', () => ({
  getBankAccounts: () => Promise.resolve([]),
}));

const printHtmlDocument = vi.fn((_html: string) => Promise.resolve());
vi.mock('src/utils/print-html', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/utils/print-html')>()),
  printHtmlDocument: (html: string) => printHtmlDocument(html),
}));

// Imported after the mocks above so the views pick up the mocked modules.
import SalesOrderListView from '../sales-order-list-view';
import SalesOrderDetailView from '../sales-order-detail-view';

const order = (id: string, orderNumber: string, extra: Partial<ISalesOrder> = {}): ISalesOrder => ({
  id,
  orderNumber,
  warehouseId: 'wh-1',
  warehouseName: 'Kho chính',
  status: 'Completed',
  paymentStatus: 'Paid',
  subTotal: 255000,
  vatAmount: 0,
  discountAmount: 0,
  totalAmount: 255000,
  paidAmount: 255000,
  createdByName: 'Nguyễn Thị Lan',
  createdAt: '2026-10-06T07:30:00Z',
  items: [],
  payments: [],
  ...extra,
});

const FIRST = order('3f0c1c1e-6c0d-4a53-9d0e-2a5b8a1f4c11', 'HD-20261006-0001');
const SECOND = order('7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', 'HD-20261006-0002', {
  status: 'Cancelled',
});

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

const PREVIEW = 'Xem trước phiếu thanh toán';

beforeEach(() => {
  window.localStorage.clear();
  getSalesOrderReceipt.mockResolvedValue(normalReceipt());
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('SalesOrderDetailView — In hoá đơn', () => {
  it('nút "In hoá đơn" mở hộp thoại, tải phiếu của hoá đơn đang xem và in được', async () => {
    const user = userEvent.setup({ delay: null });
    getSalesOrderById.mockResolvedValue(FIRST);
    wrap(<SalesOrderDetailView id={FIRST.id} />);

    await user.click(await screen.findByRole('button', { name: 'In hoá đơn' }));

    const dialog = await screen.findByRole('dialog');
    const frame = await within(dialog).findByTitle(PREVIEW);
    expect(getSalesOrderReceipt).toHaveBeenCalledTimes(1);
    expect(getSalesOrderReceipt).toHaveBeenCalledWith(FIRST.id);

    await user.click(within(dialog).getByRole('button', { name: 'In hoá đơn' }));
    expect(printHtmlDocument).toHaveBeenCalledWith(frame.getAttribute('srcdoc'));
  });

  it('chưa bấm thì không gọi API phiếu; hoá đơn đã huỷ vẫn có nút in (phiếu có chữ ĐÃ HUỶ)', async () => {
    const user = userEvent.setup({ delay: null });
    getSalesOrderById.mockResolvedValue(SECOND);
    getSalesOrderReceipt.mockResolvedValue(cancelledReceipt());
    wrap(<SalesOrderDetailView id={SECOND.id} />);

    const button = await screen.findByRole('button', { name: 'In hoá đơn' });
    expect(getSalesOrderReceipt).not.toHaveBeenCalled();
    // đơn đã huỷ không còn nút sửa / huỷ nhưng vẫn in được
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).not.toBeInTheDocument();

    await user.click(button);

    const frame = await within(await screen.findByRole('dialog')).findByTitle(PREVIEW);
    expect(getSalesOrderReceipt).toHaveBeenCalledWith(SECOND.id);
    expect(frame.getAttribute('srcdoc')).toContain('ĐÃ HUỶ');
  });
});

describe('SalesOrderListView — In hoá đơn ở từng dòng', () => {
  beforeEach(() => {
    getAllSalesOrders.mockResolvedValue({
      totalCount: 2,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 1,
      items: [FIRST, SECOND],
    });
  });

  it('mỗi dòng có nút "In hoá đơn"; bấm thì mở hộp thoại của đúng hoá đơn, không chuyển sang trang chi tiết', async () => {
    const user = userEvent.setup({ delay: null });
    wrap(<SalesOrderListView />);

    const row = (await screen.findByText('HD-20261006-0002')).closest('tr') as HTMLElement;
    expect(screen.getAllByRole('button', { name: 'In hoá đơn' })).toHaveLength(2);

    await user.click(within(row).getByRole('button', { name: 'In hoá đơn' }));

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByTitle(PREVIEW);
    expect(getSalesOrderReceipt).toHaveBeenCalledTimes(1);
    expect(getSalesOrderReceipt).toHaveBeenCalledWith(SECOND.id);
    expect(router.push).not.toHaveBeenCalled();

    // đóng rồi in dòng khác → tải phiếu của dòng đó
    await user.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const firstRow = screen.getByText('HD-20261006-0001').closest('tr') as HTMLElement;
    await user.click(within(firstRow).getByRole('button', { name: 'In hoá đơn' }));

    await within(await screen.findByRole('dialog')).findByTitle(PREVIEW);
    expect(getSalesOrderReceipt).toHaveBeenLastCalledWith(FIRST.id);
    expect(router.push).not.toHaveBeenCalled();
  });
});
