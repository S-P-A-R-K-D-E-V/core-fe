import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IHrRules } from 'src/types/hr-rules';

// ----------------------------------------------------------------------
// Cấu hình luật nhân sự của cửa hàng: luật tắt thì không có ô số; bật thì điền số gợi ý để sửa; Lưu gửi đúng bộ luật.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading, action }: { heading: string; action?: React.ReactNode }) => (
    <div>
      <h1>{heading}</h1>
      {action}
    </div>
  ),
}));

const OFF: IHrRules = {
  weeklyBonusEnabled: false,
  weeklyBonusTier1FromPct: null,
  weeklyBonusTier1RatePct: null,
  weeklyBonusTier2FromPct: null,
  weeklyBonusTier2RatePct: null,
  weeklyBonusExcludeDiscountPct: null,
  weeklyBonusExcludeOnline: false,
  targetGrowthPct: null,
  complaintWorkingDays: null,
  supportShiftMonthlyCap: null,
  supportShiftLatestEnd: null,
  leaveMinNoticeHours: null,
  recordCashThreshold: null,
  performanceEnabled: false,
  warnSecondMainShift: false,
  monthlyHourCap: null,
  probationRoleWarnings: false,
};

const api = vi.hoisted(() => ({
  getHrRuleSettings: vi.fn(),
  saveHrRuleSettings: vi.fn(),
  resetActiveHrRules: vi.fn(),
}));
vi.mock('src/api/hr-rules', () => ({
  getHrRuleSettings: (...a: any[]) => api.getHrRuleSettings(...a),
  saveHrRuleSettings: (...a: any[]) => api.saveHrRuleSettings(...a),
  resetActiveHrRules: () => api.resetActiveHrRules(),
  shortTime: (v: string | null) => (v ? v.slice(0, 5) : ''),
}));

// Imported after the mocks above.
import HrRulesView from 'src/sections/hr/view/hr-rules-view';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

describe('HrRulesView', () => {
  it('turning a rule on suggests a number; Lưu sends the rules', async () => {
    api.getHrRuleSettings.mockResolvedValue({ rules: OFF, customized: false, updatedAt: null });
    api.saveHrRuleSettings.mockImplementation(async (rules: IHrRules) => ({ rules, customized: true, updatedAt: '2026-10-28T16:00:00Z' }));
    wrap(<HrRulesView />);

    expect(await screen.findByText(/chưa lưu cấu hình/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Hạn khiếu nại/)).toBeNull();

    await userEvent.click(screen.getByLabelText('Nhân viên khiếu nại phiếu lương'));
    const days = screen.getByLabelText(/Hạn khiếu nại/) as HTMLInputElement;
    expect(days.value).toBe('3');
    await userEvent.clear(days);
    await userEvent.type(days, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(api.saveHrRuleSettings).toHaveBeenCalledWith({ ...OFF, complaintWorkingDays: 5 })
    );
    expect(api.resetActiveHrRules).toHaveBeenCalled();
  });
});
