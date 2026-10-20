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
  getPurchaseImportCapabilities: vi.fn(),
  pushPurchaseImportToKiotViet: vi.fn(),
  getPurchaseImportSupplierOverview: vi.fn(),
}));
vi.mock('src/api/purchase-imports', () => api);
vi.mock('src/api/products', () => ({ getAllProducts: vi.fn() }));
vi.mock('src/api/warehouses', () => ({
  getAllWarehouses: vi.fn().mockResolvedValue([{ id: 'w1', name: 'Kho', isActive: true }]),
}));
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

const renderPage = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <PurchaseImportDrawer variant="page" importId={ID} onClose={vi.fn()} onNavigate={vi.fn()} />
    </ThemeProvider>
  );

const renderDrawer = (onNavigate = vi.fn()) =>
  render(
    <ThemeProvider theme={createTheme()}>
      <PurchaseImportDrawer importId={ID} onClose={vi.fn()} onNavigate={onNavigate} />
    </ThemeProvider>
  );

const capabilities = {
  enabled: true,
  maxImages: 6,
  maxImageBytes: 10_000_000,
  imageTypes: ['image/jpeg'],
  kiotVietPush: false,
  kiotVietDraft: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getPurchaseImport.mockResolvedValue(invoice());
  api.getPurchaseImportConversation.mockResolvedValue([]);
  api.getPurchaseImportCapabilities.mockResolvedValue(capabilities);
  api.getPurchaseImportSupplierOverview.mockResolvedValue(null);
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

  it('chi tiết dòng: giá theo gói → nhập chiếc/gói, phiếu ghi SL gói × chiếc/gói', async () => {
    // Dòng 2 gói × 180.000; mỗi gói 10 chiếc → 20 chiếc.
    api.updatePurchaseImportLine.mockResolvedValue(
      invoice({ lines: invoice().lines.map((l) => ({ ...l, countedQuantity: 20 })) })
    );
    const user = userEvent.setup();
    renderDrawer();

    await user.click(await screen.findByRole('button', { name: /Chọn mã khác, tạo mã mới/ }));
    await user.click(screen.getByRole('button', { name: 'Giá theo gói' }));
    await user.click(screen.getByRole('checkbox', { name: 'Giá theo gói' }));
    await user.type(screen.getByLabelText('Chiếc / gói'), '10');
    expect(screen.getByText(/= 20 chiếc/)).toBeInTheDocument();
    await user.tab();

    expect(api.updatePurchaseImportLine).toHaveBeenCalledWith(ID, 1, { countedQuantity: 20 });
    expect(await screen.findByText('20 chiếc')).toBeInTheDocument();
    expect(screen.getByText(/phiếu ghi theo chiếc/)).toBeInTheDocument();
  });

  it('đặt mã mới cho cả nhóm: tên chung, số cái, giá bán từng dòng → xem trước mã gốc + mã con', async () => {
    const base = invoice().lines[0];
    const lines = [
      {
        ...base,
        lineNo: 1,
        rawText: '1 bọc lô dính 150',
        name: 'Lô dính',
        quantity: 1,
        unitPrice: 150_000,
        lineTotal: 150_000,
        issues: [],
      },
      {
        ...base,
        lineNo: 2,
        rawText: '1 bọc lô dính 180',
        name: 'lô dính to',
        quantity: 1,
        unitPrice: 180_000,
        lineTotal: 180_000,
        issues: [],
      },
    ];
    api.getPurchaseImport.mockResolvedValue(invoice({ lines }));
    api.updatePurchaseImportLine.mockResolvedValue(invoice({ lines }));
    const user = userEvent.setup();
    renderDrawer();

    await user.click(await screen.findByRole('button', { name: 'Tích 2 dòng chưa có gợi ý' }));
    await user.click(screen.getByRole('button', { name: 'Đặt mã mới (2)' }));
    await user.type(await screen.findByLabelText('Tên chung cho cả nhóm (tuỳ chọn)'), 'Lô dính');
    await user.click(screen.getByRole('button', { name: 'Đặt cho 2 dòng' }));
    const counted = screen.getAllByPlaceholderText('vd 20');
    await user.type(counted[0], '12');
    await user.type(counted[1], '12');
    const prices = screen
      .getAllByRole('textbox')
      .filter((el) => (el as HTMLInputElement).placeholder.startsWith('≈'));
    await user.type(prices[0], '25.000');
    await user.type(prices[1], '30.000');

    expect(screen.getByText(/nhóm 2 mã \(mã gốc \+ 1 mã con\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Đặt mã mới' }));

    await waitFor(() => expect(api.updatePurchaseImportLine).toHaveBeenCalledTimes(2));
    expect(api.updatePurchaseImportLine).toHaveBeenCalledWith(ID, 1, {
      newProductName: 'Lô dính',
      newProductSalePrice: 25_000,
      countedQuantity: 12,
    });
    expect(api.updatePurchaseImportLine).toHaveBeenCalledWith(ID, 2, {
      newProductName: 'Lô dính',
      newProductSalePrice: 30_000,
      countedQuantity: 12,
    });
  });

  it('cửa hàng đẩy KiotViet: hỏi tạo phiếu nói rõ tạo luôn phiếu tạm bên KiotViet', async () => {
    api.getPurchaseImportCapabilities.mockResolvedValue({ ...capabilities, kiotVietPush: true });
    api.getPurchaseImport.mockResolvedValue(
      invoice({
        lines: invoice().lines.map((l) => ({ ...l, status: 'Resolved', productId: 'p901' })),
      })
    );
    const user = userEvent.setup();
    renderDrawer();

    await waitFor(() => expect(api.getPurchaseImportCapabilities).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: 'Tạo phiếu nhập' }));
    expect(
      await screen.findByText(/Mã mới và phiếu nhập \(phiếu tạm\) được tạo luôn bên KiotViet/)
    ).toBeInTheDocument();
  });

  it('phiếu đã tạo nhưng đẩy KiotViet lỗi → báo lỗi, bấm Đẩy lại', async () => {
    api.getPurchaseImport.mockResolvedValue(
      invoice({
        status: 'Committed',
        purchaseOrderId: 'po1',
        purchaseOrderNumber: 'PO-20261019-001',
        kiotVietPush: 'Failed',
        kiotVietPushError: 'Mã chưa có bên KiotViet: SP900001',
      })
    );
    api.pushPurchaseImportToKiotViet.mockResolvedValue(
      invoice({
        status: 'Committed',
        purchaseOrderId: 'po1',
        kiotVietPush: 'Pushed',
        kiotVietPurchaseOrderCode: 'PN008801',
      })
    );
    const user = userEvent.setup();
    renderDrawer();

    expect(await screen.findByText(/SP900001/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Đẩy lại' }));
    expect(api.pushPurchaseImportToKiotViet).toHaveBeenCalledWith(ID);
  });

  it('thẻ lịch sử NCC: tổng quan cả lịch sử, phiếu cũ nghi trùng mở được, lịch sử mã hiện trên dòng', async () => {
    api.getPurchaseImport.mockResolvedValue(
      invoice({
        lines: invoice().lines.map((l) => ({
          ...l,
          status: 'Suggested',
          candidates: [
            {
              productId: 'p147',
              code: 'SP000147',
              name: 'Lô uốn tóc - size 18',
              score: 0.8,
              reason: 'Trợ lý',
            },
          ],
        })),
      })
    );
    api.getPurchaseImportSupplierOverview.mockResolvedValue({
      supplierId: 's1',
      orders: 132,
      lines: 1674,
      amount: 830_600_000,
      firstDate: '2022-06-06T03:00:00Z',
      lastDate: '2026-09-01T03:00:00Z',
      years: [{ year: 2026, orders: 18, amount: 41_200_000 }],
      recent: [
        {
          purchaseOrderId: 'po-recent',
          orderNumber: 'PN001534',
          date: '2026-03-15T03:00:00Z',
          total: 2_857_000,
          lines: 18,
          status: 'Completed',
        },
      ],
      duplicates: [
        {
          purchaseOrderId: 'po-old',
          orderNumber: 'PN000292',
          date: '2022-12-28T03:00:00Z',
          total: 2_156_000,
          status: 'Completed',
          matchedLines: 9,
          importLines: 13,
          totalMatches: true,
          amountOnlyLines: 2,
          sameDate: false,
        },
      ],
      products: [
        {
          productId: 'p147',
          times: 35,
          firstDate: '2022-06-06T03:00:00Z',
          lastDate: '2026-09-01T03:00:00Z',
          lastCost: 7_500,
          minCost: 6_000,
          maxCost: 8_000,
          lastQuantity: 24,
          totalQuantity: 840,
        },
      ],
    });
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderDrawer(onNavigate);

    expect(await screen.findByText('132 phiếu')).toBeInTheDocument();
    expect(
      screen.getByText(/9\/13 dòng cùng mã \+ 2 chỉ cùng thành tiền · cùng tổng tiền/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Đã nhập NCC này 35 lần/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xem phiếu' }));
    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('po-old'));
  });

  it('NCC chưa từng bán → báo lần nhập đầu, không có lịch sử trên dòng', async () => {
    api.getPurchaseImportSupplierOverview.mockResolvedValue({
      supplierId: 's1',
      orders: 0,
      lines: 0,
      amount: 0,
      years: [],
      recent: [],
      duplicates: [],
      products: [],
    });
    renderDrawer();

    expect(await screen.findByText(/hàng trên hoá đơn sẽ là lần nhập đầu/)).toBeInTheDocument();
    expect(screen.queryByText(/Đã nhập NCC này/)).not.toBeInTheDocument();
  });

  it('trang duyệt: form phiếu — ô thông tin hoá đơn, bấm "Đúng" chốt gợi ý ngay tại dòng', async () => {
    api.getPurchaseImport.mockResolvedValue(
      invoice({
        lines: invoice().lines.map((l) => ({
          ...l,
          status: 'Suggested',
          suggestedProductId: 'p901',
          candidates: [
            {
              productId: 'p901',
              code: 'SP000901',
              name: 'Máy sấy 8035',
              score: 0.7,
              reason: 'Tên giống',
            },
          ],
        })),
      })
    );
    api.updatePurchaseImportLine.mockResolvedValue(invoice());
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByLabelText('Số hoá đơn')).toBeInTheDocument();
    expect(screen.getByLabelText('Ngày hoá đơn')).toBeInTheDocument();
    expect(screen.getByLabelText('Tổng trên hoá đơn')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Đúng' }));

    expect(api.updatePurchaseImportLine).toHaveBeenCalledWith(ID, 1, { productId: 'p901' });
  });

  it('trang duyệt: tích giá theo gói tại dòng → phiếu ghi SL gói × chiếc/gói', async () => {
    api.updatePurchaseImportLine.mockResolvedValue(
      invoice({ lines: invoice().lines.map((l) => ({ ...l, countedQuantity: 20 })) })
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('checkbox', { name: 'Giá theo gói' }));
    await user.type(screen.getByLabelText('Chiếc / gói'), '10');
    await user.tab();

    expect(api.updatePurchaseImportLine).toHaveBeenCalledWith(ID, 1, { countedQuantity: 20 });
    // 2 gói × 10 chiếc, thành tiền 220.000 → 11.000đ/chiếc vào phiếu.
    expect(await screen.findByText(/Vào phiếu:/)).toBeInTheDocument();
  });

  it('trang duyệt: ô sản phẩm cho đặt mã mới theo tên hàng (tạo khi tạo phiếu)', async () => {
    api.updatePurchaseImportLine.mockResolvedValue(invoice());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByPlaceholderText('Gõ tên / mã hàng…'));
    await user.click(await screen.findByText('Đặt mã mới «Máy sấy 8035» (tạo khi tạo phiếu)'));

    expect(api.updatePurchaseImportLine).toHaveBeenCalledWith(ID, 1, {
      newProductName: 'Máy sấy 8035',
    });
  });

  it('phiếu đã sang KiotViet → hiện mã phiếu bên KiotViet', async () => {
    api.getPurchaseImport.mockResolvedValue(
      invoice({
        status: 'Committed',
        purchaseOrderId: 'po1',
        purchaseOrderNumber: 'PO-20261019-001',
        kiotVietPush: 'Pushed',
        kiotVietPurchaseOrderCode: 'PN008801',
      })
    );
    renderDrawer();

    expect(await screen.findByText('PN008801')).toBeInTheDocument();
    expect(screen.getByText(/phiếu tạm — hoàn thành bên KiotViet/)).toBeInTheDocument();
  });
});
