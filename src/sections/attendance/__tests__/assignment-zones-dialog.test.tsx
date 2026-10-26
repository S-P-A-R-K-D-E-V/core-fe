import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IShiftAssignment } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Khu & trưởng ca: một người được nhiều khu, không cho lưu khi một khu có hai người, và đổi khu giữa hai người luôn nhả
// khu cũ trước khi gán (backend chặn trùng khu bằng 409).
// ----------------------------------------------------------------------

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const setAssignmentZoneLead = vi.fn();
vi.mock('src/api/attendance', () => ({
  setAssignmentZoneLead: (...args: any[]) => setAssignmentZoneLead(...args),
}));

// Imported after the mocks above.
import { planZoneSaves, AssignmentZonesDialog } from 'src/sections/attendance/assignment-zones-dialog';

const assignment = (over: Partial<IShiftAssignment>): IShiftAssignment =>
  ({
    id: 'x',
    assignmentId: 'x',
    staffId: 's',
    staffName: 'Ai đó',
    shiftScheduleId: 'evening',
    scheduleName: 'Tối',
    startTime: '18:00',
    endTime: '22:30',
    scheduleVersion: 1,
    date: '2026-11-02',
    createdAt: '2026-10-27T00:00:00Z',
    zones: [],
    isShiftLead: false,
    ...over,
  }) as IShiftAssignment;

function renderDialog(assignments: IShiftAssignment[], onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <ThemeProvider theme={createTheme()}>
      <AssignmentZonesDialog open title="Tối · 02/11/2026" assignments={assignments} onSaved={onSaved} onClose={onClose} />
    </ThemeProvider>
  );
  return { onSaved, onClose };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('planZoneSaves', () => {
  it('đổi khu A giữa hai người: nhả trước, gán sau', () => {
    const lan = assignment({ id: 'lan', zones: ['A'], isShiftLead: true });
    const mai = assignment({ id: 'mai', zones: ['B', 'C'] });

    const plan = planZoneSaves([lan, mai], {
      lan: { zones: ['B', 'C'], lead: false },
      mai: { zones: ['A'], lead: true },
    });

    expect(plan).toEqual([
      { id: 'lan', zones: [], lead: false },
      { id: 'mai', zones: [], lead: false },
      { id: 'lan', zones: ['B', 'C'], lead: false },
      { id: 'mai', zones: ['A'], lead: true },
    ]);
  });

  it('chỉ thêm khu thì gọi một lần, không đổi gì thì không gọi', () => {
    const lan = assignment({ id: 'lan', zones: ['A'] });
    const mai = assignment({ id: 'mai', zones: ['B'] });

    expect(
      planZoneSaves([lan, mai], { lan: { zones: ['A', 'D'], lead: false }, mai: { zones: ['B'], lead: false } })
    ).toEqual([{ id: 'lan', zones: ['A', 'D'], lead: false }]);
  });
});

describe('AssignmentZonesDialog', () => {
  it('một khu chọn cho hai người thì báo đỏ và khoá nút Lưu', async () => {
    renderDialog([
      assignment({ id: 'lan', staffName: 'Lan', zones: ['A'] }),
      assignment({ id: 'mai', staffName: 'Mai', zones: [] }),
    ]);

    const aChips = screen.getAllByRole('button', { name: 'A' });
    await userEvent.click(aChips[1]);

    expect(screen.getByText(/Khu A đang giao cho hơn một người/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lưu gọi API cho người đổi rồi tải lại lịch', async () => {
    setAssignmentZoneLead.mockResolvedValue({});
    const { onSaved, onClose } = renderDialog([
      assignment({ id: 'lan', staffName: 'Lan', zones: [] }),
      assignment({ id: 'mai', staffName: 'Mai', zones: [] }),
    ]);

    await userEvent.click(screen.getAllByRole('button', { name: 'A' })[0]);
    await userEvent.click(screen.getAllByRole('radio')[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(setAssignmentZoneLead).toHaveBeenCalledWith('lan', ['A'], true));
    expect(setAssignmentZoneLead).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('chọn trưởng ca cho người khác thì bỏ người cũ', async () => {
    renderDialog([
      assignment({ id: 'lan', staffName: 'Lan', isShiftLead: true }),
      assignment({ id: 'mai', staffName: 'Mai' }),
    ]);

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[0].checked).toBe(true);
    await userEvent.click(radios[1]);

    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
  });
});
