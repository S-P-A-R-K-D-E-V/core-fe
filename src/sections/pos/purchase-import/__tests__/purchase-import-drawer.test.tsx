import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import type { IPurchaseImport, IPurchaseImportAssistResponse } from 'src/types/purchase-import';

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'x' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/lightbox', () => ({ default: () => null }));

const api = vi.hoisted(() => ({
  getPurchaseImport: vi.fn(),
  getPurchaseImportConversation: vi.fn(),
  assistPurchaseImport: vi.fn(),
  uploadInvoiceImages: vi.fn(),
  updatePurchaseImportLine: vi.fn(),
  commitPurchaseImport: vi.fn(),
  retryPurchaseImport: vi.fn(),
  cancelPurchaseImport: vi.fn(),
  updatePurchaseImport: vi.fn(),
  createPurchaseImportProducts: vi.fn(),
  getPurchaseImportSupplierSuggestions: vi.fn(),
}));
vi.mock('src/api/purchase-imports', () => api);
vi.mock('src/api/products', () => ({ getAllProducts: vi.fn() }));
vi.mock('src/api/suppliers', () => ({
  getAllSuppliers: vi.fn().mockResolvedValue([]),
  createSupplier: vi.fn(),
}));
vi.mock('src/api/categories', () => ({ getAllCategories: vi.fn().mockResolvedValue([]) }));
vi.mock('src/sections/pos/purchase-order/purchase-access', () => ({
  usePurchaseAccess: () => ({ canCreateProducts: true }),
}));

// eslint-disable-next-line import/first
import PurchaseImportDrawer from '../purchase-import-drawer';

const ID = '3f2a8c1e-1b2c-4d5e-8f90-a1b2c3d4e5f6';

const invoice = (patch: Partial<IPurchaseImport> = {}): IPurchaseImport => ({
  id: ID,
  status: 'NeedsReview',
  source: 'Chat',
  images: ['/media/purchase-imports/u/invoice.jpg?sig=1'],
  supplierId: 's1',
  supplierName: 'Phượng Hồng',
  linesTotal: 2_156_000,
  warnings: [],
  createdAt: '2026-10-19T00:00:00Z',
  updatedAt: '2026-10-19T00:00:00Z',
  productImages: [],
  lines: [
    {
      lineNo: 1,
      rawText: '1 Máy sấy 8035 4 x 180 220',
      name: 'Máy sấy 8035',
      sameAsAbove: false,
      quantity: 2,
      unitPrice: 180_000,
      lineTotal: 220_000,
      status: 'Unknown',
      issues: ['number_mismatch'],
      candidates: [],
      productId: null,
      resolution: 'None',
    },
  ],
  ...patch,
});

const reply = (
  patch: Partial<IPurchaseImportAssistResponse> = {}
): IPurchaseImportAssistResponse => ({
  reply:
    'Dòng 1 là máy sấy 8035.\n\n**Đã cập nhật:**\n- Dòng 1 «Máy sấy 8035» → **Máy sấy 8035 (SP000901)**',
  changes: ['Dòng 1 «Máy sấy 8035» → **Máy sấy 8035 (SP000901)**'],
  changedLines: [1],
  rereading: false,
  duplicates: [],
  import: invoice({
    lines: invoice().lines.map((l) => ({
      ...l,
      status: 'Resolved',
      productId: 'p901',
      candidates: [
        {
          productId: 'p901',
          code: 'SP000901',
          name: 'Máy sấy 8035',
          score: 1,
          reason: 'Người duyệt chọn',
        },
      ],
    })),
  }),
  conversation: [
    {
      role: 'user',
      text: 'dòng 1 là máy sấy 8035',
      images: [],
      changes: [],
      at: '2026-10-19T03:00:00Z',
    },
    {
      role: 'assistant',
      text: 'Dòng 1 là máy sấy 8035.\n\n**Đã cập nhật:**\n- Dòng 1 «Máy sấy 8035» → **Máy sấy 8035 (SP000901)**',
      images: [],
      changes: ['Dòng 1 «Máy sấy 8035» → **Máy sấy 8035 (SP000901)**'],
      at: '2026-10-19T03:00:05Z',
    },
  ],
  ...patch,
});

const renderDrawer = (onNavigate = vi.fn()) =>
  render(
    <ThemeProvider theme={createTheme()}>
      <PurchaseImportDrawer importId={ID} onClose={vi.fn()} onNavigate={onNavigate} />
    </ThemeProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.getPurchaseImport.mockResolvedValue(invoice());
  api.getPurchaseImportConversation.mockResolvedValue([]);
});

describe('PurchaseImportDrawer', () => {
  it('nhắn trợ lý câu tự do → hiện câu trả lời, lần nhập cập nhật theo kết quả trợ lý', async () => {
    api.assistPurchaseImport.mockResolvedValue(reply());
    const user = userEvent.setup();
    const changed = vi.fn();
    window.addEventListener('purchase-import:changed', changed);
    renderDrawer();

    expect(await screen.findByText('NCC: Phượng Hồng')).toBeInTheDocument();
    expect(screen.getByText('1 Máy sấy 8035 4 x 180 220')).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText(/Nhắn trợ lý về hoá đơn này/),
      'dòng 1 là máy sấy 8035{Enter}'
    );

    expect(api.assistPurchaseImport).toHaveBeenCalledWith(ID, {
      message: 'dòng 1 là máy sấy 8035',
      objectKeys: [],
    });
    expect(api.uploadInvoiceImages).not.toHaveBeenCalled();
    expect(await screen.findByText('Dòng 1 là máy sấy 8035.')).toBeInTheDocument();
    expect(changed).toHaveBeenCalled();
    window.removeEventListener('purchase-import:changed', changed);

    await user.click(screen.getByRole('tab', { name: /Dòng hàng/ }));
    expect(screen.getByText('SP000901')).toBeInTheDocument();
  });

  it('đối chiếu thấy phiếu cũ → nút mở phiếu nhập đó', async () => {
    api.assistPurchaseImport.mockResolvedValue(
      reply({
        changedLines: [],
        duplicates: [
          {
            purchaseOrderId: 'po-123',
            orderNumber: 'PN000123',
            date: '2026-10-12T00:00:00Z',
            total: 2_156_000,
            status: 'Completed',
            matchedLines: 9,
            importLines: 10,
            totalMatches: true,
          },
        ],
      })
    );
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderDrawer(onNavigate);

    await user.type(
      await screen.findByPlaceholderText(/Nhắn trợ lý về hoá đơn này/),
      'đơn này nhập rồi, đối chiếu lại{Enter}'
    );
    await user.click(await screen.findByRole('button', { name: /PN000123/ }));

    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('/pos/purchase-order/po-123'));
  });

  it('trợ lý lỗi → báo lỗi, giữ lại câu đã gõ', async () => {
    api.assistPurchaseImport.mockRejectedValue({
      title: 'Hoá đơn đang đọc — đợi đọc xong rồi nhắn lại.',
    });
    const user = userEvent.setup();
    renderDrawer();

    const input = await screen.findByPlaceholderText(/Nhắn trợ lý về hoá đơn này/);
    await user.type(input, 'bỏ dòng 1{Enter}');

    expect(await screen.findByText(/Hoá đơn đang đọc/)).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveValue('bỏ dòng 1'));
  });

  it('chưa có trao đổi: chọn câu mẫu thì điền sẵn vào ô nhắn', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(await screen.findByRole('tab', { name: /Trao đổi/ }));
    await user.click(screen.getByText('Nhận hết các mã gợi ý'));

    expect(screen.getByPlaceholderText(/Nhắn trợ lý về hoá đơn này/)).toHaveValue(
      'Nhận hết các mã gợi ý'
    );
  });

  it('tích dòng chưa có gợi ý → đặt mã mới tên đúng như hàng (không kèm số), tạo khi tạo phiếu', async () => {
    api.updatePurchaseImportLine.mockResolvedValue(
      invoice({
        lines: invoice().lines.map((l) => ({
          ...l,
          status: 'Resolved',
          newProductName: 'Máy sấy 8035',
        })),
      })
    );
    const user = userEvent.setup();
    renderDrawer();

    await user.click(await screen.findByRole('button', { name: 'Tích 1 dòng chưa có gợi ý' }));
    await user.click(screen.getByRole('button', { name: 'Đặt mã mới (1)' }));
    expect(await screen.findByDisplayValue('Máy sấy 8035')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Đặt mã mới' }));

    await waitFor(() =>
      expect(api.updatePurchaseImportLine).toHaveBeenCalledWith(ID, 1, {
        newProductName: 'Máy sấy 8035',
        newProductSalePrice: null,
      })
    );
    expect(await screen.findByText('«Máy sấy 8035»')).toBeInTheDocument();
    // Dòng đặt mã mới coi như đã chốt → không chặn tạo phiếu.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tạo phiếu nhập' })).toBeEnabled()
    );
  });

  it('chi tiết dòng: gõ tên sản phẩm mới + giá bán → đặt mã mới cho dòng', async () => {
    api.updatePurchaseImportLine.mockResolvedValue(invoice());
    const user = userEvent.setup();
    renderDrawer();

    await user.click(await screen.findByRole('button', { name: /Chọn mã khác, tạo mã mới/ }));
    const name = screen.getByLabelText('Hoặc tạo mã mới — tên sản phẩm');
    await user.clear(name);
    await user.type(name, 'Lô dính');
    await user.type(screen.getByLabelText('Giá bán (tuỳ chọn)'), '15.000');
    await user.click(screen.getByRole('button', { name: 'Dùng mã mới' }));

    expect(api.updatePurchaseImportLine).toHaveBeenCalledWith(ID, 1, {
      newProductName: 'Lô dính',
      newProductSalePrice: 15_000,
    });
  });

  it('chưa nhận ra NCC: hiện NCC trùng SĐT trên hoá đơn, chọn thì lưu NCC cho lần nhập', async () => {
    api.getPurchaseImport.mockResolvedValue(
      invoice({ supplierId: null, supplierName: null, supplierText: 'Hùng Hương' })
    );
    api.getPurchaseImportSupplierSuggestions.mockResolvedValue({
      candidates: [
        {
          id: 'sup-hh',
          code: 'NCC000017',
          name: 'Hùng Hương',
          phone: '02439282168',
          address: '33 Cầu Đông',
          isActive: true,
          score: 1,
          reason: 'trùng SĐT 024.39282168 trên hoá đơn',
        },
      ],
      invoice: {
        name: 'Hùng Hương',
        phones: ['0985 33 1972', '024.39282168'],
        address: '33 Cầu Đông',
      },
    });
    api.updatePurchaseImport.mockResolvedValue(
      invoice({ supplierId: 'sup-hh', supplierName: 'Hùng Hương' })
    );
    const user = userEvent.setup();
    renderDrawer();

    expect(await screen.findByText('Chưa nhận ra nhà cung cấp')).toBeInTheDocument();
    expect(await screen.findByText('trùng SĐT 024.39282168 trên hoá đơn')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chọn' }));

    expect(api.updatePurchaseImport).toHaveBeenCalledWith(ID, { supplierId: 'sup-hh' });
    expect(await screen.findByText('NCC: Hùng Hương')).toBeInTheDocument();
  });

  it('dòng "như trên" gom vào nhóm của dòng có tên phía trên', async () => {
    const base = invoice().lines[0];
    api.getPurchaseImport.mockResolvedValue(
      invoice({
        lines: [
          { ...base, lineNo: 1, rawText: '2 Lô dính x90 180', name: 'Lô dính' },
          { ...base, lineNo: 2, rawText: '3 x80 240', name: null, sameAsAbove: true },
          { ...base, lineNo: 3, rawText: '10 x20 200', name: null, sameAsAbove: true },
          { ...base, lineNo: 4, rawText: '1 Lược x140 140', name: 'Lược' },
        ],
      })
    );
    renderDrawer();

    expect(await screen.findByText(/3 dòng cùng loại, khác bậc giá/)).toBeInTheDocument();
    expect(screen.getByText('Lô dính', { selector: 'strong' })).toBeInTheDocument();
  });
});
