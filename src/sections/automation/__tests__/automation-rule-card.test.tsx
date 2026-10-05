import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import type { IAutomationRule } from 'src/api/automation';

// ----------------------------------------------------------------------
// Thẻ cảnh báo với Ô GIỜ THẬT (AppTimePicker của src/components/date-time-picker, không thay thế như ở
// automation-settings-view.test.tsx): giá trị "HH:mm" của API hiện đúng trong ô, dạng 24 giờ.
// ----------------------------------------------------------------------

vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: vi.fn() }),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

vi.mock('src/api/automation', () => ({
  updateAutomationRule: vi.fn(),
}));

// Imported after the mocks above so the card picks up the mocked modules.
import AutomationRuleCard from '../automation-rule-card';

const settings = { weekday: 5, time: '18:00', channels: { notification: true, messenger: true } };

const rule: IAutomationRule = {
  code: 'attendance.no-registration',
  title: 'Chưa đăng ký ca tuần tới',
  description: 'Mỗi tuần vào thứ và giờ đã đặt, báo những nhân viên chưa đăng ký ca cho tuần tới.',
  enabled: true,
  defaultEnabled: true,
  settings,
  defaults: settings,
  globallyDisabled: false,
  updatedAt: null,
  updatedByUserId: null,
};

describe('AutomationRuleCard — ô giờ thật', () => {
  it('hiện giờ đang lưu ở dạng 24 giờ, cạnh ô chọn thứ', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <AutomationRuleCard rule={rule} onSaved={vi.fn()} />
        </LocalizationProvider>
      </ThemeProvider>
    );

    expect(screen.getByLabelText('Giờ kiểm tra đăng ký ca')).toHaveValue('18:00');
    expect(screen.getByRole('combobox', { name: 'Thứ kiểm tra' })).toHaveTextContent('Thứ Sáu');
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled();
  });
});
