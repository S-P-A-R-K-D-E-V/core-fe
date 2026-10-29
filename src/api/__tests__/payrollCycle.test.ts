import { afterEach, describe, expect, it, vi } from 'vitest';

// ----------------------------------------------------------------------
// Hợp đồng với core-be (PayrollCycleController): khoá và mở khoá cùng là PUT /payroll-cycles/{id}/lock với { isLocked },
// sửa kỳ là PUT /payroll-cycles/{id}. Trước đây web gọi POST …/lock và POST …/unlock — không route nào tồn tại nên nút
// Khoá / Mở khoá trên web không bao giờ chạy (OQ-PRL-003 trong Project Brain).
// ----------------------------------------------------------------------

const http = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

// Imported after the mock above so the module under test picks up the mocked axios.
import { lockPayrollCycle, unlockPayrollCycle, updatePayrollCycle } from 'src/api/payrollCycle';

afterEach(() => {
  vi.clearAllMocks();
});

describe('payroll cycle lock', () => {
  it('khoá: PUT /payroll-cycles/{id}/lock { isLocked: true }', async () => {
    http.put.mockResolvedValue({ data: { id: 'c1', isLocked: true } });

    await lockPayrollCycle('c1', { isLocked: true });

    expect(http.post).not.toHaveBeenCalled();
    expect(http.put).toHaveBeenCalledWith('/payroll-cycles/c1/lock', { isLocked: true });
  });

  it('mở khoá: cùng endpoint …/lock với { isLocked: false }, không có …/unlock', async () => {
    http.put.mockResolvedValue({ data: { id: 'c1', isLocked: false } });

    await unlockPayrollCycle('c1', { isLocked: false });

    expect(http.post).not.toHaveBeenCalled();
    expect(http.put).toHaveBeenCalledWith('/payroll-cycles/c1/lock', { isLocked: false });
  });
});

describe('payroll cycle update', () => {
  it('sửa kỳ: PUT /payroll-cycles/{id}', async () => {
    const body = { name: 'T10', cycleType: 'Custom', fromDate: '2026-10-01', toDate: '2026-10-31', standardWorkDays: 22 };
    http.put.mockResolvedValue({ data: { id: 'c1', ...body } });

    await updatePayrollCycle('c1', body);

    expect(http.put).toHaveBeenCalledWith('/payroll-cycles/c1', body);
  });
});
