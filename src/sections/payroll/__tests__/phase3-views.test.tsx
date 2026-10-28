import { describe, expect, it, vi, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IShiftStockCheck } from 'src/types/shift-stock-check';
import type { IPayrollComplaint } from 'src/types/payroll-complaint';

// ----------------------------------------------------------------------
// Nhân sự Phase 3: khiếu nại phiếu lương (hạn 3 ngày làm việc, trả lời Có sai sót / Phiếu đúng), kiểm hàng khu vực mỗi ca (đếm mù,
// nộp khi đếm đủ), chương trình thưởng theo đơn (chỉ Admin).
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/custom-breadcrumbs', () => ({ default: ({ heading }: { heading: string }) => <h1>{heading}</h1> }));

const auth = { user: { id: 'lan', role: 'Staff', permissions: [] as string[] } };
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => auth }));

const complaints = vi.hoisted(() => ({
  getMyPayrollComplaints: vi.fn(),
  getPayrollComplaintWindow: vi.fn(),
  filePayrollComplaint: vi.fn(),
  withdrawPayrollComplaint: vi.fn(),
  getPayrollComplaints: vi.fn(),
  replyPayrollComplaint: vi.fn(),
}));
vi.mock('src/api/payroll-complaints', () =>
  Object.fromEntries(Object.keys(complaints).map((k) => [k, (...a: any[]) => (complaints as any)[k](...a)]))
);

const checks = vi.hoisted(() => ({
  getMyShiftStockChecks: vi.fn(),
  getShiftStockChecks: vi.fn(),
  getShiftStockCheck: vi.fn(),
  saveShiftStockCounts: vi.fn(),
  submitShiftStockCheck: vi.fn(),
  reviewShiftStockCheck: vi.fn(),
  getStockCheckAreas: vi.fn(),
  saveStockCheckArea: vi.fn(),
}));
vi.mock('src/api/shift-stock-checks', () =>
  Object.fromEntries(Object.keys(checks).map((k) => [k, (...a: any[]) => (checks as any)[k](...a)]))
);
vi.mock('src/api/categories', () => ({ getAllCategories: vi.fn().mockResolvedValue([]) }));

const theme = createTheme();
const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

afterEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = [];
});

const complaint = (over: Partial<IPayrollComplaint> = {}): IPayrollComplaint => ({
  id: 'c1',
  staffId: 'lan',
  staffName: 'Lan Trần',
  payrollRecordId: 'p1',
  fromDate: '2026-10-16',
  toDate: '2026-10-31',
  totalSalaryAtFiling: 1_530_000,
  content: 'Thiếu 2 giờ ca tối 28/10',
  status: 'Pending',
  replyDueOn: '2026-11-13',
  isOverdue: false,
  createdAt: '2026-11-10T03:00:00Z',
  ...over,
});

describe('Khiếu nại phiếu lương', () => {
  it('còn hạn thì gửi được khiếu nại, có nội dung mới bấm gửi', async () => {
    const { PayrollComplaintButton } = await import('../payroll-complaints');
    complaints.getPayrollComplaintWindow.mockResolvedValue({ receivedOn: '2026-11-06', deadline: '2026-11-10', isOpen: true });
    complaints.filePayrollComplaint.mockResolvedValue(complaint());
    const onFiled = vi.fn();
    wrap(<PayrollComplaintButton payrollRecordId="p1" onFiled={onFiled} />);

    await userEvent.click(await screen.findByRole('button', { name: /Khiếu nại phiếu lương \(đến 10\/11\)/ }));
    const send = screen.getByRole('button', { name: 'Gửi khiếu nại' });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Nội dung khiếu nại'), 'Thiếu 2 giờ ca tối 28/10');
    await userEvent.click(send);

    await waitFor(() => expect(complaints.filePayrollComplaint).toHaveBeenCalledWith('p1', 'Thiếu 2 giờ ca tối 28/10'));
    expect(onFiled).toHaveBeenCalled();
  });

  it('hết hạn hoặc đang chờ thì không có nút gửi', async () => {
    const { PayrollComplaintButton } = await import('../payroll-complaints');
    complaints.getPayrollComplaintWindow.mockResolvedValueOnce({ receivedOn: '2026-11-02', deadline: '2026-11-05', isOpen: false });
    const { unmount } = wrap(<PayrollComplaintButton payrollRecordId="p1" />);
    expect(await screen.findByText(/Hết hạn khiếu nại \(05\/11\)/)).toBeInTheDocument();
    unmount();

    complaints.getPayrollComplaintWindow.mockResolvedValueOnce({
      receivedOn: '2026-11-06', deadline: '2026-11-10', isOpen: true, pendingComplaintId: 'c1',
    });
    wrap(<PayrollComplaintButton payrollRecordId="p1" />);
    expect(await screen.findByText('Đã khiếu nại — chờ trả lời')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Khiếu nại phiếu lương/ })).not.toBeInTheDocument();
  });

  it('quản lý trả lời "Có sai sót" kèm lời giải thích; quá hạn thì báo đỏ', async () => {
    const { PayrollComplaintsView } = await import('../payroll-complaints');
    complaints.getPayrollComplaints.mockResolvedValue([complaint({ isOverdue: true })]);
    complaints.replyPayrollComplaint.mockResolvedValue(complaint({ status: 'Accepted' }));
    wrap(<PayrollComplaintsView />);

    expect(await screen.findByText('Quá hạn trả lời')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trả lời' }));
    await userEvent.click(screen.getByLabelText('Có sai sót — sẽ tính lại bảng lương'));
    await userEvent.type(screen.getByLabelText('Trả lời cho nhân viên'), 'Thiếu 2 giờ, sẽ tính lại');
    await userEvent.click(screen.getByRole('button', { name: 'Gửi trả lời' }));

    await waitFor(() =>
      expect(complaints.replyPayrollComplaint).toHaveBeenCalledWith('c1', 'Accepted', 'Thiếu 2 giờ, sẽ tính lại')
    );
  });
});

const check = (over: Partial<IShiftStockCheck> = {}): IShiftStockCheck => ({
  id: 'k1',
  code: 'KK-0001',
  areaName: 'Tủ trang sức',
  title: 'Sáng · Tủ trang sức',
  shiftDate: '2026-11-02',
  status: 'Draft',
  dueAt: '2026-11-02T05:00:00Z',
  isOverdue: false,
  createdAt: '2026-11-02T02:00:00Z',
  blind: true,
  totalLines: 2,
  countedLines: 0,
  lines: [
    { lineId: 'l1', productId: 'p1', productCode: 'NH01', productName: 'Nhẫn bạc', countedQuantity: null, systemQuantity: null },
    { lineId: 'l2', productId: 'p2', productCode: 'DC01', productName: 'Dây chuyền', countedQuantity: null, systemQuantity: null },
  ],
  ...over,
});

describe('Kiểm hàng ca', () => {
  it('nhân viên đếm mù (không thấy tồn máy), lưu số đếm rồi nộp', async () => {
    const { ShiftCountCard } = await import('src/sections/pos/inventory/shift-checks-view');
    const saved = check({ countedLines: 2 });
    checks.saveShiftStockCounts.mockResolvedValue(saved);
    checks.submitShiftStockCheck.mockResolvedValue({ ...saved, status: 'Pending' });
    const onChanged = vi.fn();
    wrap(<ShiftCountCard check={check()} onChanged={onChanged} />);

    expect(screen.queryByText('Tồn máy')).not.toBeInTheDocument();
    const [ring, chain] = screen.getAllByRole('textbox');
    await userEvent.type(ring, '4');
    await userEvent.type(chain, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Nộp phiếu' }));

    await waitFor(() => expect(checks.submitShiftStockCheck).toHaveBeenCalledWith('k1'));
    expect(checks.saveShiftStockCounts).toHaveBeenCalledWith('k1', [
      { lineId: 'l1', quantity: 4 },
      { lineId: 'l2', quantity: 3 },
    ]);
    expect(onChanged).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'Pending' }));
  });

  it('quản lý thấy tồn máy và chênh lệch của phiếu đã nộp', async () => {
    const { ShiftCountCard } = await import('src/sections/pos/inventory/shift-checks-view');
    wrap(
      <ShiftCountCard
        onChanged={vi.fn()}
        check={check({
          blind: false,
          status: 'Pending',
          lines: [
            { lineId: 'l1', productId: 'p1', productCode: 'NH01', productName: 'Nhẫn bạc', countedQuantity: 4, systemQuantity: 5, variance: -1 },
          ],
        })}
      />
    );

    expect(screen.getByText('Tồn máy')).toBeInTheDocument();
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nộp phiếu' })).not.toBeInTheDocument();
  });

  it('nhân viên chỉ thấy tab phiếu hôm nay; người xem kiểm kho thấy thêm danh sách và khu vực', async () => {
    const { ShiftStockChecksView } = await import('src/sections/pos/inventory/shift-checks-view');
    checks.getMyShiftStockChecks.mockResolvedValue([]);
    const { unmount } = wrap(<ShiftStockChecksView />);
    expect(await screen.findByText(/chưa có phiếu kiểm hàng cho ca của bạn/)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Khu vực kiểm' })).not.toBeInTheDocument();
    unmount();

    auth.user.permissions = ['stocktake.read'];
    wrap(<ShiftStockChecksView />);
    expect(screen.getByRole('tab', { name: 'Các phiếu kiểm ca' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Khu vực kiểm' })).toBeInTheDocument();
  });
});
