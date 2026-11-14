import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { it, vi, expect, describe, beforeEach } from 'vitest';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Hộp "In phiếu" của phiếu nhập: chọn sẵn mẫu đang áp dụng, không có thì mẫu hệ thống A4; không đọc được mẫu vẫn in được
// bằng mẫu hệ thống; In gửi đúng tài liệu đã xem trước.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({ default: () => null }));

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const printHtmlDocument = vi.fn();
vi.mock('src/utils/print-html', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/utils/print-html')>()),
  printHtmlDocument: (...args: any[]) => printHtmlDocument(...args),
}));

const getPrintTemplates = vi.fn();
vi.mock('src/api/print-templates', () => ({
  getPrintTemplates: (...args: any[]) => getPrintTemplates(...args),
}));

const getPurchaseOrderPrint = vi.fn();
vi.mock('src/api/purchase-orders', () => ({
  getPurchaseOrderPrint: (...args: any[]) => getPurchaseOrderPrint(...args),
}));

// jsdom không dàn trang: số đo chiều cao giấy cuộn cố định.
vi.mock('src/sections/print-template/receipt/receipt-template-render', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('src/sections/print-template/receipt/receipt-template-render')>();
  return {
    ...original,
    renderReceiptTemplate: (template: any, source: any) =>
      original.renderReceiptTemplate(template, source, { measure: async () => 100 }),
  };
});

// Imported after the mocks above.
import { samplePurchasePrint } from 'src/sections/print-template/purchase/purchase-template-fields';

import { PurchaseOrderPrintButton } from '../purchase-order-print';

const theme = createTheme();
const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const ownTemplate = {
  id: 't1',
  kind: 'purchase',
  name: 'Phiếu nhập cửa hàng',
  content: '<p>NCC {{supplier_name}} — {{purchase_code}}</p>',
  settings: '{"paper":"A5"}',
  createdAt: '2026-11-14T00:00:00Z',
  updatedAt: null,
};

describe('PurchaseOrderPrintButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    printHtmlDocument.mockResolvedValue(undefined);
    getPurchaseOrderPrint.mockResolvedValue(samplePurchasePrint('CiCi'));
  });

  it('chọn sẵn mẫu đang áp dụng, In gửi tài liệu đã trộn phiếu nhập', async () => {
    getPrintTemplates.mockResolvedValue({
      templates: [ownTemplate],
      assignments: [{ kind: 'purchase', channel: '*', paymentMethod: '*', templateId: 't1' }],
    });
    const user = userEvent.setup();
    wrap(<PurchaseOrderPrintButton orderId="po-1" orderNumber="PN000123" />);

    await user.click(screen.getByRole('button', { name: 'In phiếu' }));
    expect(getPurchaseOrderPrint).toHaveBeenCalledWith('po-1');
    expect(getPrintTemplates).toHaveBeenCalledWith('purchase');

    const combo = await screen.findByRole('combobox', { name: 'Mẫu in' });
    await waitFor(() => expect(combo).toHaveTextContent('Phiếu nhập cửa hàng'));
    const printButton = screen.getByRole('button', { name: 'In' });
    await waitFor(() => expect(printButton).toBeEnabled());
    await user.click(printButton);

    expect(printHtmlDocument).toHaveBeenCalledTimes(1);
    const html = printHtmlDocument.mock.calls[0][0] as string;
    expect(html).toContain('NCC Xưởng phụ kiện Minh Anh — PN000123');
  });

  it('không đọc được mẫu (thiếu quyền) → mẫu hệ thống A4 vẫn in được', async () => {
    getPrintTemplates.mockRejectedValue(new Error('403'));
    const user = userEvent.setup();
    wrap(<PurchaseOrderPrintButton orderId="po-1" />);

    await user.click(screen.getByRole('button', { name: 'In phiếu' }));
    const combo = await screen.findByRole('combobox', { name: 'Mẫu in' });
    await waitFor(() => expect(combo).toHaveTextContent('Mẫu hệ thống — A4'));
    const printButton = screen.getByRole('button', { name: 'In' });
    await waitFor(() => expect(printButton).toBeEnabled());
    await user.click(printButton);

    const html = printHtmlDocument.mock.calls[0][0] as string;
    expect(html).toContain('PHIẾU NHẬP HÀNG');
    expect(html).toContain('Người nhận hàng');
  });
});
