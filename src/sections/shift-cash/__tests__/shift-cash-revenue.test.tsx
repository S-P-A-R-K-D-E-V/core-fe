import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IShiftCashRevenue, IShiftCashReconciliation } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Doanh thu ở trang Kiểm tiền quầy từ dữ liệu HỆ THỐNG: khối "Doanh thu" che "****" khi BE trả masked,
// tab hoá đơn bán hàng lọc theo kênh tiền + nút in nhanh, thẻ "Đối chiếu doanh thu" chỉ gọi API khi bấm
// và hiện bảng hệ thống ↔ ngân hàng ↔ KiotViet.
// ----------------------------------------------------------------------

let mockUser: { role: string; roles: string[]; permissions?: string[] } = { role: 'Admin', roles: ['Admin'] };
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: mockUser }),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

vi.mock('src/components/scrollbar', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('src/sections/pos/receipt-print/receipt-print-dialog', () => ({
  default: ({ open, orderId }: { open: boolean; orderId: string | null }) =>
    open ? <div data-testid="print-dialog">{orderId}</div> : null,
}));

const getShiftCashReconciliation = vi.fn();
vi.mock('src/api/shiftCash', () => ({
  getShiftCashReconciliation: (...args: any[]) => getShiftCashReconciliation(...args),
}));

// Imported after the mocks above.
import ShiftCashSalesTab from 'src/sections/shift-cash/shift-cash-sales-tab';
import ShiftCashRevenueBlock from 'src/sections/shift-cash/shift-cash-revenue-block';
import ShiftCashReconciliationPanel from 'src/sections/shift-cash/shift-cash-reconciliation-panel';

const DAY = '2026-10-06';

const theme = createTheme();
const wrap = (node: React.ReactNode) => render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);

const REVENUE: IShiftCashRevenue = {
  date: DAY,
  kiotVietConnected: false,
  revenue: {
    sales: {
      invoiceCount: 3,
      revenue: 710000,
      cash: 320000,
      transfer: 390000,
      card: 0,
      eWallet: 0,
      other: 0,
      returnCount: 0,
      returns: 0,
      netRevenue: 710000,
    },
    cashRefunds: 0,
    netCash: 320000,
  },
  bank: {
    hasBankFeed: true,
    systemTransfer: 390000,
    transferInvoiceCount: 2,
    received: 300000,
    creditCount: 1,
    matched: 300000,
    difference: -90000,
    missingCredits: [{ salesOrderId: 'o3', code: 'HD3', at: '2026-10-06T04:00:00Z', amount: 90000 }],
    unmatchedCredits: [],
  },
  invoices: [
    {
      salesOrderId: 'o1', kiotVietId: null, code: 'HD1', purchaseDate: '2026-10-06T02:00:00Z', customerName: null,
      description: null, total: 120000, cash: 120000, transfer: 0, card: 0, eWallet: 0, other: 0, untracked: 0,
      methods: ['Cash'], hasReturn: false, returnAmount: 0, transferStatus: null,
    },
    {
      salesOrderId: 'o2', kiotVietId: null, code: 'HD2', purchaseDate: '2026-10-06T03:00:00Z', customerName: 'Chị Lan',
      description: null, total: 500000, cash: 200000, transfer: 300000, card: 0, eWallet: 0, other: 0, untracked: 0,
      methods: ['Cash', 'Transfer'], hasReturn: false, returnAmount: 0, transferStatus: 'received',
    },
    {
      salesOrderId: 'o3', kiotVietId: null, code: 'HD3', purchaseDate: '2026-10-06T04:00:00Z', customerName: null,
      description: null, total: 90000, cash: 0, transfer: 90000, card: 0, eWallet: 0, other: 0, untracked: 0,
      methods: ['Transfer'], hasReturn: false, returnAmount: 0, transferStatus: 'missing',
    },
  ],
  returns: [],
};

afterEach(() => {
  vi.clearAllMocks();
  mockUser = { role: 'Admin', roles: ['Admin'] };
});

describe('ShiftCashRevenueBlock', () => {
  it('shows **** and no figures when the API masks the revenue', () => {
    wrap(<ShiftCashRevenueBlock revenue={{ date: DAY, masked: true }} loading={false} />);

    expect(screen.getByText('****')).toBeInTheDocument();
    expect(screen.queryByText('Chuyển khoản')).not.toBeInTheDocument();
  });

  it('shows revenue by channel and the bank-received line with the gap', async () => {
    const onReconcile = vi.fn();
    wrap(<ShiftCashRevenueBlock revenue={REVENUE} loading={false} onReconcile={onReconcile} />);

    expect(screen.getByText('710.000')).toBeInTheDocument();
    expect(screen.getByText('390.000')).toBeInTheDocument();
    expect(screen.getByText('300.000 (−90.000)')).toBeInTheDocument();
    expect(screen.getByText('1 hoá đơn chuyển khoản chưa thấy tiền về')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu' }));
    expect(onReconcile).toHaveBeenCalledTimes(1);
  });
});

describe('ShiftCashSalesTab', () => {
  it('tells users without the permission instead of listing invoices', () => {
    wrap(<ShiftCashSalesTab date={DAY} revenue={{ date: DAY, masked: true }} loading={false} onReload={vi.fn()} />);

    expect(screen.getByText(/chưa được cấp quyền xem doanh thu/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('filters by channel, flags transfers with no money and opens the print dialog', async () => {
    wrap(<ShiftCashSalesTab date={DAY} revenue={REVENUE} loading={false} onReload={vi.fn()} />);

    expect(screen.getAllByRole('row')).toHaveLength(4); // tiêu đề + 3 hoá đơn
    await userEvent.click(screen.getByRole('tab', { name: 'Chuyển khoản (2)' }));
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['HD2', 'HD3']);
    expect(within(rows[1]).getByText('Chưa thấy tiền về')).toBeInTheDocument();

    await userEvent.click(within(rows[1]).getAllByRole('button')[0]);
    expect(screen.getByTestId('print-dialog')).toHaveTextContent('o3');
  });
});

describe('ShiftCashReconciliationPanel', () => {
  const RESULT: IShiftCashReconciliation = {
    date: DAY,
    system: REVENUE.masked ? (null as never) : REVENUE.revenue,
    bank: REVENUE.masked ? (null as never) : REVENUE.bank,
    kiotVietConnected: true,
    kiotViet: {
      ok: true,
      error: null,
      totals: { ...(REVENUE.masked ? (null as never) : REVENUE.revenue.sales), revenue: 780000, netRevenue: 780000 },
      systemOnlyCount: 0,
      systemOnlyRevenue: 0,
      diffs: [
        { code: 'HD9', purchaseDate: null, issue: 'missing-in-system', kiotVietTotal: 70000, systemTotal: null, detail: 'Có trên KiotViet, hệ thống chưa có' },
      ],
    },
    drawer: {
      openingBalance: 1000000, cashFromSales: 320000, manualIncome: 0, manualExpense: 0, expected: 1320000,
      counted: 1300000, difference: -20000, isFinalized: false, finalizedAt: null,
    },
    rows: [
      { key: 'revenue', label: 'Doanh thu', system: 710000, kiotViet: 780000, kiotVietDiff: 70000, bank: null, bankDiff: null },
      { key: 'transfer', label: 'Chuyển khoản', system: 390000, kiotViet: 390000, kiotVietDiff: 0, bank: 300000, bankDiff: -90000 },
    ],
    notes: ['Két THIẾU 20.000đ so với tồn cuối dự kiến 1.320.000đ.'],
    allMatched: false,
  };

  it('stays hidden for staff without the revenue permission', () => {
    mockUser = { role: 'Staff', roles: ['Staff'], permissions: [] };
    const { container } = wrap(<ShiftCashReconciliationPanel date={DAY} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('runs only on click and shows notes, the channel table and invoice mismatches', async () => {
    mockUser = { role: 'Manager', roles: ['Manager'], permissions: ['shift-cash.revenue.read'] };
    getShiftCashReconciliation.mockResolvedValue({ status: 'ok', result: RESULT });
    wrap(<ShiftCashReconciliationPanel date={DAY} />);

    expect(getShiftCashReconciliation).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu' }));

    await waitFor(() => expect(screen.getByText('Có chênh lệch')).toBeInTheDocument());
    expect(getShiftCashReconciliation).toHaveBeenCalledWith(DAY);
    expect(screen.getByText('Két THIẾU 20.000đ so với tồn cuối dự kiến 1.320.000đ.')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'KiotViet' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ngân hàng nhận' })).toBeInTheDocument();
    expect(screen.getByText('−90.000')).toBeInTheDocument();
    expect(screen.getByText('HD9 · Chưa về hệ thống')).toBeInTheDocument();
    expect(screen.getByText('HD3 · 11:00')).toBeInTheDocument();
  });

  it('runs when the revenue block asks for it', async () => {
    mockUser = { role: 'Admin', roles: ['Admin'] };
    getShiftCashReconciliation.mockResolvedValue({ status: 'ok', result: RESULT });
    Element.prototype.scrollIntoView = vi.fn();
    const { rerender } = wrap(<ShiftCashReconciliationPanel date={DAY} runRequest={0} />);

    rerender(
      <ThemeProvider theme={theme}>
        <ShiftCashReconciliationPanel date={DAY} runRequest={1} />
      </ThemeProvider>
    );

    await waitFor(() => expect(getShiftCashReconciliation).toHaveBeenCalledTimes(1));
  });
});
