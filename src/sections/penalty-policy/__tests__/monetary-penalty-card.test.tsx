import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// "Ngừng phạt tiền": hiện trạng thái đang phạt / đã ngừng, lưu ngày sau khi xác nhận, bỏ ngày để phạt lại như cũ.
// ----------------------------------------------------------------------

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const getMonetaryPenaltySettings = vi.fn();
const updateMonetaryPenaltySettings = vi.fn();
vi.mock('src/api/penaltyPolicy', () => ({
  getMonetaryPenaltySettings: (...args: any[]) => getMonetaryPenaltySettings(...args),
  updateMonetaryPenaltySettings: (...args: any[]) => updateMonetaryPenaltySettings(...args),
}));

// Imported after the mocks above.
import { MonetaryPenaltyCard } from 'src/sections/penalty-policy/monetary-penalty-card';

function renderCard() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MonetaryPenaltyCard />
    </ThemeProvider>
  );
}

async function confirmInDialog(label: string) {
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === label)!);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('MonetaryPenaltyCard', () => {
  it('chưa đặt ngày: cảnh báo luật, lưu ngày đã chọn sau khi xác nhận', async () => {
    getMonetaryPenaltySettings.mockResolvedValue({ monetaryPenaltiesDisabledFrom: null, updatedAt: null });
    updateMonetaryPenaltySettings.mockResolvedValue({ monetaryPenaltiesDisabledFrom: '2026-11-01', updatedAt: 'x' });
    renderCard();

    expect(await screen.findByText(/Điều 127/)).toBeTruthy();
    const input = screen.getByLabelText('Ngừng phạt tiền từ ngày') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '2026-11-01');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await confirmInDialog('Ngừng phạt tiền');

    await waitFor(() => expect(updateMonetaryPenaltySettings).toHaveBeenCalledWith('2026-11-01'));
    expect(await screen.findByText(/không phạt tiền từ 01\/11\/2026/)).toBeTruthy();
  });

  it('huỷ ở hộp xác nhận thì không lưu', async () => {
    getMonetaryPenaltySettings.mockResolvedValue({ monetaryPenaltiesDisabledFrom: null, updatedAt: null });
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Lưu' }));
    await confirmInDialog('Huỷ');

    expect(updateMonetaryPenaltySettings).not.toHaveBeenCalled();
  });

  it('đã đặt ngày: bỏ ngày ngừng gửi null', async () => {
    getMonetaryPenaltySettings.mockResolvedValue({ monetaryPenaltiesDisabledFrom: '2026-11-01', updatedAt: 'x' });
    updateMonetaryPenaltySettings.mockResolvedValue({ monetaryPenaltiesDisabledFrom: null, updatedAt: 'y' });
    renderCard();

    expect(await screen.findByText(/không phạt tiền từ 01\/11\/2026/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ ngày ngừng' }));
    await confirmInDialog('Bỏ ngày ngừng');

    await waitFor(() => expect(updateMonetaryPenaltySettings).toHaveBeenCalledWith(null));
    expect(await screen.findByText(/Điều 127/)).toBeTruthy();
  });
});
