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
  getAllSalesOrders: () => Promise.resolve({ items: [], totalCount: 0 }),
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
    expect(within(cart()).getByText('GIÁ TRỊ: 85')).toBeInTheDocument();
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
    createSalesOrder.mockRejectedValueOnce({ status: 400, title: 'Hàng không còn bán' });
    renderView();
    await ready();
    await addKep(user);

    const amount = screen.getByPlaceholderText('Số tiền');
    await waitFor(() => expect(amount).toHaveValue(35000));
    await user.click(screen.getByRole('button', { name: 'THANH TOÁN' }));

    await waitFor(() =>
      expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith('Hàng không còn bán', { variant: 'error' })
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
    // Máy chủ đã từ chối (4xx) → chắc chắn chưa có hoá đơn: lần sau gửi mã chống trùng mới.
    expect(createSalesOrder.mock.calls[1][0].clientRequestId).not.toBe(
      createSalesOrder.mock.calls[0][0].clientRequestId
    );
  });

  it('mất mạng khi tạo hoá đơn: lưu vào hàng chờ, bán tiếp; có mạng tự gửi lại ĐÚNG mã chống trùng + giờ bán', async () => {
    const user = userEvent.setup({ delay: null });
    createSalesOrder.mockRejectedValueOnce('Something went wrong');
    createSalesOrder.mockResolvedValueOnce({ id: 'so-1', kiotVietSyncStatus: 'NotPushed', replayed: true });
    renderView();
    await ready();
    await addKep(user);

    await waitFor(() => expect(screen.getByPlaceholderText('Số tiền')).toHaveValue(35000));
    await user.click(screen.getByRole('button', { name: 'THANH TOÁN' }));
    await waitFor(() =>
      expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('đã lưu hoá đơn trên máy'),
        expect.objectContaining({ variant: 'warning' })
      )
    );
    // giỏ được giải phóng để bán đơn khác
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // trình duyệt đang "có mạng" → tự đồng bộ ngay
    await waitFor(() => expect(createSalesOrder).toHaveBeenCalledTimes(2));
    const [first, second] = createSalesOrder.mock.calls.map((c) => c[0]);
    expect(first.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.clientRequestId).toBe(first.clientRequestId);
    expect(first.purchaseDate).toBeUndefined();
    expect(second.purchaseDate).toMatch(/Z$/);
    await waitFor(() =>
      expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith('Đã đồng bộ 1 hoá đơn bán lúc mất mạng', {
        variant: 'success',
      })
    );
    // Không có IndexedDB trong jsdom → hàng chờ ở localStorage "pos_outbox"; hoá đơn đã lên hệ thống giữ để in lại.
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem('pos_outbox') ?? '[]')).toEqual([
        expect.objectContaining({ id: first.clientRequestId, status: 'sent', serverId: 'so-1' }),
      ])
    );
  });

  it('vẫn mất mạng: hoá đơn nằm chờ, thanh trên có nút "Chờ đồng bộ"', async () => {
    const user = userEvent.setup({ delay: null });
    createSalesOrder.mockRejectedValue('Something went wrong');
    renderView();
    await ready();
    await addKep(user);

    await waitFor(() => expect(screen.getByPlaceholderText('Số tiền')).toHaveValue(35000));
    await user.click(screen.getByRole('button', { name: 'THANH TOÁN' }));

    const syncButton = await screen.findByRole('button', { name: /Chờ đồng bộ \(1\)/ });
    await waitFor(() => expect(createSalesOrder.mock.calls.length).toBeGreaterThanOrEqual(2));
    const queued = JSON.parse(window.localStorage.getItem('pos_outbox') ?? '[]');
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ status: 'pending' });
    expect(queued[0].attempts).toBeGreaterThanOrEqual(2);
    expect(queued[0].nextAttemptAt).toBeTruthy();

    await user.click(syncButton);
    expect(await screen.findByText('Hoá đơn chờ đồng bộ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đồng bộ ngay' })).toBeInTheDocument();
  });

  it('khách đưa dư tiền mặt: khoản thu = số phải trả, gửi tiền khách đưa; đổi giảm giá không xoá số khách đưa', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await ready();
    await addKep(user);

    const paid = screen.getByPlaceholderText('Số tiền');
    await waitFor(() => expect(paid).toHaveValue(35000));
    await user.clear(paid);
    await user.type(paid, '50000');
    expect(screen.getByText('Tiền thừa trả khách')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'THANH TOÁN' }));
    await waitFor(() => expect(createSalesOrder).toHaveBeenCalledTimes(1));
    expect(createSalesOrder.mock.calls[0][0]).toMatchObject({
      totalPayment: 35000,
      payments: [{ method: 'Cash', amount: 35000 }],
      cashTendered: 50000,
    });
  });

  it('F4 đưa con trỏ vào ô tìm khách hàng; nút Quản lý dẫn về trang quản lý', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await ready();

    await user.keyboard('{F4}');
    expect(screen.getByPlaceholderText('Tìm khách hàng (F4)')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Vào trang quản lý' }));
    expect(await screen.findByRole('menuitem', { name: 'Trang quản lý' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('menuitem', { name: 'Đơn bán hàng' })).toHaveAttribute('href', '/dashboard/pos/sales-order');
  });
});

// ----------------------------------------------------------------------
// GĐ0 (docs/cici/plans/pos-offline-plan.md): đơn tạm không bị xoá khi đang hỏi khôi phục, tồn hệ thống chỉ cảnh báo,
// giảm giá theo từng đơn tạm, đóng tab có hàng phải hỏi lại.
// ----------------------------------------------------------------------

describe('PosSaleView — GĐ0', { timeout: 30000 }, () => {
  async function addKep(user: ReturnType<typeof userEvent.setup>) {
    await user.type(searchBox(), '8930001{Enter}');
    await waitFor(() => expect(within(cart()).getByText('SP000123')).toBeInTheDocument());
  }

  it('hộp "Khôi phục đơn hàng tạm" đang mở thì đơn tạm vẫn còn trong bộ nhớ (tải lại không mất)', async () => {
    const saved = {
      orderCounter: 2,
      orders: [
        {
          id: 1,
          label: 'Hóa đơn 1',
          note: '',
          discountAmount: 0,
          couponCode: '',
          items: [
            {
              productId: 'p-kep',
              name: 'Kẹp tóc nơ nhung đỏ',
              sku: 'SP000123',
              quantity: 1,
              unitPrice: 35000,
              vatRate: 0,
              discountAmount: 0,
              note: '',
              stockOnHand: 10,
              stockOnOrder: 0,
            },
          ],
        },
      ],
    };
    window.localStorage.setItem('pos_draft_orders', JSON.stringify(saved));
    renderView();
    await ready();

    expect(await screen.findByText('Khôi phục đơn hàng tạm')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('pos_draft_orders') ?? 'null')?.orders).toHaveLength(1);

    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: 'Khôi phục' }));
    await waitFor(() => expect(within(cart()).getByText('SP000123')).toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem('pos_draft_orders') ?? 'null')?.orders).toHaveLength(1);
  });

  it('hàng hệ thống ghi hết tồn vẫn thêm được vào giỏ (chỉ cảnh báo)', async () => {
    const user = userEvent.setup({ delay: null });
    getAllProducts.mockImplementation(async (params?: { keyword?: string }) => {
      const items = search(params?.keyword).map((p) => ({ ...p, inventories: inv(0) }));
      return { items, totalCount: items.length, page: 1, pageSize: 25 };
    });
    renderView();
    await ready();
    await addKep(user);

    expect(cartRows()).toHaveLength(1);
    expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('hệ thống ghi hết hàng'),
      { variant: 'warning' }
    );
  });

  it('giảm giá hoá đơn theo từng đơn tạm: sang đơn khác không mang theo số giảm', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await ready();
    await addKep(user);

    await user.type(screen.getByLabelText('Giảm giá hoá đơn'), '5000');
    await waitFor(() => expect(screen.getByPlaceholderText('Số tiền')).toHaveValue(30000));

    await user.click(screen.getByRole('button', { name: 'Thêm hoá đơn tạm' }));
    await addKep(user);
    expect(screen.getByLabelText('Giảm giá hoá đơn')).toHaveValue(null);
    await waitFor(() => expect(screen.getByPlaceholderText('Số tiền')).toHaveValue(35000));

    await user.click(screen.getByRole('tab', { name: /Hóa đơn 1/ }));
    expect(screen.getByLabelText('Giảm giá hoá đơn')).toHaveValue(5000);
  });

  it('đóng tab hoá đơn đang có hàng phải xác nhận', async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    await ready();
    await addKep(user);
    await user.click(screen.getByRole('button', { name: 'Thêm hoá đơn tạm' }));

    await user.click(screen.getByRole('button', { name: 'Đóng Hóa đơn 1' }));
    expect(await screen.findByText('Đóng hoá đơn tạm?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Giữ lại' }));
    // Hộp thoại đóng xong (hết ẩn phần nền) thì tab vẫn còn.
    await waitFor(() => expect(screen.getByRole('tab', { name: /Hóa đơn 1/ })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Đóng Hóa đơn 1' }));
    await user.click(await screen.findByRole('button', { name: 'Đóng hoá đơn' }));
    await waitFor(() => expect(screen.getAllByRole('tab', { name: /Hóa đơn/ })).toHaveLength(1));
  });
});

describe('PosSaleView — mất mạng vẫn tra được hàng', { timeout: 30000 }, () => {
  it('mở màn lúc mất mạng: dùng danh mục đã lưu trên máy, tìm không dấu và thêm được vào giỏ', async () => {
    window.localStorage.setItem(
      'pos_meta',
      JSON.stringify([
        {
          id: 'catalog',
          products: [KEP, VI],
          customers: [],
          warehouses: [{ id: 'wh-1', name: 'Kho chính', isDefault: true, isActive: true, createdAt: '2026-01-01T00:00:00Z' }],
          syncedAt: '2026-11-12T08:00:00.000Z',
          complete: true,
        },
      ])
    );
    getAllProducts.mockRejectedValue('Something went wrong');
    const user = userEvent.setup({ delay: null });
    renderView();

    await waitFor(() =>
      expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('đang dùng danh mục lưu trên máy'),
        { variant: 'warning' }
      )
    );
    await user.type(searchBox(), 'kep toc do');
    await user.click(await screen.findByRole('option', { name: /Kẹp tóc nơ nhung đỏ/ }));
    await waitFor(() => expect(within(cart()).getByText('SP000123')).toBeInTheDocument());

    // quét mã phiên bản khi mất mạng → thêm thẳng phiên bản
    await user.type(searchBox(), '8935259{Enter}');
    await waitFor(() => expect(within(cart()).getByText('SP015259')).toBeInTheDocument());
  });

  it('tải được danh mục từ máy chủ thì lưu lại trên máy cho lần mất mạng sau', async () => {
    renderView();
    await ready();
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('pos_meta') ?? '[]');
      expect(saved[0]).toMatchObject({ id: 'catalog', complete: true });
      expect(saved[0].products).toHaveLength(3);
    });
  });
});
