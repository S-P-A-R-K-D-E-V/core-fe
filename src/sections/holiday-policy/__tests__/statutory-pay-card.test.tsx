import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// "Trả lương theo Bộ luật Lao động": chưa áp dụng thì cảnh báo Điều 98; lưu ngày + giờ làm bình thường sau khi xác nhận;
// giờ ngoài 4–10 không lưu được; bỏ ngày áp dụng gửi null.
// ----------------------------------------------------------------------

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const getStatutoryPaySettings = vi.fn();
const updateStatutoryPaySettings = vi.fn();
vi.mock('src/api/holidayPolicy', () => ({
  getStatutoryPaySettings: (...args: any[]) => getStatutoryPaySettings(...args),
  updateStatutoryPaySettings: (...args: any[]) => updateStatutoryPaySettings(...args),
}));

// Imported after the mocks above.
import { StatutoryPayCard } from 'src/sections/holiday-policy/statutory-pay-card';

function renderCard() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <StatutoryPayCard />
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

describe('StatutoryPayCard', () => {
  it('chưa áp dụng: cảnh báo Điều 98, lưu ngày và giờ làm sau khi xác nhận', async () => {
    getStatutoryPaySettings.mockResolvedValue({ statutoryPayFrom: null, normalHoursPerDay: 8, updatedAt: null });
    updateStatutoryPaySettings.mockResolvedValue({ statutoryPayFrom: '2026-11-01', normalHoursPerDay: 8, updatedAt: 'x' });
    renderCard();

    expect(await screen.findByText(/\(Điều 98\)/)).toBeTruthy();
    const input = screen.getByLabelText('Áp dụng từ ngày') as HTMLInputElement;
    await userEvent.clear(input);
    await userEvent.type(input, '2026-11-01');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await confirmInDialog('Áp dụng');

    await waitFor(() => expect(updateStatutoryPaySettings).toHaveBeenCalledWith('2026-11-01', 8));
    expect(await screen.findByText(/theo Điều 98 từ 01\/11\/2026, giờ làm bình thường 8 giờ\/ngày/)).toBeTruthy();
  });

  it('giờ làm bình thường ngoài 4–10 thì khoá nút Lưu', async () => {
    getStatutoryPaySettings.mockResolvedValue({ statutoryPayFrom: null, normalHoursPerDay: 8, updatedAt: null });
    renderCard();

    const hours = (await screen.findByLabelText('Giờ làm bình thường / ngày')) as HTMLInputElement;
    await userEvent.clear(hours);
    await userEvent.type(hours, '12');

    expect(screen.getByText('Từ 4 đến 10 giờ')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('đã áp dụng: bỏ ngày áp dụng gửi null', async () => {
    getStatutoryPaySettings.mockResolvedValue({ statutoryPayFrom: '2026-11-01', normalHoursPerDay: 8, updatedAt: 'x' });
    updateStatutoryPaySettings.mockResolvedValue({ statutoryPayFrom: null, normalHoursPerDay: 8, updatedAt: 'y' });
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ ngày áp dụng' }));
    await confirmInDialog('Bỏ ngày áp dụng');

    await waitFor(() => expect(updateStatutoryPaySettings).toHaveBeenCalledWith(null, null));
    expect(await screen.findByText(/\(Điều 98\)/)).toBeTruthy();
  });
});
