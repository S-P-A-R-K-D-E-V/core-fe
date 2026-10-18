import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import type { IPurchaseImport } from 'src/types/purchase-import';

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'x' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

vi.mock('src/components/iconify', () => ({ default: () => null }));

const api = vi.hoisted(() => ({
  getPurchaseImport: vi.fn(),
  updatePurchaseImportLine: vi.fn(),
  commitPurchaseImport: vi.fn(),
  retryPurchaseImport: vi.fn(),
  cancelPurchaseImport: vi.fn(),
}));
vi.mock('src/api/purchase-imports', () => api);
vi.mock('src/api/products', () => ({ getAllProducts: vi.fn() }));

// eslint-disable-next-line import/first
import PurchaseImportChatCard from '../purchase-import-chat-card';

const ID = '3f2a8c1e-1b2c-4d5e-8f90-a1b2c3d4e5f6';
const SCRUNCHIES = 'p-sc38';

const invoice = (patch: Partial<IPurchaseImport> = {}): IPurchaseImport => ({
  id: ID,
  status: 'NeedsReview',
  source: 'Chat',
  images: [],
  supplierId: 's1',
  supplierName: 'Ngọc Bang',
  invoiceNumber: '1200',
  linesTotal: 1_276_700,
  warnings: [],
  createdAt: '2026-10-18T00:00:00Z',
  updatedAt: '2026-10-18T00:00:00Z',
  lines: [
    {
      lineNo: 1,
      rawText: '18 mũ x70 1260',
      name: 'mũ',
      sameAsAbove: false,
      quantity: 18,
      unitPrice: 70_000,
      lineTotal: 1_260_000,
      status: 'Matched',
      issues: [],
      candidates: [{ productId: 'p-td140', code: 'SP000718', name: 'Mũ - TD140', score: 1, reason: 'Nhập từ NCC này' }],
      productId: 'p-td140',
      resolution: 'None',
    },
    {
      lineNo: 2,
      rawText: '1 kẹp tóc x16.7',
      name: 'kẹp tóc',
      sameAsAbove: false,
      quantity: 1,
      unitPrice: 16_700,
      lineTotal: 16_700,
      status: 'Suggested',
      issues: [],
      candidates: [
        { productId: SCRUNCHIES, code: 'SP000465', name: 'Scrunchies - SC38', score: 0.7, reason: 'Cùng giá nhập' },
      ],
      suggestedProductId: SCRUNCHIES,
      productId: null,
      resolution: 'None',
    },
  ],
  ...patch,
});

const resolved = () =>
  invoice({
    lines: invoice().lines.map((l) =>
      l.lineNo === 2 ? { ...l, status: 'Resolved', productId: SCRUNCHIES, resolution: 'Accepted' } : l
    ),
  });

const renderCard = (onNavigate = vi.fn()) =>
  render(
    <ThemeProvider theme={createTheme()}>
      <PurchaseImportChatCard importId={ID} onNavigate={onNavigate} />
    </ThemeProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.getPurchaseImport.mockResolvedValue(invoice());
});

describe('PurchaseImportChatCard', () => {
  it('hiện dòng cần chọn với gợi ý "Có thể là", chọn "Đúng" thì lưu mã cho dòng', async () => {
    api.updatePurchaseImportLine.mockResolvedValue(resolved());
    const user = userEvent.setup();
    renderCard();

    expect(await screen.findByText('Có thể là')).toBeInTheDocument();
    expect(screen.getByText(/Ngọc Bang · số 1200/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo phiếu nhập' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Đúng' }));

    expect(api.updatePurchaseImportLine).toHaveBeenCalledWith(ID, 2, { productId: SCRUNCHIES });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo phiếu nhập' })).toBeEnabled());
  });

  it('tạo phiếu phải xác nhận; trùng số hoá đơn thì hỏi lại rồi mới gửi allowDuplicate', async () => {
    api.getPurchaseImport.mockResolvedValue(resolved());
    api.commitPurchaseImport
      .mockRejectedValueOnce({ title: 'Hoá đơn số 1200 của NCC này đã được nhập.', errorCodes: ['PurchaseImport.DuplicateInvoice'] })
      .mockResolvedValueOnce({ purchaseOrderId: 'po1' });
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole('button', { name: 'Tạo phiếu nhập' }));
    expect(api.commitPurchaseImport).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Tạo phiếu' }));

    expect(await screen.findByText('Hoá đơn số 1200 của NCC này đã được nhập.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Vẫn tạo phiếu' }));

    expect(api.commitPurchaseImport).toHaveBeenNthCalledWith(1, ID, false);
    expect(api.commitPurchaseImport).toHaveBeenNthCalledWith(2, ID, true);
  });

  it('không xem được lần nhập (không có quyền) thì báo, không vỡ khung chat', async () => {
    api.getPurchaseImport.mockRejectedValue({ status: 403 });
    renderCard();

    expect(await screen.findByText(/Không xem được lần nhập này/)).toBeInTheDocument();
  });

  it('đã tạo phiếu: nút "Xem phiếu" mở trang phiếu nhập', async () => {
    api.getPurchaseImport.mockResolvedValue(
      invoice({ status: 'Committed', purchaseOrderId: 'po1', purchaseOrderNumber: 'PN000123' })
    );
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderCard(onNavigate);

    await user.click(await screen.findByRole('button', { name: 'Xem phiếu' }));

    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('/pos/purchase-order/po1'));
  });

  it('thẻ mới của cùng lần nhập xuất hiện (sau khi nhắn sửa dòng) → thẻ cũ tải lại', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    renderCard();
    await screen.findByText('Có thể là');
    expect(api.getPurchaseImport).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_010_000);
    renderCard();

    // Thẻ cũ tải lại + thẻ mới tải lần đầu.
    await waitFor(() => expect(api.getPurchaseImport).toHaveBeenCalledTimes(3));
    now.mockRestore();
  });
});
