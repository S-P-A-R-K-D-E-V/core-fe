import { createContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IProduct, IProductListItem } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Trang Sản phẩm → "In tem mã": nút ở dòng chi tiết của một mã hàng (trước đây bấm không có gì xảy ra)
// và nút trong thanh thao tác khi tick nhiều dòng. Hàng có biến thể được tách thành từng mã riêng.
// ----------------------------------------------------------------------

// Trả về CÙNG một đối tượng mỗi lần render: fetchData của trang phụ thuộc enqueueSnackbar, hàm mới mỗi
// lần sẽ làm trang tải lại vô hạn.
const router = { push: vi.fn() };
vi.mock('src/routes/hooks', () => ({
  useRouter: () => router,
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
  default: ({ action }: { action?: React.ReactNode }) => <div>{action}</div>,
}));

vi.mock('src/utils/format-number', () => ({
  fNumber: (value: number) => String(value ?? ''),
  fCurrency: (value: number) => String(value ?? ''),
}));

vi.mock('src/hooks/use-sync-notification', () => ({
  SyncNotificationContext: createContext({ startSync: vi.fn() }),
}));

vi.mock('src/api/categories', () => ({
  getAllCategories: () => Promise.resolve([]),
}));

const getAllProducts = vi.fn();
const getProductById = vi.fn();
vi.mock('src/api/products', () => ({
  getAllProducts: (...args: any[]) => getAllProducts(...args),
  getProductById: (...args: any[]) => getProductById(...args),
  deleteProduct: vi.fn(),
}));

vi.mock('../../product-edit-dialog', () => ({
  default: () => null,
}));

const printHtmlDocument = vi.fn((_html: string) => Promise.resolve());
vi.mock('src/utils/print-html', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/utils/print-html')>()),
  printHtmlDocument: (html: string) => printHtmlDocument(html),
}));

// Imported after the mocks above so the view picks up the mocked modules.
import ProductListView from '../product-list-view';

const base = {
  categoryName: 'Thời trang',
  hasVariants: false,
  productType: 2,
  isActive: true,
  minQuantity: 0,
  maxQuantity: 0,
  createdDate: '2026-10-01T02:00:00Z',
};

const TOTE: IProductListItem = {
  ...base,
  id: 'tote',
  code: '2000000000015',
  name: 'Túi tote vải canvas in hình mèo',
  basePrice: 99000,
};

const SHIRT: IProductListItem = {
  ...base,
  id: 'shirt-m',
  code: 'SP000123',
  name: 'Áo thun cổ tròn',
  fullName: 'Áo thun cổ tròn - Trắng - M',
  barCode: '8934567890120',
  hasVariants: true,
  basePrice: 185000,
  childProducts: [
    {
      id: 'shirt-l',
      code: 'SP000124',
      name: 'Áo thun cổ tròn',
      fullName: 'Áo thun cổ tròn - Trắng - L',
      barCode: '8934567890137',
      basePrice: 195000,
      isActive: true,
      attributes: [{ id: 'a1', attributeName: 'Size', attributeValue: 'L' }],
    },
    {
      id: 'shirt-xl',
      code: 'SP000125',
      name: 'Áo thun cổ tròn',
      fullName: 'Áo thun cổ tròn - Trắng - XL',
      basePrice: 205000,
      isActive: true,
      attributes: [{ id: 'a2', attributeName: 'Size', attributeValue: 'XL' }],
    },
  ],
};

function renderView() {
  render(
    <ThemeProvider theme={createTheme()}>
      <ProductListView />
    </ThemeProvider>
  );
}

const dialog = () => screen.getByRole('dialog');

beforeEach(() => {
  window.localStorage.clear();
  getAllProducts.mockResolvedValue({ items: [TOTE, SHIRT], totalCount: 2, page: 1, pageSize: 25 });
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('Trang Sản phẩm — In tem mã', () => {
  it('nút "In tem mã" ở chi tiết một mã hàng mở hộp thoại cho đúng mã đó, có ô số tem', async () => {
    const user = userEvent.setup();
    getProductById.mockResolvedValue({ ...TOTE, categoryId: 'c1', allowsSale: true } as IProduct);
    renderView();

    await user.click(await screen.findByText('Túi tote vải canvas in hình mèo'));
    expect(getProductById).toHaveBeenCalledWith('tote');
    await user.click(await screen.findByRole('button', { name: 'In tem mã' }));

    expect(within(dialog()).getByRole('heading', { name: /In tem mã/ })).toBeInTheDocument();
    expect(within(dialog()).getByText('Túi tote vải canvas in hình mèo')).toBeInTheDocument();
    expect(within(dialog()).getByText('EAN-13')).toBeInTheDocument();
    expect(within(dialog()).getAllByRole('spinbutton')).toHaveLength(1);

    const quantity = within(dialog()).getByLabelText('Số tem của Túi tote vải canvas in hình mèo');
    expect(quantity).toHaveValue(1);
    await user.clear(quantity);
    await user.type(quantity, '4');
    await user.click(within(dialog()).getByRole('button', { name: 'In 4 tem' }));

    expect(printHtmlDocument).toHaveBeenCalledTimes(1);
    const printed = new DOMParser().parseFromString(printHtmlDocument.mock.calls[0][0], 'text/html');
    expect(printed.querySelectorAll('.pg')).toHaveLength(2);
    expect(printed.querySelectorAll('.lb')).toHaveLength(4);
    expect(printed.querySelector('.cd')?.textContent).toBe('2000000000015');
  });

  it('tick nhiều dòng → "In tem mã" ở thanh thao tác; hàng có biến thể tách thành từng mã, mỗi mã mặc định 1 tem', async () => {
    const user = userEvent.setup();
    renderView();

    await screen.findByText('Túi tote vải canvas in hình mèo');
    expect(screen.queryByRole('button', { name: 'In tem mã' })).not.toBeInTheDocument();

    // Ô đầu tiên là "chọn tất cả" ở tiêu đề bảng
    const [selectAll] = screen.getAllByRole('checkbox');
    await user.click(selectAll);
    await user.click(screen.getByRole('button', { name: 'In tem mã' }));

    const names = [
      'Túi tote vải canvas in hình mèo',
      'Áo thun cổ tròn - Trắng - M',
      'Áo thun cổ tròn - Trắng - L',
      'Áo thun cổ tròn - Trắng - XL',
    ];
    names.forEach((name) => {
      expect(within(dialog()).getByLabelText(`Số tem của ${name}`)).toHaveValue(1);
    });
    expect(within(dialog()).getAllByRole('spinbutton')).toHaveLength(4);
    // Mã vạch nếu có, không thì mã hàng (SP000125 không có mã vạch)
    expect(within(dialog()).getByText('8934567890137')).toBeInTheDocument();
    expect(within(dialog()).getAllByText('SP000125')).toHaveLength(2);
    expect(within(dialog()).getByRole('button', { name: 'In 4 tem' })).toBeEnabled();

    await user.clear(within(dialog()).getByLabelText('Số tem của Áo thun cổ tròn - Trắng - L'));
    await user.type(within(dialog()).getByLabelText('Số tem của Áo thun cổ tròn - Trắng - XL'), '0');
    expect(within(dialog()).getByRole('button', { name: 'In 12 tem' })).toBeEnabled();
  });
});
