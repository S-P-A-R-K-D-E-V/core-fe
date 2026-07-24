import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Regression test: submitting the checklist tuần dialog with no ca selected
// must be blocked client-side (new zod rule) and must NOT call the create
// API — this is the client-side half of the shiftTemplateIds bug fix.
// ----------------------------------------------------------------------

vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { role: 'Admin', roles: ['Admin'] } }),
}));

vi.mock('src/components/settings', () => ({
  useSettingsContext: () => ({ themeStretch: false }),
}));

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ action }: any) => <div>{action}</div>,
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

vi.mock('src/components/scrollbar', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

// Sidesteps an environment-specific MUI/Emotion styled-component crash seen only
// under jsdom + this dependency combination ("Cannot assign to read only property
// 'theme'") that is unrelated to what this test covers (dialog validation/values).
vi.mock('src/components/label', () => ({
  default: ({ children }: any) => <span>{children}</span>,
}));

const getAllShiftTemplates = vi.fn();
vi.mock('src/api/attendance', () => ({
  getAllShiftTemplates: (...args: any[]) => getAllShiftTemplates(...args),
}));

const getCleaningTaskTemplates = vi.fn();
const createCleaningTaskTemplate = vi.fn();
const updateCleaningTaskTemplate = vi.fn();
const deleteCleaningTaskTemplate = vi.fn();
vi.mock('src/api/cleaning', () => ({
  getCleaningTaskTemplates: (...args: any[]) => getCleaningTaskTemplates(...args),
  createCleaningTaskTemplate: (...args: any[]) => createCleaningTaskTemplate(...args),
  updateCleaningTaskTemplate: (...args: any[]) => updateCleaningTaskTemplate(...args),
  deleteCleaningTaskTemplate: (...args: any[]) => deleteCleaningTaskTemplate(...args),
}));

// Imported after the mocks above so the view picks up the mocked modules.
import CleaningTemplateListView from 'src/sections/cleaning/view/cleaning-template-list-view';

function renderView() {
  // A fresh theme per render avoids MUI/emotion's shared default-theme
  // singleton, which otherwise gets frozen and throws
  // "Cannot assign to read only property 'theme'" on the 2nd+ test render.
  return render(
    <ThemeProvider theme={createTheme()}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <CleaningTemplateListView />
      </LocalizationProvider>
    </ThemeProvider>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('CleaningTemplateListView dialog', () => {
  it('blocks submit and shows a validation error when no shift template is selected', async () => {
    getCleaningTaskTemplates.mockResolvedValue([]);
    getAllShiftTemplates.mockResolvedValue([
      { id: 'shift-1', name: 'Ca sáng', shiftType: 'Main', isActive: true, createdAt: '2026-01-01' },
      { id: 'shift-2', name: 'Ca chiều', shiftType: 'Main', isActive: true, createdAt: '2026-01-01' },
    ]);

    const user = userEvent.setup();
    renderView();

    const addButton = await screen.findByRole('button', { name: 'Thêm đầu việc' });
    await user.click(addButton);

    const dialog = await screen.findByRole('dialog');
    const nameField = within(dialog).getByLabelText('Tên đầu việc');
    await user.type(nameField, 'Lau sàn khu vực A');

    // shiftTemplateIds is intentionally left empty.
    const submitButton = within(dialog).getByRole('button', { name: 'Tạo mới' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(within(dialog).getByText('Chọn ít nhất 1 ca áp dụng')).toBeInTheDocument();
    });

    expect(createCleaningTaskTemplate).not.toHaveBeenCalled();
  });

  it('normalizes an already-canonical fromDate/toDate to the DatePicker display format on edit', async () => {
    getCleaningTaskTemplates.mockResolvedValue([
      {
        id: 'tpl-1',
        dayOfWeek: 'Monday',
        cleaningBlock: 'Morning',
        name: 'Lau sàn',
        area: 'Tầng 1',
        sortOrder: 0,
        isActive: true,
        fromDate: '2026-07-20',
        toDate: null,
        shiftTemplateIds: ['shift-1'],
      },
    ]);
    getAllShiftTemplates.mockResolvedValue([
      { id: 'shift-1', name: 'Ca sáng', shiftType: 'Main', isActive: true, createdAt: '2026-01-01' },
    ]);

    const user = userEvent.setup();
    renderView();

    const editButton = await screen.findByRole('button', { name: 'Sửa' });
    await user.click(editButton);

    const dialog = await screen.findByRole('dialog');
    const fromDateInput = within(dialog).getByLabelText('Áp dụng từ ngày') as HTMLInputElement;
    expect(fromDateInput.value).toBe('20/07/2026');
  });

  it('opens with an empty date field (instead of a broken raw string) when the API returned a malformed fromDate, and blocks submit until it is fixed', async () => {
    getCleaningTaskTemplates.mockResolvedValue([
      {
        id: 'tpl-1',
        dayOfWeek: 'Monday',
        cleaningBlock: 'Morning',
        name: 'Lau sàn',
        area: 'Tầng 1',
        sortOrder: 0,
        isActive: true,
        fromDate: '20-07-2026', // legacy/odd-formatted (dd-MM-yyyy) value from the API
        toDate: null,
        shiftTemplateIds: ['shift-1'],
      },
    ]);
    getAllShiftTemplates.mockResolvedValue([
      { id: 'shift-1', name: 'Ca sáng', shiftType: 'Main', isActive: true, createdAt: '2026-01-01' },
    ]);

    const user = userEvent.setup();
    renderView();

    const editButton = await screen.findByRole('button', { name: 'Sửa' });
    await user.click(editButton);

    const dialog = await screen.findByRole('dialog');
    // Must NOT round-trip the broken raw string into the field.
    const fromDateInput = within(dialog).getByLabelText('Áp dụng từ ngày') as HTMLInputElement;
    expect(fromDateInput.value).not.toBe('20-07-2026');
    expect(fromDateInput.value).toBe('');

    const submitButton = within(dialog).getByRole('button', { name: 'Cập nhật' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(within(dialog).getByText('Ngày bắt đầu áp dụng là bắt buộc')).toBeInTheDocument();
    });
    expect(updateCleaningTaskTemplate).not.toHaveBeenCalled();
  });
});
