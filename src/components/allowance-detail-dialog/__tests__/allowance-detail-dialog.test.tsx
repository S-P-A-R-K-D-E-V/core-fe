import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IPayrollRecord } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// "Chi tiết thưởng & phụ cấp": liệt kê từng dòng (bù 300% ngày lễ, làm thêm giờ, ca đêm…) và tổng.
// ----------------------------------------------------------------------

const getPayrollAllowanceDetails = vi.fn();
vi.mock('src/api/payroll', () => ({
  getPayrollAllowanceDetails: (...args: any[]) => getPayrollAllowanceDetails(...args),
}));

// Imported after the mocks above.
import AllowanceDetailDialog from 'src/components/allowance-detail-dialog';

const record = { id: 'rec-1', userName: 'Lan', periodMonth: '2026-11' } as IPayrollRecord;

describe('AllowanceDetailDialog', () => {
  it('shows every allowance line and the total', async () => {
    getPayrollAllowanceDetails.mockResolvedValue([
      { id: 'a', itemType: 'HolidayBonus', description: 'Thưởng ngày lễ: 2/9', quantity: 1, unitPrice: 45000, amount: 45000 },
      { id: 'b', itemType: 'HolidayStatutoryTopUp', description: 'Bù đủ 300% ngày lễ 2/9', quantity: 4.5, unitPrice: 30000, amount: 135000 },
      { id: 'c', itemType: 'NightPremium', description: 'Làm việc ban đêm 22:00–06:00: 0.5h', quantity: 0.5, unitPrice: 6000, amount: 3000 },
    ]);

    render(
      <ThemeProvider theme={createTheme()}>
        <AllowanceDetailDialog open record={record} onClose={vi.fn()} />
      </ThemeProvider>
    );

    expect(await screen.findByText('Bù đủ 300% ngày lễ 2/9')).toBeTruthy();
    expect(getPayrollAllowanceDetails).toHaveBeenCalledWith('rec-1');
    expect(screen.getByText('Làm việc ban đêm 22:00–06:00: 0.5h')).toBeTruthy();
    // 45.000 + 135.000 + 3.000
    expect(screen.getByText(/183\.000/)).toBeTruthy();
  });
});
