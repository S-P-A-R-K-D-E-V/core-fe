import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// "Đăng xuất mọi người": chỉ gọi API sau khi chủ cửa hàng xác nhận, rồi báo số người / phiên đã đăng xuất.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({ default: () => null }));

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const endAllStoreSessions = vi.fn();
vi.mock('src/api/store-settings', () => ({
  endAllStoreSessions: (...args: any[]) => endAllStoreSessions(...args),
}));

// Imported after the mocks above.
import { EndAllSessionsCard } from 'src/sections/store-settings/end-all-sessions-card';

function renderCard() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <EndAllSessionsCard />
    </ThemeProvider>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('EndAllSessionsCard', () => {
  it('huỷ ở hộp xác nhận thì không gọi API', async () => {
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: /Đăng xuất mọi người/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Huỷ' }));

    expect(endAllStoreSessions).not.toHaveBeenCalled();
  });

  it('xác nhận thì gọi API một lần và hiện kết quả', async () => {
    endAllStoreSessions.mockResolvedValue({ members: 11, refreshTokensCleared: 9, sessionsEnded: 17 });
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: /Đăng xuất mọi người/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Đăng xuất mọi người')!
    );

    await waitFor(() => expect(endAllStoreSessions).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Đã đăng xuất 11 người: đóng 17 phiên/)).toBeTruthy();
    expect(enqueueSnackbar).toHaveBeenCalledWith('Đã đăng xuất 11 người, đóng 17 phiên', { variant: 'success' });
  });

  it('API lỗi thì báo lỗi, không hiện kết quả', async () => {
    endAllStoreSessions.mockRejectedValue({ status: 403, message: 'Forbidden' });
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: /Đăng xuất mọi người/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Đăng xuất mọi người')!
    );

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(String), { variant: 'error' }));
    expect(screen.queryByText(/Đã đăng xuất 11 người/)).toBeNull();
  });
});
